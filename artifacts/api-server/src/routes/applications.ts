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

import { eq, desc, sql, asc } from "drizzle-orm";
import {
  UpdateApplicationStatusParams,
  UpdateApplicationStatusBody,
  ListApplicationMessagesParams,
  SendApplicationMessageParams,
  SendApplicationMessageBody,
} from "@workspace/api-zod";
import { getActiveUserId } from "../lib/session";
import { newId } from "../lib/ids";
import { notifyTrainerStatusUpdate } from "../lib/mailer";

const router: IRouter = Router();

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
  const _activeId = await getActiveUserId(req);
  await db
    .update(applicationsTable)
    .set({ status: body.data.status })
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
  // Activity feed
  const [trainer] = await db
    .select()
    .from(trainersTable)
    .where(eq(trainersTable.id, a.trainerId))
    .limit(1);
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
    const [trainerUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.trainerId, a.trainerId))
      .limit(1);
    if (trainerUser?.email && req?.r) {
      notifyTrainerStatusUpdate({
        trainerEmail: trainerUser.email,
        trainerName: trainer?.name ?? "Trainer",
        requirementTitle: req.r.title,
        vendorName: req.v?.companyName ?? "the vendor",
        status: body.data.status,
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
});

export default router;
