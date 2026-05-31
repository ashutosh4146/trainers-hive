import nodemailer from "nodemailer";
import { createUnsubscribeToken, type UnsubPrefKey } from "./unsubscribeToken";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

const FROM = `"Trainers Hive" <${process.env.GMAIL_USER}>`;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? process.env.GMAIL_USER ?? "";

function appDomain(): string {
  return process.env.APP_DOMAIN?.trim() ?? "";
}

function buildUnsubscribeUrl(trainerId: string, prefKey: UnsubPrefKey): string {
  const token = createUnsubscribeToken(trainerId, prefKey);
  const domain = appDomain();
  if (!domain) {
    console.warn("[MAIL] APP_DOMAIN is not set — unsubscribe link will be a relative URL and may not work in email clients");
  }
  const base = domain ? `https://${domain}` : "";
  return `${base}/api/trainers/unsubscribe?token=${token}`;
}

function unsubscribeFooter(url: string, label: string): string {
  return `<p style="margin:16px 0 0;color:#9ca3af;font-size:11px">Don't want these emails? <a href="${url}" style="color:#9ca3af;text-decoration:underline">Unsubscribe from ${label}</a>.</p>`;
}

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

export async function notifyTrainerVerificationUpdate(opts: {
  to: string;
  trainerName: string;
  status: "approved" | "rejected" | "needs_info";
  adminNote: string | null;
}): Promise<void> {
  const domain = appDomain();
  const profileUrl = domain ? `https://${domain}/profile` : `/profile`;

  if (opts.status === "approved") {
    const html = wrap(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#047857">You're verified!</h2>
      <p style="margin:0 0 12px;color:#374151">Hi ${opts.trainerName},</p>
      <p style="margin:0 0 16px;color:#374151">Great news — your Trainers Hive verification request has been <strong>approved</strong>. Your profile now displays the verified badge.</p>
      <p style="margin:0 0 8px"><a href="${profileUrl}" style="display:inline-block;padding:10px 18px;border-radius:6px;background:#0ea5e9;color:#fff;text-decoration:none;font-weight:500">View your profile</a></p>
    `);
    await send(opts.to, "Your Trainers Hive verification was approved", html);
    return;
  }

  if (opts.status === "needs_info") {
    const noteHtml = opts.adminNote
      ? `<div style="margin:0 0 16px;padding:12px;border-left:4px solid #f59e0b;background:#fffbeb;color:#78350f"><strong>Admin note:</strong><br/>${escapeHtml(opts.adminNote)}</div>`
      : "";
    const html = wrap(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#b45309">Action needed on your verification</h2>
      <p style="margin:0 0 12px;color:#374151">Hi ${opts.trainerName},</p>
      <p style="margin:0 0 12px;color:#374151">An admin reviewed your verification request and needs a bit more information before approving it.</p>
      ${noteHtml}
      <p style="margin:0 0 16px;color:#374151">Please head to your profile to update the details and resubmit. Your status will stay <strong>pending</strong> until then.</p>
      <p style="margin:0 0 8px"><a href="${profileUrl}" style="display:inline-block;padding:10px 18px;border-radius:6px;background:#f59e0b;color:#fff;text-decoration:none;font-weight:500">Update verification</a></p>
    `);
    await send(opts.to, "Action needed on your Trainers Hive verification", html);
    return;
  }

  // rejected
  const noteHtml = opts.adminNote
    ? `<div style="margin:0 0 16px;padding:12px;border-left:4px solid #dc2626;background:#fef2f2;color:#7f1d1d"><strong>Reason:</strong><br/>${escapeHtml(opts.adminNote)}</div>`
    : "";
  const html = wrap(`
    <h2 style="margin:0 0 8px;font-size:20px;color:#b91c1c">Verification request declined</h2>
    <p style="margin:0 0 12px;color:#374151">Hi ${opts.trainerName},</p>
    <p style="margin:0 0 12px;color:#374151">Unfortunately your verification request couldn't be approved at this time.</p>
    ${noteHtml}
    <p style="margin:0 0 16px;color:#374151">You can reapply from your profile once you've addressed the issue.</p>
    <p style="margin:0 0 8px"><a href="${profileUrl}" style="display:inline-block;padding:10px 18px;border-radius:6px;background:#0ea5e9;color:#fff;text-decoration:none;font-weight:500">Open your profile</a></p>
  `);
  await send(opts.to, "Your Trainers Hive verification was declined", html);
}

export async function notifyVendorVerificationApproved(opts: {
  to: string;
  contactName: string;
  companyName: string;
}): Promise<void> {
  const domain = appDomain();
  const profileUrl = domain ? `https://${domain}/profile` : `/profile`;
  const html = wrap(`
    <h2 style="margin:0 0 8px;font-size:20px;color:#047857">${escapeHtml(opts.companyName)} is verified!</h2>
    <p style="margin:0 0 12px;color:#374151">Hi ${escapeHtml(opts.contactName)},</p>
    <p style="margin:0 0 16px;color:#374151">Great news — <strong>${escapeHtml(opts.companyName)}</strong> has been <strong>verified</strong> on Trainers Hive. Your company profile now displays the verified badge and trainers can see you're an approved organization.</p>
    <p style="margin:0 0 8px"><a href="${profileUrl}" style="display:inline-block;padding:10px 18px;border-radius:6px;background:#0ea5e9;color:#fff;text-decoration:none;font-weight:500">View your company profile</a></p>
  `);
  await send(opts.to, `${opts.companyName} is verified on Trainers Hive`, html);
}

export async function notifyVendorVerificationInfoNeeded(opts: {
  to: string;
  contactName: string;
  companyName: string;
  message: string;
}): Promise<void> {
  const domain = appDomain();
  const profileUrl = domain ? `https://${domain}/profile` : `/profile`;
  const noteHtml = `<div style="margin:0 0 16px;padding:12px;border-left:4px solid #f59e0b;background:#fffbeb;color:#78350f;white-space:pre-wrap"><strong>Admin note:</strong><br/>${escapeHtml(opts.message)}</div>`;
  const html = wrap(`
    <h2 style="margin:0 0 8px;font-size:20px;color:#b45309">Action needed to verify ${escapeHtml(opts.companyName)}</h2>
    <p style="margin:0 0 12px;color:#374151">Hi ${escapeHtml(opts.contactName)},</p>
    <p style="margin:0 0 12px;color:#374151">An admin has reviewed your company profile and needs a bit more information before verifying <strong>${escapeHtml(opts.companyName)}</strong>.</p>
    ${noteHtml}
    <p style="margin:0 0 16px;color:#374151">Please update your company profile with the requested details. Your verification status will stay <strong>pending</strong> until everything is in order.</p>
    <p style="margin:0 0 8px"><a href="${profileUrl}" style="display:inline-block;padding:10px 18px;border-radius:6px;background:#f59e0b;color:#fff;text-decoration:none;font-weight:500">Update your company profile</a></p>
  `);
  await send(opts.to, `Action needed to verify ${opts.companyName} on Trainers Hive`, html);
}

export async function notifyAgreementSubmittedToTrainer(opts: {
  to: string;
  trainerName: string;
  vendorName: string;
  requirementTitle: string;
}): Promise<void> {
  const domain = appDomain();
  const url = domain ? `https://${domain}/agreements` : `/agreements`;
  const html = wrap(`
    <h2 style="margin:0 0 8px;font-size:20px;color:#0f766e">Engagement agreement awaiting your acceptance</h2>
    <p style="margin:0 0 12px;color:#374151">Hi ${escapeHtml(opts.trainerName)},</p>
    <p style="margin:0 0 16px;color:#374151"><strong>${escapeHtml(opts.vendorName)}</strong> has shared an engagement agreement for <strong>${escapeHtml(opts.requirementTitle)}</strong>. Please review the terms and accept or request changes.</p>
    <p style="margin:0 0 8px"><a href="${url}" style="display:inline-block;padding:10px 18px;border-radius:6px;background:#0f766e;color:#fff;text-decoration:none;font-weight:500">Review agreement</a></p>
    <p style="margin:16px 0 0;color:#9ca3af;font-size:11px">Trainers Hive is a facilitator only and is not a party to this agreement.</p>
  `);
  await send(opts.to, `Engagement agreement to review — ${opts.requirementTitle}`, html);
}

export async function notifyAgreementChangesRequested(opts: {
  to: string;
  vendorName: string;
  trainerName: string;
  requirementTitle: string;
  note: string;
}): Promise<void> {
  const domain = appDomain();
  const url = domain ? `https://${domain}/agreements` : `/agreements`;
  const html = wrap(`
    <h2 style="margin:0 0 8px;font-size:20px;color:#b45309">Trainer requested changes to your agreement</h2>
    <p style="margin:0 0 12px;color:#374151">Hi ${escapeHtml(opts.vendorName)},</p>
    <p style="margin:0 0 12px;color:#374151"><strong>${escapeHtml(opts.trainerName)}</strong> has reviewed the engagement agreement for <strong>${escapeHtml(opts.requirementTitle)}</strong> and requested some changes:</p>
    <div style="margin:0 0 16px;padding:12px;border-left:4px solid #f59e0b;background:#fffbeb;color:#78350f;white-space:pre-wrap">${escapeHtml(opts.note)}</div>
    <p style="margin:0 0 16px;color:#374151">The agreement is back in draft. Update the terms and resubmit when ready.</p>
    <p style="margin:0 0 8px"><a href="${url}" style="display:inline-block;padding:10px 18px;border-radius:6px;background:#0f766e;color:#fff;text-decoration:none;font-weight:500">Open agreement</a></p>
  `);
  await send(opts.to, `Changes requested on agreement — ${opts.requirementTitle}`, html);
}

export async function notifyAgreementAccepted(opts: {
  to: string;
  toName: string;
  counterpartyName: string;
  requirementTitle: string;
  agreedFee: number | null;
  feeCurrency: string;
  startDate: string | null;
  endDate: string | null;
  agreementId: string;
}): Promise<void> {
  const domain = appDomain();
  const url = domain ? `https://${domain}/agreements` : `/agreements`;
  const pdfUrl = domain ? `https://${domain}/api/agreements/${opts.agreementId}/pdf` : `/api/agreements/${opts.agreementId}/pdf`;
  const feeLine = opts.agreedFee != null
    ? `${opts.feeCurrency === "INR" ? "₹" : opts.feeCurrency + " "}${opts.agreedFee.toLocaleString("en-IN")}`
    : "To be discussed";
  const dates = opts.startDate && opts.endDate
    ? `${opts.startDate} to ${opts.endDate}`
    : opts.startDate ?? "TBD";
  const html = wrap(`
    <h2 style="margin:0 0 8px;font-size:20px;color:#047857">Engagement agreement signed</h2>
    <p style="margin:0 0 12px;color:#374151">Hi ${escapeHtml(opts.toName)},</p>
    <p style="margin:0 0 16px;color:#374151">Both parties have accepted the engagement agreement for <strong>${escapeHtml(opts.requirementTitle)}</strong> with <strong>${escapeHtml(opts.counterpartyName)}</strong>.</p>
    <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e5e7eb;border-radius:6px;margin:0 0 16px">
      <tr><td style="padding:8px 12px;color:#6b7280;font-size:13px">Fee</td><td style="padding:8px 12px;color:#111827;font-weight:600">${feeLine}</td></tr>
      <tr><td style="padding:8px 12px;color:#6b7280;font-size:13px">Dates</td><td style="padding:8px 12px;color:#111827">${escapeHtml(dates)}</td></tr>
    </table>
    <p style="margin:0 0 8px"><a href="${pdfUrl}" style="display:inline-block;padding:10px 18px;border-radius:6px;background:#0f766e;color:#fff;text-decoration:none;font-weight:500">Download signed PDF</a> &nbsp; <a href="${url}" style="color:#0f766e;font-weight:600;text-decoration:none">View all agreements →</a></p>
    <p style="margin:16px 0 0;color:#9ca3af;font-size:11px">Trainers Hive is a facilitator only. The signed agreement, including timestamps and IP addresses, is retained as audit evidence under Section 65B of the Indian Evidence Act.</p>
  `);
  await send(opts.to, `Engagement agreement signed: ${opts.requirementTitle}`, html);
}

export async function notifyAgreementCancelled(opts: {
  to: string;
  toName: string;
  cancelledByName: string;
  requirementTitle: string;
  reason: string;
}): Promise<void> {
  const reasonHtml = opts.reason
    ? `<div style="margin:0 0 16px;padding:12px;border-left:4px solid #6b7280;background:#f9fafb;color:#374151;white-space:pre-wrap"><strong>Reason:</strong><br/>${escapeHtml(opts.reason)}</div>`
    : "";
  const html = wrap(`
    <h2 style="margin:0 0 8px;font-size:20px;color:#b91c1c">Engagement agreement cancelled</h2>
    <p style="margin:0 0 12px;color:#374151">Hi ${escapeHtml(opts.toName)},</p>
    <p style="margin:0 0 12px;color:#374151"><strong>${escapeHtml(opts.cancelledByName)}</strong> has cancelled the engagement agreement for <strong>${escapeHtml(opts.requirementTitle)}</strong>.</p>
    ${reasonHtml}
    <p style="margin:0;color:#374151">If this was unexpected, please reach out via your in-app messages to discuss.</p>
  `);
  await send(opts.to, `Agreement cancelled — ${opts.requirementTitle}`, html);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function notifyVendorWarning(opts: {
  to: string;
  vendorName: string;
  requirementTitle: string;
  requirementId: string;
  message: string;
}): Promise<void> {
  const domain = appDomain();
  const reqUrl = domain ? `https://${domain}/requirements/${opts.requirementId}` : `/requirements/${opts.requirementId}`;
  const html = wrap(`
    <h2 style="margin:0 0 8px;font-size:20px;color:#b45309">⚠️ Notice about your requirement</h2>
    <p style="margin:0 0 12px;color:#374151">Hi ${opts.vendorName},</p>
    <p style="margin:0 0 16px;color:#374151">
      The Trainers Hive moderation team has reviewed your requirement
      <a href="${reqUrl}" style="color:#0f766e;font-weight:600">"${opts.requirementTitle}"</a>
      and would like to share the following feedback:
    </p>
    <div style="padding:14px 16px;background:#fffbeb;border-left:4px solid #f59e0b;border-radius:6px;color:#78350f;white-space:pre-wrap">${opts.message}</div>
    <p style="margin:20px 0 0;color:#374151">
      Please review and update the requirement if needed. Repeated issues may result in your posting being hidden or removed.
    </p>
    <p style="margin:12px 0 0;color:#6b7280;font-size:13px">— The Trainers Hive team</p>
  `);
  await send(opts.to, `Notice about your Trainers Hive requirement: ${opts.requirementTitle}`, html);
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
  recipientTrainerId?: string;
}): Promise<void> {
  const preview =
    opts.messagePreview.length > 220
      ? opts.messagePreview.slice(0, 220) + "…"
      : opts.messagePreview;
  const unsub = opts.recipientTrainerId
    ? unsubscribeFooter(buildUnsubscribeUrl(opts.recipientTrainerId, "messages"), "message notification emails")
    : "";
  const html = wrap(`
    <h2 style="margin:0 0 8px;font-size:20px;color:#111827">New message from ${opts.fromName}</h2>
    <p style="margin:0 0 16px;color:#6b7280">Regarding: <strong>${opts.requirementTitle}</strong></p>
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:16px;color:#374151;font-size:14px;margin-bottom:20px">
      "${preview}"
    </div>
    <p style="margin:0;color:#6b7280;font-size:14px">Log in to your messages inbox to read and reply.</p>
    ${unsub}
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

export async function notifyTrainerNewEndorsement(opts: {
  trainerEmail: string;
  trainerName: string;
  vendorName: string;
  endorsementSnippet: string;
  profileUrl: string;
  trainerId: string;
}): Promise<void> {
  const snippet =
    opts.endorsementSnippet.length > 220
      ? opts.endorsementSnippet.slice(0, 220) + "…"
      : opts.endorsementSnippet;
  const unsubUrl = buildUnsubscribeUrl(opts.trainerId, "endorsements");
  const html = wrap(`
    <h2 style="margin:0 0 8px;font-size:20px;color:#111827">You received a new endorsement!</h2>
    <p style="margin:0 0 20px;color:#6b7280">Hi <strong>${opts.trainerName}</strong>, <strong>${opts.vendorName}</strong> has endorsed you on Trainers Hive.</p>
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:16px;color:#374151;font-size:14px;margin-bottom:20px">
      "${snippet}"
    </div>
    <p style="margin:0 0 16px;color:#6b7280;font-size:14px">
      <a href="${opts.profileUrl}" style="color:#0f766e;font-weight:600;text-decoration:none">View your profile →</a>
    </p>
    ${unsubscribeFooter(unsubUrl, "endorsement emails")}
  `);
  await send(opts.trainerEmail, `${opts.vendorName} endorsed you on Trainers Hive`, html);
}

export async function notifyTrainerNewRequirementMatch(opts: {
  trainerEmail: string;
  trainerName: string;
  requirementTitle: string;
  vendorName: string;
  skill: string;
  requirementUrl: string;
  trainerId: string;
}): Promise<void> {
  const unsubUrl = buildUnsubscribeUrl(opts.trainerId, "newRequirementMatch");
  const html = wrap(`
    <h2 style="margin:0 0 8px;font-size:20px;color:#111827">New Matching Requirement</h2>
    <p style="margin:0 0 20px;color:#6b7280">Hi <strong>${opts.trainerName}</strong>, a new training opportunity matching your skills has just been posted.</p>
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:20px">
      <p style="margin:0 0 6px;font-weight:600;color:#111827;font-size:15px">${opts.requirementTitle}</p>
      <p style="margin:0 0 4px;color:#6b7280;font-size:14px">Posted by: ${opts.vendorName}</p>
      <p style="margin:0;color:#6b7280;font-size:14px">Skill: ${opts.skill}</p>
    </div>
    <p style="margin:0 0 16px">
      <a href="${opts.requirementUrl}" style="display:inline-block;background:#0f766e;color:#fff;font-weight:600;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px">View Requirement →</a>
    </p>
    ${unsubscribeFooter(unsubUrl, "requirement match emails")}
  `);
  await send(opts.trainerEmail, `New matching requirement: "${opts.requirementTitle}"`, html);
}

export async function notifyTrainerStatusUpdate(opts: {
  trainerEmail: string;
  trainerName: string;
  requirementTitle: string;
  vendorName: string;
  status: "shortlisted" | "hired" | "rejected";
  trainerId: string;
}): Promise<void> {
  const isHired = opts.status === "hired";
  const isRejected = opts.status === "rejected";
  const subject = isHired
    ? `Congratulations! You've been hired for "${opts.requirementTitle}"`
    : isRejected
      ? `Update on your application for "${opts.requirementTitle}"`
      : `You've been shortlisted for "${opts.requirementTitle}"`;
  const unsubUrl = buildUnsubscribeUrl(opts.trainerId, "applicationStatus");
  const unsub = unsubscribeFooter(unsubUrl, "application status emails");
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
    ${unsub}
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
    ${unsub}
  `,
  );
  await send(opts.trainerEmail, subject, html);
}
