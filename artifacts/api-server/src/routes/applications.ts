import { Router, type IRouter } from "express";
import {
  db,
  applicationsTable,
  requirementsTable,
  vendorsTable,
  usersTable,
  activityTable,
  trainersTable,
} from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import {
  UpdateApplicationStatusParams,
  UpdateApplicationStatusBody,
} from "@workspace/api-zod";
import { getActiveUserId } from "../lib/session";
import { newId } from "../lib/ids";

const router: IRouter = Router();

router.get("/applications", async (_req, res) => {
  const activeId = await getActiveUserId();
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

export default router;
