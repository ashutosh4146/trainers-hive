import { Router, type IRouter } from "express";
import {
  db,
  requirementsTable,
  vendorsTable,
  applicationsTable,
  trainersTable,
  activityTable,
  usersTable,
} from "@workspace/db";
import { eq, and, desc, asc, sql, type SQL } from "drizzle-orm";
import {
  ListRequirementsQueryParams,
  CreateRequirementBody,
  GetRequirementParams,
  UpdateRequirementParams,
  UpdateRequirementBody,
  ApplyToRequirementParams,
  ApplyToRequirementBody,
  ListRequirementApplicationsParams,
  DeleteRequirementParams,
} from "@workspace/api-zod";
import { newId } from "../lib/ids";
import { getActiveUserId } from "../lib/session";
import { notifyVendorNewApplication } from "../lib/mailer";

const router: IRouter = Router();

async function buildRequirementCard(
  r: typeof requirementsTable.$inferSelect,
  vendor: typeof vendorsTable.$inferSelect | null,
  applicationCount: number,
) {
  return {
    id: r.id,
    vendorId: r.vendorId,
    vendorName: vendor?.companyName ?? "Unknown",
    vendorLogoUrl: vendor?.logoUrl ?? "",
    title: r.title,
    skill: r.skill,
    subSkills: r.subSkills ?? [],
    durationDays: r.durationDays,
    location: r.location,
    remote: r.remote,
    deadline: r.deadline.toISOString(),
    status: r.status as "open" | "closed" | "vacant",
    createdAt: r.createdAt.toISOString(),
    applicationCount,
    budget: r.budget > 0 ? r.budget : undefined,
    feeType: r.budget > 0 ? (r.feeType as "fixed" | "negotiable") : undefined,
    trainingType: r.trainingType ?? undefined,
    trainingMode: r.trainingMode ?? undefined,
    trainerCount: r.trainerCount ?? undefined,
    trainerType: r.trainerType ?? undefined,
    benefits: r.benefits ?? undefined,
    certifications: r.certifications ?? undefined,
    language: r.language ?? undefined,
    trainerScope: r.trainerScope ?? undefined,
    startDate: r.startDate ?? undefined,
  };
}

async function fetchListWithCounts(rows: (typeof requirementsTable.$inferSelect)[]) {
  if (rows.length === 0) return [];
  const vendorIds = Array.from(new Set(rows.map((r) => r.vendorId)));
  const reqIds = rows.map((r) => r.id);
  const vendors = await db
    .select()
    .from(vendorsTable)
    .where(sql`${vendorsTable.id} IN ${vendorIds}`);
  const vMap = new Map(vendors.map((v) => [v.id, v]));
  const counts = await db
    .select({
      requirementId: applicationsTable.requirementId,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(applicationsTable)
    .where(sql`${applicationsTable.requirementId} IN ${reqIds}`)
    .groupBy(applicationsTable.requirementId);
  const cMap = new Map(counts.map((c) => [c.requirementId, c.count]));
  return Promise.all(
    rows.map((r) =>
      buildRequirementCard(r, vMap.get(r.vendorId) ?? null, cMap.get(r.id) ?? 0),
    ),
  );
}

router.get("/requirements", async (req, res) => {
  const parsed = ListRequirementsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid query", details: parsed.error.issues });
    return;
  }
  const { q, skill, location, remote, status, vendorId, sort } = parsed.data;
  const conds: SQL[] = [];
  if (q) {
    const like = `%${q}%`;
    conds.push(
      sql`(${requirementsTable.title} ILIKE ${like} OR ${requirementsTable.description} ILIKE ${like})`,
    );
  }
  if (skill) {
    conds.push(
      sql`(${requirementsTable.skill} = ${skill} OR ${requirementsTable.subSkills} @> ${JSON.stringify([skill])}::jsonb)`,
    );
  }
  if (location) conds.push(eq(requirementsTable.location, location));
  if (remote !== undefined) conds.push(eq(requirementsTable.remote, remote));
  if (status) conds.push(eq(requirementsTable.status, status));
  if (vendorId) conds.push(eq(requirementsTable.vendorId, vendorId));
  const where = conds.length > 0 ? and(...conds) : undefined;
  const orderBy =
    sort === "deadline"
      ? asc(requirementsTable.deadline)
      : sort === "budget"
        ? desc(requirementsTable.budget)
        : desc(requirementsTable.createdAt);
  const rows = where
    ? await db.select().from(requirementsTable).where(where).orderBy(orderBy)
    : await db.select().from(requirementsTable).orderBy(orderBy);
  res.json(await fetchListWithCounts(rows));
});

router.get("/requirements/recent", async (_req, res) => {
  const rows = await db
    .select()
    .from(requirementsTable)
    .where(eq(requirementsTable.status, "open"))
    .orderBy(desc(requirementsTable.createdAt))
    .limit(8);
  res.json(await fetchListWithCounts(rows));
});

router.post("/requirements", async (req, res) => {
  const parsed = CreateRequirementBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid body", details: parsed.error.issues });
    return;
  }
  const activeId = await getActiveUserId(req);
  const [active] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, activeId))
    .limit(1);
  if (!active || active.role !== "vendor" || !active.vendorId) {
    res.status(403).json({ error: "only vendors can post requirements" });
    return;
  }
  const id = newId("req");
  const deadline = parsed.data.deadline instanceof Date
    ? parsed.data.deadline
    : new Date(parsed.data.deadline);
  const isRemote = parsed.data.trainingMode === "remote";
  await db.insert(requirementsTable).values({
    id,
    vendorId: active.vendorId,
    title: parsed.data.title,
    skill: parsed.data.skill,
    subSkills: parsed.data.subSkills,
    durationDays: parsed.data.durationDays,
    budget: parsed.data.budget ?? 0,
    feeType: parsed.data.feeType ?? "negotiable",
    location: parsed.data.location ?? "",
    remote: isRemote,
    deadline,
    description: parsed.data.description,
    status: "open",
    trainingType: parsed.data.trainingType,
    trainingMode: parsed.data.trainingMode,
    trainerCount: parsed.data.trainerCount,
    trainerType: parsed.data.trainerType,
    benefits: parsed.data.benefits,
    certifications: parsed.data.certifications ?? null,
    language: parsed.data.language ?? null,
    trainerScope: parsed.data.trainerScope,
    startDate: parsed.data.startDate ?? null,
  });
  await db.insert(activityTable).values({
    id: newId("act"),
    type: "requirement",
    title: `${active.name} posted a new requirement`,
    subtitle: parsed.data.title,
    avatarUrl: active.avatarUrl,
  });
  const [vendor] = await db
    .select()
    .from(vendorsTable)
    .where(eq(vendorsTable.id, active.vendorId))
    .limit(1);
  const [created] = await db
    .select()
    .from(requirementsTable)
    .where(eq(requirementsTable.id, id))
    .limit(1);
  res.status(201).json(await buildRequirementCard(created!, vendor ?? null, 0));
});

router.get("/requirements/:id", async (req, res) => {
  const params = GetRequirementParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid params" });
    return;
  }
  const [r] = await db
    .select()
    .from(requirementsTable)
    .where(eq(requirementsTable.id, params.data.id))
    .limit(1);
  if (!r) {
    res.status(404).json({ error: "requirement not found" });
    return;
  }
  const [vendor] = await db
    .select()
    .from(vendorsTable)
    .where(eq(vendorsTable.id, r.vendorId))
    .limit(1);
  const [{ count } = { count: 0 }] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(applicationsTable)
    .where(eq(applicationsTable.requirementId, r.id));
  const card = await buildRequirementCard(r, vendor ?? null, count);
  res.json({
    ...card,
    description: r.description,
    vendor: vendor
      ? {
          id: vendor.id,
          companyName: vendor.companyName,
          industry: vendor.industry,
          location: vendor.location,
          contactName: vendor.contactName,
          contactDesignation: vendor.contactDesignation,
          email: vendor.email,
          about: vendor.about ?? undefined,
          logoUrl: vendor.logoUrl,
          websiteUrl: vendor.websiteUrl ?? undefined,
          verified: vendor.verified,
        }
      : undefined,
  });
});

router.patch("/requirements/:id", async (req, res) => {
  const params = UpdateRequirementParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid params" });
    return;
  }
  const body = UpdateRequirementBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "invalid body", details: body.error.issues });
    return;
  }
  const update: Partial<typeof requirementsTable.$inferInsert> = {};
  for (const [k, v] of Object.entries(body.data)) {
    if (v !== undefined) {
      if (k === "deadline") {
        update.deadline = v instanceof Date ? v : new Date(v as string);
      } else {
        (update as Record<string, unknown>)[k] = v;
      }
    }
  }
  if (Object.keys(update).length > 0) {
    await db
      .update(requirementsTable)
      .set(update)
      .where(eq(requirementsTable.id, params.data.id));
  }
  const [r] = await db
    .select()
    .from(requirementsTable)
    .where(eq(requirementsTable.id, params.data.id))
    .limit(1);
  if (!r) {
    res.status(404).json({ error: "requirement not found" });
    return;
  }
  const [vendor] = await db
    .select()
    .from(vendorsTable)
    .where(eq(vendorsTable.id, r.vendorId))
    .limit(1);
  const [{ count } = { count: 0 }] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(applicationsTable)
    .where(eq(applicationsTable.requirementId, r.id));
  res.json(await buildRequirementCard(r, vendor ?? null, count));
});

router.delete("/requirements/:id", async (req, res) => {
  const params = DeleteRequirementParams.safeParse(req.params);
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
  if (!active || active.role !== "admin") {
    res.status(403).json({ error: "admin only" });
    return;
  }
  const [existing] = await db
    .select()
    .from(requirementsTable)
    .where(eq(requirementsTable.id, params.data.id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "requirement not found" });
    return;
  }
  const vendorRow = await db
    .select({ email: vendorsTable.email, companyName: vendorsTable.companyName })
    .from(vendorsTable)
    .where(eq(vendorsTable.id, existing.vendorId))
    .limit(1);

  await db
    .delete(applicationsTable)
    .where(eq(applicationsTable.requirementId, params.data.id));
  await db.delete(requirementsTable).where(eq(requirementsTable.id, params.data.id));
  await db.insert(activityTable).values({
    id: newId("act"),
    type: "removal",
    title: `Admin removed a requirement`,
    subtitle: existing.title,
    avatarUrl: active.avatarUrl,
  });

  if (vendorRow.length > 0) {
    const { notifyRemovedRequirement } = await import("../lib/mailer");
    notifyRemovedRequirement({
      vendorEmail: vendorRow[0]!.email,
      vendorName: vendorRow[0]!.companyName,
      requirementTitle: existing.title,
    }).catch(() => {});
  }

  res.status(204).end();
});

router.post("/requirements/:id/apply", async (req, res) => {
  const params = ApplyToRequirementParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid params" });
    return;
  }
  const body = ApplyToRequirementBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "invalid body", details: body.error.issues });
    return;
  }
  const activeId = await getActiveUserId(req);
  const [active] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, activeId))
    .limit(1);
  if (!active || active.role !== "trainer" || !active.trainerId) {
    res.status(403).json({ error: "only trainers can apply" });
    return;
  }
  const id = newId("app");
  try {
    await db.insert(applicationsTable).values({
      id,
      requirementId: params.data.id,
      trainerId: active.trainerId,
      status: "submitted",
      message: body.data.message,
      proposedRate: body.data.proposedRate,
    });
  } catch {
    res.status(409).json({ error: "already applied" });
    return;
  }
  const [r] = await db
    .select()
    .from(requirementsTable)
    .where(eq(requirementsTable.id, params.data.id))
    .limit(1);
  await db.insert(activityTable).values({
    id: newId("act"),
    type: "application",
    title: `${active.name} applied to a requirement`,
    subtitle: r?.title ?? "",
    avatarUrl: active.avatarUrl,
  });
  if (r) {
    const [vendor] = await db
      .select()
      .from(vendorsTable)
      .where(eq(vendorsTable.id, r.vendorId))
      .limit(1);
    if (vendor?.email) {
      notifyVendorNewApplication({
        vendorEmail: vendor.email,
        vendorName: vendor.companyName,
        trainerName: active.name ?? "A trainer",
        requirementTitle: r.title,
        proposedRate: body.data.proposedRate,
        message: body.data.message,
      }).catch(() => {});
    }
  }
  res.status(201).json({
    id,
    requirementId: params.data.id,
    trainerId: active.trainerId,
    status: "submitted",
    message: body.data.message,
    proposedRate: body.data.proposedRate,
    createdAt: new Date().toISOString(),
  });
});

router.get("/requirements/:id/applications", async (req, res) => {
  const params = ListRequirementApplicationsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid params" });
    return;
  }
  const rows = await db
    .select({ app: applicationsTable, trainer: trainersTable })
    .from(applicationsTable)
    .leftJoin(trainersTable, eq(applicationsTable.trainerId, trainersTable.id))
    .where(eq(applicationsTable.requirementId, params.data.id))
    .orderBy(desc(applicationsTable.createdAt));
  res.json(
    rows.map((r) => ({
      id: r.app.id,
      requirementId: r.app.requirementId,
      trainerId: r.app.trainerId,
      status: r.app.status,
      message: r.app.message,
      proposedRate: r.app.proposedRate,
      createdAt: r.app.createdAt.toISOString(),
      trainer: r.trainer
        ? {
            id: r.trainer.id,
            name: r.trainer.name,
            headline: r.trainer.headline,
            mainSkill: r.trainer.mainSkill,
            subSkills: r.trainer.subSkills ?? [],
            experienceYears: r.trainer.experienceYears,
            location: r.trainer.location,
            remote: r.trainer.remote,
            rating: Number(r.trainer.rating),
            reviewCount: r.trainer.reviewCount,
            hourlyRate: r.trainer.hourlyRate,
            verified: r.trainer.verified,
            avatarUrl: r.trainer.avatarUrl,
            availability: r.trainer.availability ?? undefined,
          }
        : null,
    })),
  );
});

export default router;
