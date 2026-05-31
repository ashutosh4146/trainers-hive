import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

const FROM = `"Trainers Hive" <${process.env.GMAIL_USER}>`;

export async function sendOtpEmail(to: string, otp: string): Promise<void> {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.warn(`[DEV] OTP for ${to}: ${otp}`);
    return;
  }

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f9fafb;border-radius:12px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:24px">
        <span style="font-size:22px;font-weight:700;color:#0f766e">Trainers Hive</span>
      </div>
      <h2 style="margin:0 0 8px;font-size:20px;color:#111827">Your verification code</h2>
      <p style="margin:0 0 24px;color:#6b7280;font-size:15px">
        Use the code below to verify your email address. It expires in <strong>10 minutes</strong>.
      </p>
      <div style="background:#ffffff;border:2px solid #e5e7eb;border-radius:10px;padding:20px;text-align:center;margin-bottom:24px">
        <span style="font-size:40px;font-weight:700;letter-spacing:12px;color:#0f766e">${otp}</span>
      </div>
      <p style="margin:0;color:#9ca3af;font-size:13px">
        If you did not request this code, you can safely ignore this email.
      </p>
    </div>
  `;

  await transporter.sendMail({
    from: FROM,
    to,
    subject: `${otp} is your Trainers Hive verification code`,
    html,
  });
}

export async function sendPasswordResetEmail(to: string, otp: string): Promise<void> {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.warn(`[DEV] Password reset OTP for ${to}: ${otp}`);
    return;
  }

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f9fafb;border-radius:12px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:24px">
        <span style="font-size:22px;font-weight:700;color:#0f766e">Trainers Hive</span>
      </div>
      <h2 style="margin:0 0 8px;font-size:20px;color:#111827">Reset your password</h2>
      <p style="margin:0 0 24px;color:#6b7280;font-size:15px">
        Use the code below to reset your password. It expires in <strong>10 minutes</strong>.
      </p>
      <div style="background:#ffffff;border:2px solid #e5e7eb;border-radius:10px;padding:20px;text-align:center;margin-bottom:24px">
        <span style="font-size:40px;font-weight:700;letter-spacing:12px;color:#0f766e">${otp}</span>
      </div>
      <p style="margin:0;color:#9ca3af;font-size:13px">
        If you did not request a password reset, you can safely ignore this email.
      </p>
    </div>
  `;

  await transporter.sendMail({
    from: FROM,
    to,
    subject: `${otp} is your Trainers Hive password reset code`,
    html,
  });
}
