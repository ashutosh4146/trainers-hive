import { Router, type IRouter, type Request } from "express";
import {
  db,
  engagementAgreementsTable,
  agreementPaymentsTable,
  applicationsTable,
  requirementsTable,
  vendorsTable,
  trainersTable,
  usersTable,
  type EngagementAgreement,
} from "@workspace/db";
import { eq, and, ne, or, desc, sql, inArray, sum } from "drizzle-orm";
import { z } from "zod";
import {
  UpdateAgreementTermsBody,
  RequestAgreementChangesBody,
  CancelAgreementBody,
} from "@workspace/api-zod";
import { getActiveUserId } from "../lib/session";
import { newId } from "../lib/ids";
import { renderAgreementPdf } from "../lib/agreement-pdf";
import {
  uploadAgreementPdf,
  getAgreementPdfBody,
  isStorageConfigured,
} from "../lib/agreement-storage";
import { messagesTable } from "@workspace/db";
import {
  notifyAgreementSubmittedToTrainer,
  notifyAgreementChangesRequested,
  notifyAgreementAccepted,
  notifyAgreementCancelled,
} from "../lib/mailer";

const router: IRouter = Router();

type ActiveUser = typeof usersTable.$inferSelect;
type Application = typeof applicationsTable.$inferSelect;
type Requirement = typeof requirementsTable.$inferSelect;
type Vendor = typeof vendorsTable.$inferSelect;
type Trainer = typeof trainersTable.$inferSelect;

function clientIp(req: Request): string {
  // Relies on `app.set("trust proxy", 1)` so Express derives req.ip
  // from the trusted proxy's X-Forwarded-For. We do not read the raw
  // header directly to avoid client-side spoofing of audit evidence.
  return req.ip ?? "";
}

function userAgent(req: Request): string {
  return (req.headers["user-agent"] as string | undefined) ?? "";
}

async function loadActiveUser(req: Request): Promise<ActiveUser | null> {
  const id = await getActiveUserId(req);
  const [u] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  return u ?? null;
}

async function loadApplicationContext(applicationId: string): Promise<{
  app: Application;
  reqRow: Requirement;
  vendor: Vendor;
  trainer: Trainer;
} | null> {
  const [app] = await db
    .select()
    .from(applicationsTable)
    .where(eq(applicationsTable.id, applicationId))
    .limit(1);
  if (!app) return null;
  const [reqRow] = await db
    .select()
    .from(requirementsTable)
    .where(eq(requirementsTable.id, app.requirementId))
    .limit(1);
  if (!reqRow) return null;
  const [vendor] = await db
    .select()
    .from(vendorsTable)
    .where(eq(vendorsTable.id, reqRow.vendorId))
    .limit(1);
  if (!vendor) return null;
  const [trainer] = await db
    .select()
    .from(trainersTable)
    .where(eq(trainersTable.id, app.trainerId))
    .limit(1);
  if (!trainer) return null;
  return { app, reqRow, vendor, trainer };
}

function canViewAgreement(user: ActiveUser, vendor: Vendor, trainer: Trainer): boolean {
  if (user.role === "admin") return true;
  if (user.role === "vendor" && user.vendorId === vendor.id) return true;
  if (user.role === "trainer" && user.trainerId === trainer.id) return true;
  return false;
}

function defaultStartIso(reqRow: Requirement): string | null {
  if (reqRow.startDate) return reqRow.startDate.slice(0, 10);
  return null;
}

function defaultEndIso(reqRow: Requirement): string | null {
  const start = reqRow.startDate;
  if (!start) return null;
  const d = new Date(start + (start.includes("T") ? "" : "T00:00:00Z"));
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + Math.max(0, (reqRow.durationDays ?? 1) - 1));
  return d.toISOString().slice(0, 10);
}

function defaultLocationOrMode(reqRow: Requirement): string {
  const mode = reqRow.trainingMode || (reqRow.remote ? "remote" : "in-person");
  return reqRow.location ? `${reqRow.location} (${mode})` : mode;
}

function appendAudit(
  current: EngagementAgreement["auditLog"],
  entry: { actorUserId: string; actorRole: string; action: string; ip?: string; ua?: string; note?: string },
): EngagementAgreement["auditLog"] {
  return [
    ...(current ?? []),
    {
      at: new Date().toISOString(),
      ...entry,
    },
  ];
}

function serialize(
  ag: EngagementAgreement,
  vendor: Vendor,
  trainer: Trainer,
  reqRow: Requirement,
) {
  return {
    id: ag.id,
    applicationId: ag.applicationId,
    requirementId: ag.requirementId,
    vendorId: ag.vendorId,
    trainerId: ag.trainerId,
    status: ag.status as "draft" | "awaiting_trainer" | "accepted" | "cancelled",
    agreedFee: ag.agreedFee,
    feeCurrency: ag.feeCurrency,
    paymentSchedule: ag.paymentSchedule,
    travelBoarding: ag.travelBoarding,
    cancellationNotice: ag.cancellationNotice,
    startDate: ag.startDate,
    endDate: ag.endDate,
    sessionsCount: ag.sessionsCount,
    locationOrMode: ag.locationOrMode,
    deliverables: ag.deliverables,
    confidentialityClause: ag.confidentialityClause,
    ipOwnership: ag.ipOwnership,
    governingLawCity: ag.governingLawCity,
    specialClauses: ag.specialClauses,
    vendorAcceptedAt: ag.vendorAcceptedAt ? ag.vendorAcceptedAt.toISOString() : null,
    vendorAcceptedIp: ag.vendorAcceptedIp,
    trainerAcceptedAt: ag.trainerAcceptedAt ? ag.trainerAcceptedAt.toISOString() : null,
    trainerAcceptedIp: ag.trainerAcceptedIp,
    changesRequestedNote: ag.changesRequestedNote,
    cancelledAt: ag.cancelledAt ? ag.cancelledAt.toISOString() : null,
    cancellationReason: ag.cancellationReason,
    createdAt: ag.createdAt.toISOString(),
    updatedAt: ag.updatedAt.toISOString(),
    vendorName: vendor.companyName,
    trainerName: trainer.name,
    requirementTitle: reqRow.title,
  };
}

async function findOrCreateDraft(
  applicationId: string,
  app: Application,
  reqRow: Requirement,
  vendor: Vendor,
  trainer: Trainer,
  actorUserId: string,
  actorRole: string,
  ip: string,
  ua: string,
): Promise<EngagementAgreement> {
  const [existing] = await db
    .select()
    .from(engagementAgreementsTable)
    .where(eq(engagementAgreementsTable.applicationId, applicationId))
    .limit(1);
  if (existing) return existing;

  const id = newId("eag");
  const now = new Date();
  const fee = app.proposedRate ?? (reqRow.budget > 0 ? reqRow.budget : null);
  const audit = appendAudit([], {
    actorUserId,
    actorRole,
    action: "created_draft",
    ip,
    ua,
  });
  const [created] = await db
    .insert(engagementAgreementsTable)
    .values({
      id,
      applicationId,
      requirementId: reqRow.id,
      vendorId: vendor.id,
      trainerId: trainer.id,
      status: "draft",
      agreedFee: fee,
      feeCurrency: "INR",
      startDate: defaultStartIso(reqRow),
      endDate: defaultEndIso(reqRow),
      sessionsCount: reqRow.durationDays ?? null,
      locationOrMode: defaultLocationOrMode(reqRow),
      deliverables: reqRow.title,
      confidentialityClause: true,
      governingLawCity: "Mumbai",
      cancellationNotice: "Either party may cancel by giving 7 days written notice.",
      paymentSchedule: "50% on engagement start, 50% within 7 days of completion.",
      travelBoarding: reqRow.benefits === "ta-da"
        ? "Travel & boarding to be provided by the vendor."
        : reqRow.benefits === "stay-only"
          ? "Boarding to be provided by the vendor; travel borne by the trainer."
          : "Travel & boarding borne by the trainer unless otherwise agreed.",
      ipOwnership: "Training material developed for this engagement remains the IP of the trainer; learner notes and recordings remain with the vendor.",
      auditLog: audit,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return created!;
}

router.get("/applications/:id/agreement", async (req, res) => {
  const params = z.object({ id: z.string() }).safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid params" });
    return;
  }
  const user = await loadActiveUser(req);
  if (!user) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }
  const ctx = await loadApplicationContext(params.data.id);
  if (!ctx) {
    res.status(404).json({ error: "application not found" });
    return;
  }
  const { app, reqRow, vendor, trainer } = ctx;
  if (!canViewAgreement(user, vendor, trainer)) {
    res.status(403).json({ error: "not allowed" });
    return;
  }

  const [existing] = await db
    .select()
    .from(engagementAgreementsTable)
    .where(eq(engagementAgreementsTable.applicationId, app.id))
    .limit(1);

  if (existing) {
    res.json(serialize(existing, vendor, trainer, reqRow));
    return;
  }

  // Auto-create draft only if hired/completed and the requester is the vendor or admin
  if (app.status !== "hired" && app.status !== "completed") {
    res.status(404).json({ error: "no_agreement", message: "No agreement exists yet for this application." });
    return;
  }
  if (user.role === "trainer") {
    res.status(404).json({ error: "no_agreement", message: "No agreement has been started yet." });
    return;
  }

  const created = await findOrCreateDraft(
    app.id,
    app,
    reqRow,
    vendor,
    trainer,
    user.id,
    user.role,
    clientIp(req),
    userAgent(req),
  );
  res.status(201).json(serialize(created, vendor, trainer, reqRow));
});

router.patch("/agreements/:id", async (req, res) => {
  const params = z.object({ id: z.string() }).safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid params" });
    return;
  }
  const body = UpdateAgreementTermsBody.safeParse(req.body ?? {});
  if (!body.success) {
    res.status(400).json({ error: "invalid body", issues: body.error.issues });
    return;
  }
  const user = await loadActiveUser(req);
  if (!user) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }
  const [ag] = await db
    .select()
    .from(engagementAgreementsTable)
    .where(eq(engagementAgreementsTable.id, params.data.id))
    .limit(1);
  if (!ag) {
    res.status(404).json({ error: "not found" });
    return;
  }
  if (user.role !== "vendor" || user.vendorId !== ag.vendorId) {
    res.status(403).json({ error: "vendor only" });
    return;
  }
  if (ag.status !== "draft") {
    res.status(409).json({ error: "wrong_status", message: "Only draft agreements can be edited." });
    return;
  }

  const audit = appendAudit(ag.auditLog, {
    actorUserId: user.id,
    actorRole: user.role,
    action: "updated_terms",
    ip: clientIp(req),
    ua: userAgent(req),
  });
  const updateValues: Record<string, unknown> = { updatedAt: new Date(), auditLog: audit };
  for (const [k, v] of Object.entries(body.data)) {
    if (v !== undefined) updateValues[k] = v;
  }
  const [updated] = await db
    .update(engagementAgreementsTable)
    .set(updateValues)
    .where(eq(engagementAgreementsTable.id, ag.id))
    .returning();

  const ctx = await loadApplicationContext(ag.applicationId);
  if (!ctx) {
    res.status(500).json({ error: "context_missing" });
    return;
  }
  res.json(serialize(updated!, ctx.vendor, ctx.trainer, ctx.reqRow));
});

router.post("/agreements/:id/submit", async (req, res) => {
  const params = z.object({ id: z.string() }).safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid params" });
    return;
  }
  const user = await loadActiveUser(req);
  if (!user) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }
  const [ag] = await db
    .select()
    .from(engagementAgreementsTable)
    .where(eq(engagementAgreementsTable.id, params.data.id))
    .limit(1);
  if (!ag) {
    res.status(404).json({ error: "not found" });
    return;
  }
  if (user.role !== "vendor" || user.vendorId !== ag.vendorId) {
    res.status(403).json({ error: "vendor only" });
    return;
  }
  if (ag.status !== "draft") {
    res.status(409).json({ error: "wrong_status" });
    return;
  }
  const ip = clientIp(req);
  const ua = userAgent(req);
  const now = new Date();
  const audit = appendAudit(ag.auditLog, {
    actorUserId: user.id,
    actorRole: user.role,
    action: "vendor_submitted",
    ip,
    ua,
  });
  const [updated] = await db
    .update(engagementAgreementsTable)
    .set({
      status: "awaiting_trainer",
      vendorUserId: user.id,
      vendorAcceptedAt: now,
      vendorAcceptedIp: ip,
      vendorAcceptedUa: ua,
      changesRequestedNote: null,
      updatedAt: now,
      auditLog: audit,
    })
    .where(and(
      eq(engagementAgreementsTable.id, ag.id),
      eq(engagementAgreementsTable.status, "draft"),
    ))
    .returning();
  if (!updated) {
    res.status(409).json({ error: "wrong_status" });
    return;
  }

  const ctx = await loadApplicationContext(ag.applicationId);
  if (!ctx) {
    res.status(500).json({ error: "context_missing" });
    return;
  }
  // Notify trainer
  try {
    const [trainerUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.trainerId, ctx.trainer.id))
      .limit(1);
    if (trainerUser?.email) {
      await notifyAgreementSubmittedToTrainer({
        to: trainerUser.email,
        trainerName: ctx.trainer.name,
        vendorName: ctx.vendor.companyName,
        requirementTitle: ctx.reqRow.title,
      });
    }
  } catch (err) {
    req.log.error({ err }, "Failed to email trainer about submitted agreement");
  }

  res.json(serialize(updated!, ctx.vendor, ctx.trainer, ctx.reqRow));
});

router.post("/agreements/:id/accept", async (req, res) => {
  const params = z.object({ id: z.string() }).safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid params" });
    return;
  }
  const user = await loadActiveUser(req);
  if (!user) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }
  const [ag] = await db
    .select()
    .from(engagementAgreementsTable)
    .where(eq(engagementAgreementsTable.id, params.data.id))
    .limit(1);
  if (!ag) {
    res.status(404).json({ error: "not found" });
    return;
  }
  if (user.role !== "trainer" || user.trainerId !== ag.trainerId) {
    res.status(403).json({ error: "trainer only" });
    return;
  }
  if (ag.status !== "awaiting_trainer") {
    res.status(409).json({ error: "wrong_status" });
    return;
  }
  const ip = clientIp(req);
  const ua = userAgent(req);
  const now = new Date();
  const audit = appendAudit(ag.auditLog, {
    actorUserId: user.id,
    actorRole: user.role,
    action: "trainer_accepted",
    ip,
    ua,
  });
  const [updated] = await db
    .update(engagementAgreementsTable)
    .set({
      status: "accepted",
      trainerUserId: user.id,
      trainerAcceptedAt: now,
      trainerAcceptedIp: ip,
      trainerAcceptedUa: ua,
      updatedAt: now,
      auditLog: audit,
    })
    .where(and(
      eq(engagementAgreementsTable.id, ag.id),
      eq(engagementAgreementsTable.status, "awaiting_trainer"),
    ))
    .returning();
  if (!updated) {
    res.status(409).json({ error: "wrong_status" });
    return;
  }

  const ctx = await loadApplicationContext(ag.applicationId);
  if (!ctx) {
    res.status(500).json({ error: "context_missing" });
    return;
  }

  // Look up both party emails once — used for both PDF and notifications.
  const [vendorUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.vendorId, ctx.vendor.id))
    .limit(1);
  const [trainerUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.trainerId, ctx.trainer.id))
    .limit(1);

  // Finalize the click-wrap PDF: render once and upload to object storage so
  // the signed agreement is stable evidence (we no longer regenerate on every
  // download). Fall back to on-demand rendering if storage is not configured
  // or the upload fails — accept must not be blocked by storage outages.
  let finalAg = updated!;
  if (isStorageConfigured()) {
    try {
      const pdf = await renderAgreementPdf({
        ...finalAg,
        vendorName: ctx.vendor.companyName,
        vendorContactName: ctx.vendor.contactName ?? null,
        vendorEmail: vendorUser?.email ?? null,
        trainerName: ctx.trainer.name,
        trainerEmail: trainerUser?.email ?? null,
        requirementTitle: ctx.reqRow.title,
        requirementSkill: ctx.reqRow.skill ?? null,
      });
      const { objectKey } = await uploadAgreementPdf(finalAg.id, pdf);
      const [stamped] = await db
        .update(engagementAgreementsTable)
        .set({ storedPdfKey: objectKey, storedPdfAt: new Date() })
        .where(eq(engagementAgreementsTable.id, finalAg.id))
        .returning();
      if (stamped) finalAg = stamped;
    } catch (err) {
      req.log.error({ err }, "Failed to upload finalized agreement PDF");
    }
  }

  // Email both parties
  try {
    const summary = {
      requirementTitle: ctx.reqRow.title,
      agreedFee: finalAg.agreedFee,
      feeCurrency: finalAg.feeCurrency,
      startDate: finalAg.startDate,
      endDate: finalAg.endDate,
      agreementId: finalAg.id,
    };
    if (vendorUser?.email) {
      await notifyAgreementAccepted({
        to: vendorUser.email,
        toName: ctx.vendor.companyName,
        counterpartyName: ctx.trainer.name,
        ...summary,
      });
    }
    if (trainerUser?.email) {
      await notifyAgreementAccepted({
        to: trainerUser.email,
        toName: ctx.trainer.name,
        counterpartyName: ctx.vendor.companyName,
        ...summary,
      });
    }
  } catch (err) {
    req.log.error({ err }, "Failed to email parties on agreement acceptance");
  }

  res.json(serialize(finalAg, ctx.vendor, ctx.trainer, ctx.reqRow));
});

router.post("/agreements/:id/request-changes", async (req, res) => {
  const params = z.object({ id: z.string() }).safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid params" });
    return;
  }
  const body = RequestAgreementChangesBody.safeParse(req.body ?? {});
  if (!body.success) {
    res.status(400).json({ error: "invalid body" });
    return;
  }
  const user = await loadActiveUser(req);
  if (!user) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }
  const [ag] = await db
    .select()
    .from(engagementAgreementsTable)
    .where(eq(engagementAgreementsTable.id, params.data.id))
    .limit(1);
  if (!ag) {
    res.status(404).json({ error: "not found" });
    return;
  }
  if (user.role !== "trainer" || user.trainerId !== ag.trainerId) {
    res.status(403).json({ error: "trainer only" });
    return;
  }
  if (ag.status !== "awaiting_trainer") {
    res.status(409).json({ error: "wrong_status" });
    return;
  }
  const audit = appendAudit(ag.auditLog, {
    actorUserId: user.id,
    actorRole: user.role,
    action: "trainer_requested_changes",
    ip: clientIp(req),
    ua: userAgent(req),
    note: body.data.note,
  });
  const [updated] = await db
    .update(engagementAgreementsTable)
    .set({
      status: "draft",
      changesRequestedNote: body.data.note,
      vendorAcceptedAt: null,
      vendorAcceptedIp: null,
      vendorAcceptedUa: null,
      updatedAt: new Date(),
      auditLog: audit,
    })
    .where(and(
      eq(engagementAgreementsTable.id, ag.id),
      eq(engagementAgreementsTable.status, "awaiting_trainer"),
    ))
    .returning();
  if (!updated) {
    res.status(409).json({ error: "wrong_status" });
    return;
  }

  const ctx = await loadApplicationContext(ag.applicationId);
  if (!ctx) {
    res.status(500).json({ error: "context_missing" });
    return;
  }
  // Post the trainer's change-request note into the in-app message thread
  // for this application so the vendor sees it in their normal inbox flow,
  // not only via email.
  try {
    await db.insert(messagesTable).values({
      id: newId("msg"),
      applicationId: ctx.app.id,
      senderUserId: user.id,
      body: `Agreement changes requested: ${body.data.note}`,
      createdAt: new Date(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to post change-request message in thread");
  }

  // Notify vendor by email
  try {
    const [vendorUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.vendorId, ctx.vendor.id))
      .limit(1);
    if (vendorUser?.email) {
      await notifyAgreementChangesRequested({
        to: vendorUser.email,
        vendorName: ctx.vendor.companyName,
        trainerName: ctx.trainer.name,
        requirementTitle: ctx.reqRow.title,
        note: body.data.note,
      });
    }
  } catch (err) {
    req.log.error({ err }, "Failed to email vendor about change request");
  }

  res.json(serialize(updated!, ctx.vendor, ctx.trainer, ctx.reqRow));
});

router.post("/agreements/:id/cancel", async (req, res) => {
  const params = z.object({ id: z.string() }).safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid params" });
    return;
  }
  const body = CancelAgreementBody.safeParse(req.body ?? {});
  const reason = body.success ? body.data.reason ?? null : null;
  const user = await loadActiveUser(req);
  if (!user) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }
  const [ag] = await db
    .select()
    .from(engagementAgreementsTable)
    .where(eq(engagementAgreementsTable.id, params.data.id))
    .limit(1);
  if (!ag) {
    res.status(404).json({ error: "not found" });
    return;
  }
  const isVendor = user.role === "vendor" && user.vendorId === ag.vendorId;
  const isTrainer = user.role === "trainer" && user.trainerId === ag.trainerId;
  if (!isVendor && !isTrainer && user.role !== "admin") {
    res.status(403).json({ error: "not allowed" });
    return;
  }
  if (ag.status === "cancelled") {
    res.status(409).json({ error: "already_cancelled" });
    return;
  }
  // An accepted agreement is final and signed by both parties — disallow
  // server-side cancellation to keep the legal/audit semantics consistent
  // with the UI (which already hides the cancel control once accepted).
  if (ag.status === "accepted") {
    res.status(409).json({ error: "already_accepted" });
    return;
  }
  const audit = appendAudit(ag.auditLog, {
    actorUserId: user.id,
    actorRole: user.role,
    action: "cancelled",
    ip: clientIp(req),
    ua: userAgent(req),
    note: reason ?? undefined,
  });
  const now = new Date();
  const [updated] = await db
    .update(engagementAgreementsTable)
    .set({
      status: "cancelled",
      cancelledAt: now,
      cancelledByUserId: user.id,
      cancellationReason: reason,
      updatedAt: now,
      auditLog: audit,
    })
    .where(and(
      eq(engagementAgreementsTable.id, ag.id),
      ne(engagementAgreementsTable.status, "cancelled"),
      ne(engagementAgreementsTable.status, "accepted"),
    ))
    .returning();
  if (!updated) {
    res.status(409).json({ error: "wrong_status" });
    return;
  }

  const ctx = await loadApplicationContext(ag.applicationId);
  if (!ctx) {
    res.status(500).json({ error: "context_missing" });
    return;
  }
  // Notify the other party
  try {
    const [vendorUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.vendorId, ctx.vendor.id))
      .limit(1);
    const [trainerUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.trainerId, ctx.trainer.id))
      .limit(1);
    const otherEmail = isVendor ? trainerUser?.email : vendorUser?.email;
    const otherName = isVendor ? ctx.trainer.name : ctx.vendor.companyName;
    const cancelledByName = isVendor ? ctx.vendor.companyName : ctx.trainer.name;
    if (otherEmail) {
      await notifyAgreementCancelled({
        to: otherEmail,
        toName: otherName,
        cancelledByName,
        requirementTitle: ctx.reqRow.title,
        reason: reason ?? "",
      });
    }
  } catch (err) {
    req.log.error({ err }, "Failed to email party about cancellation");
  }

  res.json(serialize(updated!, ctx.vendor, ctx.trainer, ctx.reqRow));
});

router.get("/my-agreements", async (req, res) => {
  const user = await loadActiveUser(req);
  if (!user) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }

  // Build a properly-typed scope filter so we never have to cast.
  // - vendor: only their own agreements
  // - trainer: only their own agreements
  // - admin: all agreements (use a tautology so the SQL shape stays uniform)
  // - other roles: empty result
  let scope;
  if (user.role === "vendor" && user.vendorId) {
    scope = eq(engagementAgreementsTable.vendorId, user.vendorId);
  } else if (user.role === "trainer" && user.trainerId) {
    scope = eq(engagementAgreementsTable.trainerId, user.trainerId);
  } else if (user.role === "admin") {
    scope = sql`true`;
  } else {
    res.json([]);
    return;
  }

  const rows = await db
    .select({
      ag: engagementAgreementsTable,
      reqTitle: requirementsTable.title,
      vendorName: vendorsTable.companyName,
      trainerName: trainersTable.name,
    })
    .from(engagementAgreementsTable)
    .innerJoin(requirementsTable, eq(requirementsTable.id, engagementAgreementsTable.requirementId))
    .innerJoin(vendorsTable, eq(vendorsTable.id, engagementAgreementsTable.vendorId))
    .innerJoin(trainersTable, eq(trainersTable.id, engagementAgreementsTable.trainerId))
    .where(scope)
    .orderBy(desc(engagementAgreementsTable.updatedAt));

  // Compute total paid per agreement in one query
  const agreementIds = rows.map((r) => r.ag.id);
  const paymentTotals: Record<string, number> = {};
  if (agreementIds.length > 0) {
    const totals = await db
      .select({
        agreementId: agreementPaymentsTable.agreementId,
        total: sum(agreementPaymentsTable.amount),
      })
      .from(agreementPaymentsTable)
      .where(inArray(agreementPaymentsTable.agreementId, agreementIds))
      .groupBy(agreementPaymentsTable.agreementId);
    for (const t of totals) {
      paymentTotals[t.agreementId] = Number(t.total ?? 0);
    }
  }

  const role: "vendor" | "trainer" = user.role === "trainer" ? "trainer" : "vendor";
  res.json(
    rows.map((r) => ({
      id: r.ag.id,
      applicationId: r.ag.applicationId,
      requirementId: r.ag.requirementId,
      requirementTitle: r.reqTitle,
      counterpartyName: role === "vendor" ? r.trainerName : r.vendorName,
      role,
      status: r.ag.status as "draft" | "awaiting_trainer" | "accepted" | "cancelled",
      agreedFee: r.ag.agreedFee,
      startDate: r.ag.startDate,
      endDate: r.ag.endDate,
      paidAmount: paymentTotals[r.ag.id] ?? 0,
      createdAt: r.ag.createdAt.toISOString(),
      updatedAt: r.ag.updatedAt.toISOString(),
    })),
  );
});

const RecordPaymentBody = z.object({
  amount: z.number().int().positive(),
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().max(500).optional().nullable(),
});

router.get("/agreements/:id/payments", async (req, res) => {
  const params = z.object({ id: z.string() }).safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid params" });
    return;
  }
  const user = await loadActiveUser(req);
  if (!user) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }
  const [ag] = await db
    .select()
    .from(engagementAgreementsTable)
    .where(eq(engagementAgreementsTable.id, params.data.id))
    .limit(1);
  if (!ag) {
    res.status(404).json({ error: "not found" });
    return;
  }
  const ctx = await loadApplicationContext(ag.applicationId);
  if (!ctx) {
    res.status(500).json({ error: "context_missing" });
    return;
  }
  if (!canViewAgreement(user, ctx.vendor, ctx.trainer)) {
    res.status(403).json({ error: "not allowed" });
    return;
  }

  const payments = await db
    .select()
    .from(agreementPaymentsTable)
    .where(eq(agreementPaymentsTable.agreementId, ag.id))
    .orderBy(desc(agreementPaymentsTable.paidAt));

  res.json(
    payments.map((p) => ({
      id: p.id,
      agreementId: p.agreementId,
      amount: p.amount,
      currency: p.currency,
      paidAt: p.paidAt,
      note: p.note,
      recordedByUserId: p.recordedByUserId,
      createdAt: p.createdAt.toISOString(),
    })),
  );
});

router.post("/agreements/:id/payments", async (req, res) => {
  const params = z.object({ id: z.string() }).safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid params" });
    return;
  }
  const body = RecordPaymentBody.safeParse(req.body ?? {});
  if (!body.success) {
    res.status(400).json({ error: "invalid body", issues: body.error.issues });
    return;
  }
  const user = await loadActiveUser(req);
  if (!user) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }
  const [ag] = await db
    .select()
    .from(engagementAgreementsTable)
    .where(eq(engagementAgreementsTable.id, params.data.id))
    .limit(1);
  if (!ag) {
    res.status(404).json({ error: "not found" });
    return;
  }
  // Only vendor or admin can record payments
  const isVendor = user.role === "vendor" && user.vendorId === ag.vendorId;
  if (!isVendor && user.role !== "admin") {
    res.status(403).json({ error: "vendor or admin only" });
    return;
  }
  if (ag.status !== "accepted") {
    res.status(409).json({ error: "wrong_status", message: "Payments can only be recorded against accepted agreements." });
    return;
  }

  const id = newId("pmt");
  const [payment] = await db
    .insert(agreementPaymentsTable)
    .values({
      id,
      agreementId: ag.id,
      amount: body.data.amount,
      currency: "INR",
      paidAt: body.data.paidAt,
      note: body.data.note ?? null,
      recordedByUserId: user.id,
      createdAt: new Date(),
    })
    .returning();

  res.status(201).json({
    id: payment!.id,
    agreementId: payment!.agreementId,
    amount: payment!.amount,
    currency: payment!.currency,
    paidAt: payment!.paidAt,
    note: payment!.note,
    recordedByUserId: payment!.recordedByUserId,
    createdAt: payment!.createdAt.toISOString(),
  });
});

const UpdatePaymentBody = z.object({
  amount: z.number().int().positive().optional(),
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  note: z.string().max(500).nullable().optional(),
});

router.patch("/agreements/:id/payments/:paymentId", async (req, res) => {
  const params = z
    .object({ id: z.string(), paymentId: z.string() })
    .safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid params" });
    return;
  }
  const body = UpdatePaymentBody.safeParse(req.body ?? {});
  if (!body.success) {
    res.status(400).json({ error: "invalid body", issues: body.error.issues });
    return;
  }
  if (Object.keys(body.data).length === 0) {
    res.status(400).json({ error: "no fields to update" });
    return;
  }
  const user = await loadActiveUser(req);
  if (!user) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }
  const [ag] = await db
    .select()
    .from(engagementAgreementsTable)
    .where(eq(engagementAgreementsTable.id, params.data.id))
    .limit(1);
  if (!ag) {
    res.status(404).json({ error: "not found" });
    return;
  }
  const isVendor = user.role === "vendor" && user.vendorId === ag.vendorId;
  if (!isVendor && user.role !== "admin") {
    res.status(403).json({ error: "vendor or admin only" });
    return;
  }
  const [payment] = await db
    .select()
    .from(agreementPaymentsTable)
    .where(
      and(
        eq(agreementPaymentsTable.id, params.data.paymentId),
        eq(agreementPaymentsTable.agreementId, ag.id),
      ),
    )
    .limit(1);
  if (!payment) {
    res.status(404).json({ error: "payment not found" });
    return;
  }
  const updates: Record<string, unknown> = {};
  if (body.data.amount !== undefined) updates.amount = body.data.amount;
  if (body.data.paidAt !== undefined) updates.paidAt = body.data.paidAt;
  if ("note" in body.data) updates.note = body.data.note ?? null;
  const [updated] = await db
    .update(agreementPaymentsTable)
    .set(updates)
    .where(eq(agreementPaymentsTable.id, payment.id))
    .returning();
  res.json({
    id: updated!.id,
    agreementId: updated!.agreementId,
    amount: updated!.amount,
    currency: updated!.currency,
    paidAt: updated!.paidAt,
    note: updated!.note,
    recordedByUserId: updated!.recordedByUserId,
    createdAt: updated!.createdAt.toISOString(),
  });
});

router.delete("/agreements/:id/payments/:paymentId", async (req, res) => {
  const params = z
    .object({ id: z.string(), paymentId: z.string() })
    .safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid params" });
    return;
  }
  const user = await loadActiveUser(req);
  if (!user) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }
  const [ag] = await db
    .select()
    .from(engagementAgreementsTable)
    .where(eq(engagementAgreementsTable.id, params.data.id))
    .limit(1);
  if (!ag) {
    res.status(404).json({ error: "not found" });
    return;
  }
  const isVendor = user.role === "vendor" && user.vendorId === ag.vendorId;
  if (!isVendor && user.role !== "admin") {
    res.status(403).json({ error: "vendor or admin only" });
    return;
  }
  const [payment] = await db
    .select()
    .from(agreementPaymentsTable)
    .where(
      and(
        eq(agreementPaymentsTable.id, params.data.paymentId),
        eq(agreementPaymentsTable.agreementId, ag.id),
      ),
    )
    .limit(1);
  if (!payment) {
    res.status(404).json({ error: "payment not found" });
    return;
  }
  await db
    .delete(agreementPaymentsTable)
    .where(eq(agreementPaymentsTable.id, payment.id));
  res.status(204).end();
});

// PDF download (auth required, vendor/trainer/admin party). Not in OpenAPI — binary.
router.get("/agreements/:id/pdf", async (req, res) => {
  const params = z.object({ id: z.string() }).safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid params" });
    return;
  }
  const user = await loadActiveUser(req);
  if (!user) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }
  const [ag] = await db
    .select()
    .from(engagementAgreementsTable)
    .where(eq(engagementAgreementsTable.id, params.data.id))
    .limit(1);
  if (!ag) {
    res.status(404).json({ error: "not found" });
    return;
  }
  const ctx = await loadApplicationContext(ag.applicationId);
  if (!ctx) {
    res.status(500).json({ error: "context_missing" });
    return;
  }
  if (!canViewAgreement(user, ctx.vendor, ctx.trainer)) {
    res.status(403).json({ error: "not allowed" });
    return;
  }

  // If the agreement was finalized on acceptance and uploaded to object
  // storage, stream the immutable stored file back through the API rather
  // than re-rendering on every download. We stream it server-side (instead
  // of redirecting the browser to a presigned S3 URL) so the authenticated
  // fetch stays same-origin and is not blocked by S3 CORS.
  if (ag.storedPdfKey && isStorageConfigured()) {
    try {
      const body = await getAgreementPdfBody(ag.storedPdfKey);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="agreement-${ag.id}.pdf"`,
      );
      res.send(body);
      return;
    } catch (err) {
      req.log.error({ err }, "Failed to fetch stored agreement PDF; falling back to render");
    }
  }

  // Look up emails for the PDF
  const [vendorUser] = await db
    .select({ email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.vendorId, ctx.vendor.id))
    .limit(1);
  const [trainerUser] = await db
    .select({ email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.trainerId, ctx.trainer.id))
    .limit(1);

  const buffer = await renderAgreementPdf({
    ...ag,
    vendorName: ctx.vendor.companyName,
    vendorContactName: ctx.vendor.contactName ?? null,
    vendorEmail: vendorUser?.email ?? null,
    trainerName: ctx.trainer.name,
    trainerEmail: trainerUser?.email ?? null,
    requirementTitle: ctx.reqRow.title,
    requirementSkill: ctx.reqRow.skill ?? null,
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `inline; filename="trainers-hive-agreement-${ag.id}.pdf"`,
  );
  res.send(buffer);
});

export default router;
