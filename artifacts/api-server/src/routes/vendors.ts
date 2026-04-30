import { Router, type IRouter } from "express";
import { db, vendorsTable, usersTable, requirementsTable, applicationsTable, trainersTable, savedTrainersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { GetVendorParams, UpdateVendorParams, UpdateVendorBody, ListSavedTrainersParams, SaveTrainerParams, SaveTrainerBody, UnsaveTrainerParams } from "@workspace/api-zod";
import { getActiveUserId } from "../lib/session";
import { newId } from "../lib/ids";

const router: IRouter = Router();

function serialize(v: typeof vendorsTable.$inferSelect) {
  return {
    id: v.id,
    companyName: v.companyName,
    industry: v.industry,
    location: v.location,
    contactName: v.contactName,
    contactDesignation: v.contactDesignation,
    email: v.email,
    about: v.about ?? undefined,
    logoUrl: v.logoUrl,
    websiteUrl: v.websiteUrl ?? undefined,
    verified: v.verified,
  };
}

router.get("/vendors/:id", async (req, res) => {
  const params = GetVendorParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid params" });
    return;
  }
  const rows = await db
    .select()
    .from(vendorsTable)
    .where(eq(vendorsTable.id, params.data.id))
    .limit(1);
  if (rows.length === 0) {
    res.status(404).json({ error: "vendor not found" });
    return;
  }
  res.json(serialize(rows[0]!));
});

router.patch("/vendors/:id", async (req, res) => {
  const params = UpdateVendorParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid params" });
    return;
  }
  const body = UpdateVendorBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "invalid body", details: body.error.issues });
    return;
  }
  const update: Partial<typeof vendorsTable.$inferInsert> = {};
  for (const [k, v] of Object.entries(body.data)) {
    if (v !== undefined) (update as Record<string, unknown>)[k] = v;
  }
  if (Object.keys(update).length > 0) {
    await db
      .update(vendorsTable)
      .set(update)
      .where(eq(vendorsTable.id, params.data.id));
  }
  const rows = await db
    .select()
    .from(vendorsTable)
    .where(eq(vendorsTable.id, params.data.id))
    .limit(1);
  if (rows.length === 0) {
    res.status(404).json({ error: "vendor not found" });
    return;
  }
  res.json(serialize(rows[0]!));
});

router.delete("/vendors/:id", async (req, res) => {
  const { id } = req.params as { id: string };
  if (!id) {
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
    .from(vendorsTable)
    .where(eq(vendorsTable.id, id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "vendor not found" });
    return;
  }

  const reqIds = await db
    .select({ id: requirementsTable.id })
    .from(requirementsTable)
    .where(eq(requirementsTable.vendorId, id));

  for (const r of reqIds) {
    await db.delete(applicationsTable).where(eq(applicationsTable.requirementId, r.id));
  }
  await db.delete(requirementsTable).where(eq(requirementsTable.vendorId, id));
  await db.delete(usersTable).where(eq(usersTable.vendorId, id));
  await db.delete(vendorsTable).where(eq(vendorsTable.id, id));

  const { activityTable } = await import("@workspace/db");
  await db.insert(activityTable).values({
    id: newId("act"),
    type: "removal",
    title: `Admin removed vendor ${existing.companyName}`,
    subtitle: existing.industry,
    avatarUrl: active.avatarUrl,
  });

  const { notifyRemovedVendor } = await import("../lib/mailer");
  notifyRemovedVendor({ vendorEmail: existing.email, vendorName: existing.companyName }).catch(() => {});

  res.status(204).end();
});

// Helper — check the requesting user is the owning vendor
async function requireOwningVendor(req: import("express").Request, res: import("express").Response, vendorId: string): Promise<boolean> {
  const activeId = await getActiveUserId(req);
  const [active] = await db.select().from(usersTable).where(eq(usersTable.id, activeId)).limit(1);
  if (!active || active.role !== "vendor" || active.vendorId !== vendorId) {
    res.status(403).json({ error: "only the owning vendor can manage saved trainers" });
    return false;
  }
  return true;
}

function serializeTrainer(t: typeof trainersTable.$inferSelect) {
  return {
    id: t.id,
    name: t.name,
    headline: t.headline,
    mainSkill: t.mainSkill,
    subSkills: (t.subSkills as string[]) ?? [],
    experienceYears: t.experienceYears,
    developmentExperienceYears: t.developmentExperienceYears ?? 0,
    location: t.location,
    remote: t.remote,
    rating: Number(t.rating),
    reviewCount: t.reviewCount,
    hourlyRate: t.hourlyRate,
    verified: t.verified,
    avatarUrl: t.avatarUrl,
    availability: t.availability ?? undefined,
    trainerType: t.trainerType ?? undefined,
    engagedDates: (t.engagedDates as { startDate: string; endDate: string; note?: string }[]) ?? [],
  };
}

// GET /vendors/:id/saved-trainers
router.get("/vendors/:id/saved-trainers", async (req, res) => {
  const params = ListSavedTrainersParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid params" });
    return;
  }
  if (!(await requireOwningVendor(req, res, params.data.id))) return;

  const rows = await db
    .select({ saved: savedTrainersTable, trainer: trainersTable })
    .from(savedTrainersTable)
    .leftJoin(trainersTable, eq(savedTrainersTable.trainerId, trainersTable.id))
    .where(eq(savedTrainersTable.vendorId, params.data.id))
    .orderBy(savedTrainersTable.savedAt);

  res.json(
    rows
      .filter((r) => r.trainer !== null)
      .map((r) => ({
        id: r.saved.id,
        trainerId: r.saved.trainerId,
        vendorId: r.saved.vendorId,
        savedAt: r.saved.savedAt.toISOString(),
        trainer: serializeTrainer(r.trainer!),
      })),
  );
});

// POST /vendors/:id/saved-trainers
router.post("/vendors/:id/saved-trainers", async (req, res) => {
  const params = SaveTrainerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid params" });
    return;
  }
  const body = SaveTrainerBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "invalid body", details: body.error.issues });
    return;
  }
  if (!(await requireOwningVendor(req, res, params.data.id))) return;

  const [trainer] = await db.select().from(trainersTable).where(eq(trainersTable.id, body.data.trainerId)).limit(1);
  if (!trainer) {
    res.status(404).json({ error: "trainer not found" });
    return;
  }

  const id = newId("sav");
  try {
    await db.insert(savedTrainersTable).values({
      id,
      vendorId: params.data.id,
      trainerId: body.data.trainerId,
    });
  } catch (err: unknown) {
    // 23505 = unique_violation (vendorId + trainerId already exists)
    const pgCode = (err as { code?: string })?.code;
    if (pgCode === "23505") {
      res.status(409).json({ error: "already saved" });
    } else {
      req.log.error({ err }, "failed to insert saved trainer");
      res.status(500).json({ error: "could not save trainer" });
    }
    return;
  }

  res.status(201).json({
    id,
    trainerId: body.data.trainerId,
    vendorId: params.data.id,
    savedAt: new Date().toISOString(),
    trainer: serializeTrainer(trainer),
  });
});

// DELETE /vendors/:id/saved-trainers/:trainerId
router.delete("/vendors/:id/saved-trainers/:trainerId", async (req, res) => {
  const params = UnsaveTrainerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid params" });
    return;
  }
  if (!(await requireOwningVendor(req, res, params.data.id))) return;

  const deleted = await db
    .delete(savedTrainersTable)
    .where(and(eq(savedTrainersTable.vendorId, params.data.id), eq(savedTrainersTable.trainerId, params.data.trainerId)))
    .returning();

  if (deleted.length === 0) {
    res.status(404).json({ error: "bookmark not found" });
    return;
  }
  res.status(204).end();
});

export default router;
