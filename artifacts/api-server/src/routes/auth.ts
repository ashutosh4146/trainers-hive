import { Router, type IRouter } from "express";
import { createOtp, verifyOtp } from "../lib/otp";
import { sendOtpEmail } from "../lib/email";
import { createCustomToken } from "../lib/firebase";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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

export default router;
