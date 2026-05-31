import { Router, type IRouter } from "express";
import {
  db,
  applicationsTable,
  requirementsTable,
  vendorsTable,
  usersTable,
  activityTable,
  trainersTable,
  messagesTable,
} from "@workspace/db";

import { eq, desc, sql, asc, and, ne, inArray, gt } from "drizzle-orm";
import {
  UpdateApplicationStatusParams,
  UpdateApplicationStatusBody,
  ListApplicationMessagesParams,
  SendApplicationMessageParams,
  SendApplicationMessageBody,
} from "@workspace/api-zod";
import { z } from "zod";
import { getActiveUserId } from "../lib/session";
import { newId } from "../lib/ids";
import { notifyTrainerStatusUpdate, notifyNewMessage, notifyVendorTrainerWithdrew } from "../lib/mailer";
import { ensureAgreementDraftForApplication } from "../lib/agreement-bootstrap";
import { resolveVendorEmailPrefs } from "../lib/vendor-email-prefs";

const router: IRouter = Router();

router.patch("/applications/:id/note", async (req, res) => {
  const params = z.object({ id: z.string() }).safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid params" });
    return;
  }
  const body = z.object({ note: z.string() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "invalid body" });
    return;
  }

  const activeId = await getActiveUserId(req);
  const [active] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, activeId))
    .limit(1);
  if (!active || active.role !== "vendor" || !active.vendorId) {
    res.status(403).json({ error: "vendor only" });
    return;
  }

  const [app] = await db
    .select()
    .from(applicationsTable)
    .where(eq(applicationsTable.id, params.data.id))
    .limit(1);
  if (!app) {
    res.status(404).json({ error: "application not found" });
    return;
  }

  const [reqRow] = await db
    .select()
    .from(requirementsTable)
    .where(eq(requirementsTable.id, app.requirementId))
    .limit(1);
  if (!reqRow || reqRow.vendorId !== active.vendorId) {
    res.status(403).json({ error: "not your requirement" });
    return;
  }

  const noteValue = body.data.note.trim() || null;
  await db
    .update(applicationsTable)
    .set({ vendorNote: noteValue })
    .where(eq(applicationsTable.id, app.id));

  const [updated] = await db
    .select()
    .from(applicationsTable)
    .where(eq(applicationsTable.id, app.id))
    .limit(1);

  res.json({
    id: updated!.id,
    requirementId: updated!.requirementId,
    trainerId: updated!.trainerId,
    status: updated!.status,
    message: updated!.message,
    proposedRate: updated!.proposedRate,
    withdrawnReason: updated!.withdrawnReason ?? undefined,
    vendorNote: updated!.vendorNote ?? undefined,
    createdAt: updated!.createdAt.toISOString(),
  });
});

router.post("/applications/:id/complete", async (req, res) => {
  const params = z.object({ id: z.string() }).safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid params" });
    return;
  }

  const activeId = await getActiveUserId(req);
  const [active] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, activeId))
    .limit(1);
  if (!active || active.role !== "vendor" || !active.vendorId) {
    res.status(403).json({ error: "vendor only" });
    return;
  }

  const [app] = await db
    .select()
    .from(applicationsTable)
    .where(eq(applicationsTable.id, params.data.id))
    .limit(1);
  if (!app) {
    res.status(404).json({ error: "application not found" });
    return;
  }

  const [reqRow] = await db
    .select()
    .from(requirementsTable)
    .where(eq(requirementsTable.id, app.requirementId))
    .limit(1);
  if (!reqRow || reqRow.vendorId !== active.vendorId) {
    res.status(403).json({ error: "not your requirement" });
    return;
  }

  let completed: typeof applicationsTable.$inferSelect | undefined;
  try {
    await db.transaction(async (tx) => {
      const now = new Date();
      const [result] = await tx
        .update(applicationsTable)
        .set({ status: "completed", completedAt: now })
        .where(and(eq(applicationsTable.id, app.id), eq(applicationsTable.status, "hired")))
        .returning();

      if (!result) {
        throw new Error("not_hired");
      }
      completed = result;

      await tx
        .update(trainersTable)
        .set({ completedTrainings: sql`${trainersTable.completedTrainings} + 1` })
        .where(eq(trainersTable.id, app.trainerId));

      await tx
        .update(requirementsTable)
        .set({ status: "closed" })
        .where(eq(requirementsTable.id, reqRow.id));
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "not_hired") {
      res.status(409).json({ error: "application_not_hired", message: "Only hired applications can be marked as completed." });
      return;
    }
    throw err;
  }

  res.json({
    id: completed!.id,
    requirementId: completed!.requirementId,
    trainerId: completed!.trainerId,
    status: completed!.status,
    message: completed!.message,
    proposedRate: completed!.proposedRate,
    withdrawnReason: completed!.withdrawnReason ?? undefined,
    vendorNote: completed!.vendorNote ?? undefined,
    completedAt: completed!.completedAt?.toISOString() ?? undefined,
    createdAt: completed!.createdAt.toISOString(),
  });
});

router.post("/applications/:id/withdraw", async (req, res) => {
  const params = z.object({ id: z.string() }).safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid params" });
    return;
  }
  const body = z.object({ reason: z.string().optional() }).safeParse(req.body ?? {});
  const reason = body.success ? body.data.reason : undefined;

  const activeId = await getActiveUserId(req);
  const [active] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, activeId))
    .limit(1);
  if (!active || active.role !== "trainer" || !active.trainerId) {
    res.status(403).json({ error: "not allowed" });
    return;
  }

  const [app] = await db
    .select()
    .from(applicationsTable)
    .where(eq(applicationsTable.id, params.data.id))
    .limit(1);
  if (!app) {
    res.status(404).json({ error: "application not found" });
    return;
  }
  if (app.trainerId !== active.trainerId) {
    res.status(403).json({ error: "not your application" });
    return;
  }
  if (app.status === "withdrawn" || app.status === "rejected") {
    res.status(409).json({ error: "cannot withdraw from this status" });
    return;
  }

  const previousStatus = app.status;

  await db
    .update(applicationsTable)
    .set({ status: "withdrawn", withdrawnReason: reason ?? null })
    .where(eq(applicationsTable.id, app.id));

  // Notify vendor whenever a trainer withdraws (submitted, shortlisted, or hired)
  if (previousStatus !== "withdrawn" && previousStatus !== "rejected") {
    const [reqRow] = await db
      .select({ r: requirementsTable, v: vendorsTable })
      .from(requirementsTable)
      .leftJoin(vendorsTable, eq(requirementsTable.vendorId, vendorsTable.id))
      .where(eq(requirementsTable.id, app.requirementId))
      .limit(1);
    const [trainer] = await db
      .select()
      .from(trainersTable)
      .where(eq(trainersTable.id, app.trainerId))
      .limit(1);
    const vendorEmailPrefs = resolveVendorEmailPrefs(reqRow?.v?.emailPrefs);
    if (reqRow?.v?.email && reqRow.r && vendorEmailPrefs.trainerWithdrew !== false) {
      notifyVendorTrainerWithdrew({
        vendorEmail: reqRow.v.email,
        vendorName: reqRow.v.companyName,
        trainerName: trainer?.name ?? "The trainer",
        requirementTitle: reqRow.r.title,
        reason,
      }).catch(() => {});
    }
  }

  const [updated] = await db
    .select()
    .from(applicationsTable)
    .where(eq(applicationsTable.id, app.id))
    .limit(1);
  res.json({
    id: updated!.id,
    requirementId: updated!.requirementId,
    trainerId: updated!.trainerId,
    status: updated!.status,
    message: updated!.message,
    proposedRate: updated!.proposedRate,
    withdrawnReason: updated!.withdrawnReason ?? undefined,
    createdAt: updated!.createdAt.toISOString(),
  });
});

router.get("/applications", async (req, res) => {
  const activeId = await getActiveUserId(req);
  const [active] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, activeId))
    .limit(1);
  if (!active || active.role !== "trainer" || !active.trainerId) {
    res.json([]);
    return;
  }
  const rows = await db
    .select({ app: applicationsTable, req: requirementsTable, vendor: vendorsTable })
    .from(applicationsTable)
    .leftJoin(requirementsTable, eq(applicationsTable.requirementId, requirementsTable.id))
    .leftJoin(vendorsTable, eq(requirementsTable.vendorId, vendorsTable.id))
    .where(eq(applicationsTable.trainerId, active.trainerId))
    .orderBy(desc(applicationsTable.createdAt));

  const reqIds = rows.map((r) => r.req?.id).filter((x): x is string => Boolean(x));
  const counts =
    reqIds.length > 0
      ? await db
          .select({
            requirementId: applicationsTable.requirementId,
            count: sql<number>`COUNT(*)::int`,
          })
          .from(applicationsTable)
          .where(sql`${applicationsTable.requirementId} IN ${reqIds}`)
          .groupBy(applicationsTable.requirementId)
      : [];
  const cMap = new Map(counts.map((c) => [c.requirementId, c.count]));

  res.json(
    rows
      .filter((r) => r.req)
      .map((r) => ({
        id: r.app.id,
        requirementId: r.app.requirementId,
        trainerId: r.app.trainerId,
        status: r.app.status,
        message: r.app.message,
        proposedRate: r.app.proposedRate,
        withdrawnReason: r.app.withdrawnReason ?? undefined,
        createdAt: r.app.createdAt.toISOString(),
        requirement: {
          id: r.req!.id,
          vendorId: r.req!.vendorId,
          vendorName: r.vendor?.companyName ?? "Unknown",
          vendorLogoUrl: r.vendor?.logoUrl ?? "",
          title: r.req!.title,
          skill: r.req!.skill,
          subSkills: r.req!.subSkills ?? [],
          durationDays: r.req!.durationDays,
          budget: r.req!.budget,
          feeType: r.req!.feeType,
          location: r.req!.location,
          remote: r.req!.remote,
          deadline: r.req!.deadline.toISOString(),
          status: r.req!.status,
          createdAt: r.req!.createdAt.toISOString(),
          applicationCount: cMap.get(r.req!.id) ?? 0,
        },
      })),
  );
});

router.patch("/applications/:id", async (req, res) => {
  const params = UpdateApplicationStatusParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid params" });
    return;
  }
  const body = UpdateApplicationStatusBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "invalid body", details: body.error.issues });
    return;
  }
  if (body.data.status === "completed") {
    res.status(400).json({ error: "use_complete_endpoint", message: "Use POST /applications/:id/complete to mark training as completed." });
    return;
  }
  const activeId = await getActiveUserId(req);
  const [existing] = await db
    .select()
    .from(applicationsTable)
    .where(eq(applicationsTable.id, params.data.id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "application not found" });
    return;
  }
  const statusUpdate: Partial<typeof applicationsTable.$inferInsert> = { status: body.data.status };
  if (body.data.status === "hired" && existing.hiredAt === null) {
    statusUpdate.hiredAt = new Date();
  }
  await db
    .update(applicationsTable)
    .set(statusUpdate)
    .where(eq(applicationsTable.id, params.data.id));
  const [a] = await db
    .select()
    .from(applicationsTable)
    .where(eq(applicationsTable.id, params.data.id))
    .limit(1);
  if (!a) {
    res.status(404).json({ error: "application not found" });
    return;
  }
  // Activity feed + inbox notification + email
  const [trainer] = await db
    .select()
    .from(trainersTable)
    .where(eq(trainersTable.id, a.trainerId))
    .limit(1);
  if (body.data.status === "hired") {
    // Pre-create a draft engagement agreement so the vendor can immediately
    // open it from the requirement page instead of seeing an empty state.
    // Failures are logged but never block the hire transition.
    try {
      await ensureAgreementDraftForApplication(a.id, activeId, "vendor");
    } catch (err) {
      req.log.error({ err, applicationId: a.id }, "Failed to bootstrap engagement agreement draft on hire");
    }
  }
  if (body.data.status === "shortlisted" || body.data.status === "hired") {
    await db.insert(activityTable).values({
      id: newId("act"),
      type: body.data.status === "hired" ? "hire" : "application",
      title:
        body.data.status === "hired"
          ? `${trainer?.name ?? "Trainer"} was hired`
          : `${trainer?.name ?? "Trainer"} was shortlisted`,
      subtitle: "",
      avatarUrl: trainer?.avatarUrl,
    });
    const [req] = await db
      .select({ r: requirementsTable, v: vendorsTable })
      .from(requirementsTable)
      .leftJoin(vendorsTable, eq(requirementsTable.vendorId, vendorsTable.id))
      .where(eq(requirementsTable.id, a.requirementId))
      .limit(1);
    // Insert system message so trainer sees an inbox notification
    if (req?.r) {
      const systemMsg =
        body.data.status === "shortlisted"
          ? `Good news! You have been shortlisted for "${req.r.title}". The vendor may reach out with more details.`
          : `Congratulations! You have been selected for "${req.r.title}". The vendor will be in touch shortly.`;
      await db.insert(messagesTable).values({
        id: newId("msg"),
        applicationId: a.id,
        senderUserId: activeId,
        body: systemMsg,
        createdAt: new Date(),
      });
    }
    const [trainerUser, trainerPrefsRow] = await Promise.all([
      db.select().from(usersTable).where(eq(usersTable.trainerId, a.trainerId)).limit(1).then(r => r[0]),
      db.select({ emailPrefs: trainersTable.emailPrefs }).from(trainersTable).where(eq(trainersTable.id, a.trainerId)).limit(1).then(r => r[0]),
    ]);
    const trainerEmailPrefs = trainerPrefsRow?.emailPrefs ?? { endorsements: true, applicationStatus: true, newRequirementMatch: true, messages: true };
    if (trainerUser?.email && req?.r && trainerEmailPrefs.applicationStatus !== false) {
      notifyTrainerStatusUpdate({
        trainerEmail: trainerUser.email,
        trainerName: trainer?.name ?? "Trainer",
        requirementTitle: req.r.title,
        vendorName: req.v?.companyName ?? "the vendor",
        status: body.data.status,
        trainerId: a.trainerId,
      }).catch(() => {});
    }
  }
  res.json({
    id: a.id,
    requirementId: a.requirementId,
    trainerId: a.trainerId,
    status: a.status,
    message: a.message,
    proposedRate: a.proposedRate,
    createdAt: a.createdAt.toISOString(),
  });
});

router.get("/applications/:id/messages", async (req, res) => {
  const params = ListApplicationMessagesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid params" });
    return;
  }
  const activeId = await getActiveUserId(req);
  const [active] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, activeId))
    .limit(1);
  if (!active) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }
  const [app] = await db
    .select()
    .from(applicationsTable)
    .where(eq(applicationsTable.id, params.data.id))
    .limit(1);
  if (!app) {
    res.status(404).json({ error: "application not found" });
    return;
  }
  const isTrainerOwner = active.role === "trainer" && active.trainerId === app.trainerId;
  let isVendorOwner = false;
  if (active.role === "vendor" && active.vendorId) {
    const [req2] = await db
      .select()
      .from(requirementsTable)
      .where(eq(requirementsTable.id, app.requirementId))
      .limit(1);
    isVendorOwner = req2?.vendorId === active.vendorId;
  }
  if (!isTrainerOwner && !isVendorOwner) {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  if (app.status !== "shortlisted" && app.status !== "hired") {
    res.status(409).json({ error: "messaging_not_available", message: "Messaging is only available for shortlisted or hired applications." });
    return;
  }
  const messages = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.applicationId, params.data.id))
    .orderBy(asc(messagesTable.createdAt), asc(messagesTable.id));
  res.json(
    messages.map((m) => ({
      id: m.id,
      applicationId: m.applicationId,
      senderUserId: m.senderUserId,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
    })),
  );
});

router.post("/applications/:id/messages", async (req, res) => {
  const params = SendApplicationMessageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid params" });
    return;
  }
  const body = SendApplicationMessageBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "invalid body", details: body.error.issues });
    return;
  }
  if (!body.data.body.trim()) {
    res.status(400).json({ error: "message body cannot be empty" });
    return;
  }
  const activeId = await getActiveUserId(req);
  const [active] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, activeId))
    .limit(1);
  if (!active) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }
  const [app] = await db
    .select()
    .from(applicationsTable)
    .where(eq(applicationsTable.id, params.data.id))
    .limit(1);
  if (!app) {
    res.status(404).json({ error: "application not found" });
    return;
  }
  const isTrainerOwner = active.role === "trainer" && active.trainerId === app.trainerId;
  let isVendorOwner = false;
  if (active.role === "vendor" && active.vendorId) {
    const [req2] = await db
      .select()
      .from(requirementsTable)
      .where(eq(requirementsTable.id, app.requirementId))
      .limit(1);
    isVendorOwner = req2?.vendorId === active.vendorId;
  }
  if (!isTrainerOwner && !isVendorOwner) {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  if (app.status !== "shortlisted" && app.status !== "hired") {
    res.status(409).json({ error: "messaging_not_available", message: "Messaging is only available for shortlisted or hired applications." });
    return;
  }
  const [msg] = await db
    .insert(messagesTable)
    .values({
      id: newId("msg"),
      applicationId: params.data.id,
      senderUserId: active.id,
      body: body.data.body.trim(),
    })
    .returning();
  res.status(201).json({
    id: msg!.id,
    applicationId: msg!.applicationId,
    senderUserId: msg!.senderUserId,
    body: msg!.body,
    createdAt: msg!.createdAt.toISOString(),
  });

  // Fire-and-forget email notification to the other party
  const msgBody = body.data.body.trim();
  const appReqId = app.requirementId;
  const appTrainerId = app.trainerId;
  (async () => {
    try {
      const [reqRow] = await db
        .select({ title: requirementsTable.title, vendorId: requirementsTable.vendorId })
        .from(requirementsTable)
        .where(eq(requirementsTable.id, appReqId))
        .limit(1);
      if (!reqRow) return;

      if (isTrainerOwner) {
        const [vendorUser] = await db
          .select({ email: usersTable.email, companyName: vendorsTable.companyName, emailPrefs: vendorsTable.emailPrefs })
          .from(usersTable)
          .innerJoin(vendorsTable, eq(vendorsTable.id, usersTable.vendorId!))
          .where(eq(usersTable.vendorId, reqRow.vendorId))
          .limit(1);
        const [trainerRow] = await db
          .select({ name: trainersTable.name })
          .from(trainersTable)
          .where(eq(trainersTable.id, appTrainerId))
          .limit(1);
        const vendorMsgPrefs = resolveVendorEmailPrefs(vendorUser?.emailPrefs);
        if (vendorUser && trainerRow && vendorMsgPrefs.messages !== false) {
          await notifyNewMessage({
            toEmail: vendorUser.email,
            toName: vendorUser.companyName ?? "Vendor",
            fromName: trainerRow.name,
            requirementTitle: reqRow.title,
            messagePreview: msgBody,
          });
        }
      } else if (isVendorOwner) {
        const [[trainerUser], [trainerRow], [vendorRow], [trainerMsgPrefsRow]] = await Promise.all([
          db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.trainerId, appTrainerId)).limit(1),
          db.select({ name: trainersTable.name }).from(trainersTable).where(eq(trainersTable.id, appTrainerId)).limit(1),
          db.select({ companyName: vendorsTable.companyName }).from(vendorsTable).where(eq(vendorsTable.id, reqRow.vendorId)).limit(1),
          db.select({ emailPrefs: trainersTable.emailPrefs }).from(trainersTable).where(eq(trainersTable.id, appTrainerId)).limit(1),
        ]);
        const trainerMsgPrefs = trainerMsgPrefsRow?.emailPrefs ?? { endorsements: true, applicationStatus: true, newRequirementMatch: true, messages: true };
        if (trainerUser && trainerRow && vendorRow && trainerMsgPrefs.messages !== false) {
          await notifyNewMessage({
            toEmail: trainerUser.email,
            toName: trainerRow.name,
            fromName: vendorRow.companyName ?? "Vendor",
            requirementTitle: reqRow.title,
            messagePreview: msgBody,
            recipientTrainerId: appTrainerId,
          });
        }
      }
    } catch {
      // swallow — email notification is best-effort
    }
  })();
});

router.get("/messages/threads", async (req, res) => {
  const activeId = await getActiveUserId(req);
  const [active] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, activeId))
    .limit(1);
  if (!active) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }

  type ThreadRow = {
    applicationId: string;
    requirementId: string;
    requirementTitle: string;
    otherPartyName: string;
    otherPartyAvatarUrl: string;
    status: string;
    appCreatedAt: Date;
  };

  let rows: ThreadRow[] = [];

  if (active.trainerId) {
    const data = await db
      .select({
        applicationId: applicationsTable.id,
        requirementId: requirementsTable.id,
        requirementTitle: requirementsTable.title,
        otherPartyName: vendorsTable.companyName,
        otherPartyAvatarUrl: vendorsTable.logoUrl,
        status: applicationsTable.status,
        appCreatedAt: applicationsTable.createdAt,
      })
      .from(applicationsTable)
      .innerJoin(requirementsTable, eq(applicationsTable.requirementId, requirementsTable.id))
      .innerJoin(vendorsTable, eq(requirementsTable.vendorId, vendorsTable.id))
      .where(
        and(
          eq(applicationsTable.trainerId, active.trainerId),
          inArray(applicationsTable.status, ["shortlisted", "hired"]),
        ),
      );
    rows = data.map((r) => ({
      applicationId: r.applicationId,
      requirementId: r.requirementId,
      requirementTitle: r.requirementTitle,
      otherPartyName: r.otherPartyName ?? "Unknown",
      otherPartyAvatarUrl: r.otherPartyAvatarUrl ?? "",
      status: r.status,
      appCreatedAt: r.appCreatedAt,
    }));
  } else if (active.vendorId) {
    const data = await db
      .select({
        applicationId: applicationsTable.id,
        requirementId: requirementsTable.id,
        requirementTitle: requirementsTable.title,
        otherPartyName: trainersTable.name,
        otherPartyAvatarUrl: trainersTable.avatarUrl,
        status: applicationsTable.status,
        appCreatedAt: applicationsTable.createdAt,
      })
      .from(applicationsTable)
      .innerJoin(requirementsTable, eq(applicationsTable.requirementId, requirementsTable.id))
      .innerJoin(trainersTable, eq(applicationsTable.trainerId, trainersTable.id))
      .where(
        and(
          eq(requirementsTable.vendorId, active.vendorId),
          inArray(applicationsTable.status, ["shortlisted", "hired"]),
        ),
      );
    rows = data.map((r) => ({
      applicationId: r.applicationId,
      requirementId: r.requirementId,
      requirementTitle: r.requirementTitle,
      otherPartyName: r.otherPartyName ?? "Unknown",
      otherPartyAvatarUrl: r.otherPartyAvatarUrl ?? "",
      status: r.status,
      appCreatedAt: r.appCreatedAt,
    }));
  }

  if (rows.length === 0) {
    res.json([]);
    return;
  }

  // Fetch last message per application
  const appIds = rows.map((r) => r.applicationId);
  const lastMsgs = await db
    .select({
      applicationId: messagesTable.applicationId,
      body: messagesTable.body,
      createdAt: messagesTable.createdAt,
      senderUserId: messagesTable.senderUserId,
    })
    .from(messagesTable)
    .where(inArray(messagesTable.applicationId, appIds))
    .orderBy(desc(messagesTable.createdAt), desc(messagesTable.id));

  // Keep only the first (latest) message per applicationId
  const lastMsgMap = new Map<string, { body: string; createdAt: Date; senderUserId: string }>();
  for (const m of lastMsgs) {
    if (!lastMsgMap.has(m.applicationId)) {
      lastMsgMap.set(m.applicationId, {
        body: m.body,
        createdAt: m.createdAt,
        senderUserId: m.senderUserId,
      });
    }
  }

  const result = rows
    .map((r) => {
      const last = lastMsgMap.get(r.applicationId);
      return {
        applicationId: r.applicationId,
        requirementId: r.requirementId,
        requirementTitle: r.requirementTitle,
        otherPartyName: r.otherPartyName,
        otherPartyAvatarUrl: r.otherPartyAvatarUrl,
        status: r.status,
        lastMessageBody: last?.body ?? null,
        lastMessageAt: last?.createdAt.toISOString() ?? null,
        lastMessageSenderUserId: last?.senderUserId ?? null,
      };
    })
    .sort((a, b) => {
      const aTime = a.lastMessageAt ?? rows.find(r => r.applicationId === a.applicationId)!.appCreatedAt.toISOString();
      const bTime = b.lastMessageAt ?? rows.find(r => r.applicationId === b.applicationId)!.appCreatedAt.toISOString();
      return bTime.localeCompare(aTime);
    });

  res.json(result);
});

router.get("/messages/unread-count", async (req, res) => {
  const activeId = await getActiveUserId(req);
  const sinceRaw = typeof req.query.since === "string" ? req.query.since : "";
  let sinceDate: Date;
  try {
    sinceDate = sinceRaw ? new Date(sinceRaw) : new Date(0);
    if (isNaN(sinceDate.getTime())) sinceDate = new Date(0);
  } catch {
    sinceDate = new Date(0);
  }

  const [active] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, activeId))
    .limit(1);
  if (!active) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }

  let count = 0;

  if (active.trainerId) {
    const rows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(messagesTable)
      .innerJoin(applicationsTable, eq(messagesTable.applicationId, applicationsTable.id))
      .where(
        and(
          eq(applicationsTable.trainerId, active.trainerId),
          ne(messagesTable.senderUserId, activeId),
          gt(messagesTable.createdAt, sinceDate),
          inArray(applicationsTable.status, ["shortlisted", "hired"]),
        ),
      );
    count = rows[0]?.count ?? 0;
  } else if (active.vendorId) {
    const rows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(messagesTable)
      .innerJoin(applicationsTable, eq(messagesTable.applicationId, applicationsTable.id))
      .innerJoin(requirementsTable, eq(applicationsTable.requirementId, requirementsTable.id))
      .where(
        and(
          eq(requirementsTable.vendorId, active.vendorId),
          ne(messagesTable.senderUserId, activeId),
          gt(messagesTable.createdAt, sinceDate),
          inArray(applicationsTable.status, ["shortlisted", "hired"]),
        ),
      );
    count = rows[0]?.count ?? 0;
  }

  res.json({ count });
});

export default router;
