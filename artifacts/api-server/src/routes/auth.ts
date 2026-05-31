import { Router, type IRouter } from "express";
import { createOtp, verifyOtp } from "../lib/otp";
import { sendOtpEmail, sendPasswordResetEmail } from "../lib/email";
import { createCustomToken } from "../lib/firebase";
import { getActiveUserId, signAppJwt } from "../lib/session";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const router: IRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post("/auth/otp/send", async (req, res) => {
  const { email } = req.body ?? {};
  if (typeof email !== "string" || !EMAIL_RE.test(email)) {
    res.status(400).json({ error: "Invalid email address" });
    return;
  }

  try {
    const otp = createOtp(email);
    await sendOtpEmail(email, otp);
    res.json({ ok: true });
  } catch (err) {
    console.error("Failed to send OTP email:", err);
    res.status(500).json({ error: "Failed to send verification email. Please try again." });
  }
});

router.post("/auth/otp/verify", async (req, res) => {
  const { email, otp } = req.body ?? {};
  if (typeof email !== "string" || !EMAIL_RE.test(email)) {
    res.status(400).json({ error: "Invalid email address" });
    return;
  }
  if (typeof otp !== "string" || otp.trim().length !== 6) {
    res.status(400).json({ error: "OTP must be a 6-digit code" });
    return;
  }

  const result = verifyOtp(email, otp);

  switch (result) {
    case "valid": {
      try {
        const uid = email.toLowerCase().replace(/[^a-z0-9]/g, "_");
        const customToken = await createCustomToken(uid, { email });
        res.json({ valid: true, customToken });
      } catch (err) {
        console.error("Failed to create Firebase custom token:", err);
        res.json({ valid: true, customToken: null });
      }
      break;
    }
    case "invalid":
      res.status(422).json({ valid: false, error: "Incorrect code. Please try again." });
      break;
    case "expired":
      res.status(410).json({ valid: false, error: "This code has expired. Please request a new one." });
      break;
    case "too_many_attempts":
      res.status(429).json({ valid: false, error: "Too many incorrect attempts. Please request a new code." });
      break;
  }
});

router.post("/auth/admin/login", async (req, res) => {
  const { passcode } = (req.body ?? {}) as { passcode?: string };
  const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || "trainershive@admin";

  if (!passcode || passcode !== ADMIN_PASSCODE) {
    res.status(401).json({ error: "Incorrect passcode." });
    return;
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    res.status(500).json({ error: "Admin email not configured on server." });
    return;
  }

  const [adminUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.role, "admin"))
    .limit(1);

  if (!adminUser) {
    res.status(500).json({ error: "Admin user not found in database." });
    return;
  }

  const sessionToken = signAppJwt(adminUser.id);

  res.json({
    sessionToken,
    adminEmail,
    user: { id: adminUser.id, name: adminUser.name, email: adminUser.email, role: adminUser.role },
  });
});

router.post("/auth/set-password", async (req, res) => {
  const activeId = await getActiveUserId(req);
  if (!activeId) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }

  const { password } = (req.body ?? {}) as { password?: string };
  if (!password || password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters." });
    return;
  }

  const hash = await bcrypt.hash(password, 10);
  await db.update(usersTable).set({ passwordHash: hash }).where(eq(usersTable.id, activeId));
  res.json({ ok: true });
});

// Issues a fresh app JWT for the currently authenticated user (Firebase or app JWT).
// Called by the frontend after onAuthStateChanged to ensure th_session_token is always set.
router.get("/auth/session-token", async (req, res) => {
  try {
    const activeId = await getActiveUserId(req);
    const sessionToken = signAppJwt(activeId);
    res.json({ sessionToken });
  } catch {
    res.status(401).json({ error: "unauthenticated" });
  }
});

router.post("/auth/password/login", async (req, res) => {
  const { email, password } = (req.body ?? {}) as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required." });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase().trim()))
    .limit(1);

  if (!user || !user.passwordHash) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  if (user.deactivatedAt) {
    res.status(403).json({ error: "account_deactivated", message: "Your account has been deactivated. Please contact support." });
    return;
  }

  // Issue a self-signed app JWT — works even when Firebase client-side is unavailable
  const sessionToken = signAppJwt(user.id);

  // Also set the server-side session for dev-mode fallback
  const { setActiveUserId } = await import("../lib/session.js");
  await setActiveUserId(user.id);

  let customToken: string | null = null;
  try {
    const uid = user.email.toLowerCase().replace(/[^a-z0-9]/g, "_");
    customToken = await createCustomToken(uid, { email: user.email });
  } catch (_err) {
    // Firebase token generation failed — sessionToken will be used instead
  }

  res.json({
    sessionToken,
    customToken,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, trainerId: user.trainerId, vendorId: user.vendorId },
  });
});

// Step 1 of password reset: email a 6-digit code to the account owner.
// Always responds { ok: true } regardless of whether the email is registered,
// so the endpoint can't be used to discover which emails have accounts.
router.post("/auth/password/reset/request", async (req, res) => {
  const { email } = (req.body ?? {}) as { email?: string };
  if (typeof email !== "string" || !EMAIL_RE.test(email)) {
    res.status(400).json({ error: "Invalid email address" });
    return;
  }
  const normalized = email.toLowerCase().trim();
  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, normalized))
      .limit(1);
    if (user && !user.deactivatedAt) {
      const otp = createOtp(normalized);
      // Fire-and-forget: don't await the email send. This keeps response timing
      // uniform for registered vs. unregistered emails (no enumeration side
      // channel) and prevents a provider outage from leaking account existence
      // via a 500 for registered emails only.
      void sendPasswordResetEmail(normalized, otp).catch((err) => {
        console.error("Failed to send password reset email:", err);
      });
    }
    res.json({ ok: true });
  } catch (err) {
    // A DB lookup failure happens for any email regardless of registration, so
    // surfacing it doesn't reveal account existence.
    console.error("Password reset request failed:", err);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

// Step 2 of password reset: verify the code and set a new password.
router.post("/auth/password/reset/confirm", async (req, res) => {
  const { email, otp, password } = (req.body ?? {}) as {
    email?: string;
    otp?: string;
    password?: string;
  };
  if (typeof email !== "string" || !EMAIL_RE.test(email)) {
    res.status(400).json({ error: "Invalid email address" });
    return;
  }
  if (typeof otp !== "string" || otp.trim().length !== 6) {
    res.status(400).json({ error: "Enter the 6-digit code from your email." });
    return;
  }
  if (typeof password !== "string" || password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters." });
    return;
  }

  const normalized = email.toLowerCase().trim();
  const result = verifyOtp(normalized, otp);
  if (result !== "valid") {
    const map = {
      invalid: { code: 422, msg: "Incorrect code. Please try again." },
      expired: { code: 410, msg: "This code has expired. Please request a new one." },
      too_many_attempts: {
        code: 429,
        msg: "Too many incorrect attempts. Please request a new code.",
      },
    } as const;
    const e = map[result];
    res.status(e.code).json({ error: e.msg });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, normalized))
    .limit(1);
  if (!user) {
    res.status(404).json({ error: "No account found for this email." });
    return;
  }
  if (user.deactivatedAt) {
    res
      .status(403)
      .json({ error: "Your account has been deactivated. Please contact support." });
    return;
  }

  if (user.passwordHash) {
    const same = await bcrypt.compare(password, user.passwordHash);
    if (same) {
      res.status(400).json({ error: "New password must be different from your current password." });
      return;
    }
  }

  const hash = await bcrypt.hash(password, 10);
  await db.update(usersTable).set({ passwordHash: hash }).where(eq(usersTable.id, user.id));
  res.json({ ok: true });
});

export default router;
