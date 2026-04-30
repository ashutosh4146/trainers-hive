import { Router, type IRouter } from "express";
import { createOtp, verifyOtp } from "../lib/otp";
import { sendOtpEmail } from "../lib/email";
import { createCustomToken } from "../lib/firebase";
import { getActiveUserId } from "../lib/session";
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

  try {
    const uid = `admin_${adminEmail.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
    const customToken = await createCustomToken(uid, { email: adminEmail });

    const [adminUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.role, "admin"))
      .limit(1);

    res.json({
      customToken,
      adminEmail,
      user: adminUser
        ? { id: adminUser.id, name: adminUser.name, email: adminUser.email, role: adminUser.role }
        : null,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to create admin session." });
  }
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

  // Always set the server-side session so login works even if Firebase is misconfigured
  const { setActiveUserId } = await import("../lib/session.js");
  await setActiveUserId(user.id);

  let customToken: string | null = null;
  try {
    const uid = user.email.toLowerCase().replace(/[^a-z0-9]/g, "_");
    customToken = await createCustomToken(uid, { email: user.email });
  } catch (_err) {
    // Firebase token generation failed — session cookie auth will still work
  }

  res.json({
    customToken,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, trainerId: user.trainerId, vendorId: user.vendorId },
  });
});

export default router;
