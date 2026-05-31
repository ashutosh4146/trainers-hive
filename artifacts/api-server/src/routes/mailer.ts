import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

const FROM = `"Trainers Hive" <${process.env.GMAIL_USER}>`;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? process.env.GMAIL_USER ?? "";

function wrap(content: string): string {
  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#f9fafb;border-radius:12px">
      <div style="margin-bottom:24px">
        <span style="font-size:22px;font-weight:700;color:#0f766e">Trainers Hive</span>
      </div>
      ${content}
      <p style="margin:32px 0 0;color:#9ca3af;font-size:12px">This is an automated notification from Trainers Hive.</p>
    </div>
  `;
}

async function send(to: string, subject: string, html: string): Promise<void> {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.warn(`[MAIL] No Gmail credentials — skipping email to ${to}: ${subject}`);
    return;
  }
  try {
    await transporter.sendMail({ from: FROM, to, subject, html });
  } catch (err) {
    console.error(`[MAIL] Failed to send "${subject}" to ${to}:`, err);
  }
}

export async function notifyAdminNewInquiry(inquiry: {
  companyName: string;
  contactName: string;
  email: string;
  phone?: string | null;
  trainingNeed: string;
  budget?: string | null;
  timeline?: string | null;
  headcount?: number | null;
  location?: string | null;
}): Promise<void> {
  const html = wrap(`
    <h2 style="margin:0 0 8px;font-size:20px;color:#111827">New Hire Inquiry Received</h2>
    <p style="margin:0 0 20px;color:#6b7280">A new company has submitted a training inquiry.</p>
    <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb">
      <tr><td style="padding:10px 16px;font-weight:600;color:#374151;background:#f3f4f6;width:140px">Company</td><td style="padding:10px 16px;color:#111827">${inquiry.companyName}</td></tr>
      <tr><td style="padding:10px 16px;font-weight:600;color:#374151;background:#f3f4f6">Contact</td><td style="padding:10px 16px;color:#111827">${inquiry.contactName}</td></tr>
      <tr><td style="padding:10px 16px;font-weight:600;color:#374151;background:#f3f4f6">Email</td><td style="padding:10px 16px;color:#111827">${inquiry.email}</td></tr>
      ${inquiry.phone ? `<tr><td style="padding:10px 16px;font-weight:600;color:#374151;background:#f3f4f6">Phone</td><td style="padding:10px 16px;color:#111827">${inquiry.phone}</td></tr>` : ""}
      <tr><td style="padding:10px 16px;font-weight:600;color:#374151;background:#f3f4f6">Training Need</td><td style="padding:10px 16px;color:#111827">${inquiry.trainingNeed}</td></tr>
      ${inquiry.budget ? `<tr><td style="padding:10px 16px;font-weight:600;color:#374151;background:#f3f4f6">Budget</td><td style="padding:10px 16px;color:#111827">${inquiry.budget}</td></tr>` : ""}
      ${inquiry.timeline ? `<tr><td style="padding:10px 16px;font-weight:600;color:#374151;background:#f3f4f6">Timeline</td><td style="padding:10px 16px;color:#111827">${inquiry.timeline}</td></tr>` : ""}
      ${inquiry.headcount ? `<tr><td style="padding:10px 16px;font-weight:600;color:#374151;background:#f3f4f6">Headcount</td><td style="padding:10px 16px;color:#111827">${inquiry.headcount}</td></tr>` : ""}
      ${inquiry.location ? `<tr><td style="padding:10px 16px;font-weight:600;color:#374151;background:#f3f4f6">Location</td><td style="padding:10px 16px;color:#111827">${inquiry.location}</td></tr>` : ""}
    </table>
  `);
  await send(ADMIN_EMAIL, `New Hire Inquiry from ${inquiry.companyName}`, html);
}

export async function notifyVendorNewApplication(opts: {
  vendorEmail: string;
  vendorName: string;
  trainerName: string;
  requirementTitle: string;
  proposedRate?: number | null;
  message?: string | null;
}): Promise<void> {
  const html = wrap(`
    <h2 style="margin:0 0 8px;font-size:20px;color:#111827">New Application Received</h2>
    <p style="margin:0 0 20px;color:#6b7280">
      <strong>${opts.trainerName}</strong> has applied to your requirement <strong>${opts.requirementTitle}</strong>.
    </p>
    ${opts.proposedRate ? `<p style="margin:0 0 12px;color:#374151">Proposed Rate: <strong>₹${opts.proposedRate}</strong></p>` : ""}
    ${opts.message ? `<div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:16px;color:#374151;font-size:14px">${opts.message}</div>` : ""}
    <p style="margin:20px 0 0;color:#6b7280;font-size:14px">Log in to your dashboard to review and respond to this application.</p>
  `);
  await send(opts.vendorEmail, `New Application for "${opts.requirementTitle}"`, html);
}

export async function notifyRemovedTrainer(opts: {
  trainerEmail: string;
  trainerName: string;
}): Promise<void> {
  const html = wrap(`
    <h2 style="margin:0 0 8px;font-size:20px;color:#111827">Your Profile Has Been Removed</h2>
    <p style="margin:0 0 20px;color:#6b7280">Hi <strong>${opts.trainerName}</strong>,</p>
    <p style="margin:0 0 16px;color:#374151">Your trainer profile has been removed from the Trainers Hive marketplace by an administrator.</p>
    <p style="margin:0;color:#6b7280;font-size:14px">If you believe this was done in error, please contact our support team.</p>
  `);
  await send(opts.trainerEmail, "Your Trainers Hive profile has been removed", html);
}

export async function notifyRemovedVendor(opts: {
  vendorEmail: string;
  vendorName: string;
}): Promise<void> {
  const html = wrap(`
    <h2 style="margin:0 0 8px;font-size:20px;color:#111827">Your Organisation Has Been Removed</h2>
    <p style="margin:0 0 20px;color:#6b7280">Hi <strong>${opts.vendorName}</strong>,</p>
    <p style="margin:0 0 16px;color:#374151">Your organisation profile on Trainers Hive has been removed by an administrator.</p>
    <p style="margin:0;color:#6b7280;font-size:14px">If you believe this was done in error, please contact our support team.</p>
  `);
  await send(opts.vendorEmail, "Your Trainers Hive organisation has been removed", html);
}

export async function notifyRemovedRequirement(opts: {
  vendorEmail: string;
  vendorName: string;
  requirementTitle: string;
}): Promise<void> {
  const html = wrap(`
    <h2 style="margin:0 0 8px;font-size:20px;color:#111827">Your Training Requirement Has Been Removed</h2>
    <p style="margin:0 0 20px;color:#6b7280">Hi <strong>${opts.vendorName}</strong>,</p>
    <p style="margin:0 0 16px;color:#374151">Your training post <strong>"${opts.requirementTitle}"</strong> has been removed from Trainers Hive by an administrator.</p>
    <p style="margin:0;color:#6b7280;font-size:14px">If you believe this was done in error, please contact our support team.</p>
  `);
  await send(opts.vendorEmail, `Your requirement "${opts.requirementTitle}" has been removed`, html);
}

export async function notifyNewMessage(opts: {
  toEmail: string;
  toName: string;
  fromName: string;
  requirementTitle: string;
  messagePreview: string;
}): Promise<void> {
  const preview =
    opts.messagePreview.length > 220
      ? opts.messagePreview.slice(0, 220) + "…"
      : opts.messagePreview;
  const html = wrap(`
    <h2 style="margin:0 0 8px;font-size:20px;color:#111827">New message from ${opts.fromName}</h2>
    <p style="margin:0 0 16px;color:#6b7280">Regarding: <strong>${opts.requirementTitle}</strong></p>
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:16px;color:#374151;font-size:14px;margin-bottom:20px">
      "${preview}"
    </div>
    <p style="margin:0;color:#6b7280;font-size:14px">Log in to your messages inbox to read and reply.</p>
  `);
  await send(
    opts.toEmail,
    `New message from ${opts.fromName} — ${opts.requirementTitle}`,
    html,
  );
}

export async function notifyVendorTrainerWithdrew(opts: {
  vendorEmail: string;
  vendorName: string;
  trainerName: string;
  requirementTitle: string;
  reason?: string | null;
}): Promise<void> {
  const html = wrap(`
    <h2 style="margin:0 0 8px;font-size:20px;color:#111827">Trainer Withdrew Application</h2>
    <p style="margin:0 0 20px;color:#6b7280">
      <strong>${opts.trainerName}</strong> has withdrawn their application for <strong>${opts.requirementTitle}</strong>.
    </p>
    ${opts.reason ? `<div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:16px;color:#374151;font-size:14px;margin-bottom:16px"><strong>Reason:</strong> ${opts.reason}</div>` : ""}
    <p style="margin:0;color:#6b7280;font-size:14px">Log in to your dashboard to view the requirement and consider reopening it if needed.</p>
  `);
  await send(
    opts.vendorEmail,
    `${opts.trainerName} withdrew from "${opts.requirementTitle}"`,
    html,
  );
}

export async function notifyTrainerStatusUpdate(opts: {
  trainerEmail: string;
  trainerName: string;
  requirementTitle: string;
  vendorName: string;
  status: "shortlisted" | "hired" | "rejected";
}): Promise<void> {
  const isHired = opts.status === "hired";
  const isRejected = opts.status === "rejected";
  const subject = isHired
    ? `Congratulations! You've been hired for "${opts.requirementTitle}"`
    : isRejected
      ? `Update on your application for "${opts.requirementTitle}"`
      : `You've been shortlisted for "${opts.requirementTitle}"`;
  const html = wrap(
    isRejected
      ? `
    <h2 style="margin:0 0 8px;font-size:20px;color:#111827">Application Update</h2>
    <p style="margin:0 0 20px;color:#6b7280">
      Hi <strong>${opts.trainerName}</strong>, thank you for applying to <strong>${opts.requirementTitle}</strong> with <strong>${opts.vendorName}</strong>.
    </p>
    <div style="background:#fff;border:2px solid #6b7280;border-radius:10px;padding:20px;text-align:center;margin-bottom:20px">
      <span style="font-size:18px;font-weight:700;color:#6b7280">NOT SELECTED</span>
      <p style="margin:8px 0 0;color:#374151;font-size:15px">${opts.requirementTitle}</p>
    </div>
    <p style="margin:0;color:#6b7280;font-size:14px">We wish you the best of luck with future opportunities on Trainers Hive.</p>
  `
      : `
    <h2 style="margin:0 0 8px;font-size:20px;color:#111827">
      ${isHired ? "You've been Hired!" : "You've been Shortlisted!"}
    </h2>
    <p style="margin:0 0 20px;color:#6b7280">
      Hi <strong>${opts.trainerName}</strong>, great news from <strong>${opts.vendorName}</strong>!
    </p>
    <div style="background:#fff;border:2px solid ${isHired ? "#0f766e" : "#f59e0b"};border-radius:10px;padding:20px;text-align:center;margin-bottom:20px">
      <span style="font-size:18px;font-weight:700;color:${isHired ? "#0f766e" : "#f59e0b"}">
        ${isHired ? "HIRED" : "SHORTLISTED"}
      </span>
      <p style="margin:8px 0 0;color:#374151;font-size:15px">${opts.requirementTitle}</p>
    </div>
    <p style="margin:0;color:#6b7280;font-size:14px">Log in to your dashboard to view more details.</p>
  `,
  );
  await send(opts.trainerEmail, subject, html);
}
