import { Router, type IRouter } from "express";
import { createOtp, verifyOtp } from "../lib/otp";
import { sendOtpEmail } from "../lib/email";

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

router.post("/auth/otp/verify", (req, res) => {
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
    case "valid":
      res.json({ valid: true });
      break;
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

export default router;
