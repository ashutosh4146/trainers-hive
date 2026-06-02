import { Router, type IRouter } from "express";
import { db, vendorsTable, usersTable, requirementsTable, applicationsTable, trainersTable, savedTrainersTable, endorsementsTable } from "@workspace/db";
import { eq, and, isNotNull, sql, desc } from "drizzle-orm";
import { GetVendorParams, UpdateVendorParams, UpdateVendorBody, ListSavedTrainersParams, SaveTrainerParams, SaveTrainerBody, UnsaveTrainerParams } from "@workspace/api-zod";
import { getActiveUserId } from "../lib/session";
import { newId } from "../lib/ids";
import { z } from "zod";
import { DEFAULT_VENDOR_EMAIL_PREFS, resolveVendorEmailPrefs } from "../lib/vendor-email-prefs";
import { notifyVendorVerificationApproved, notifyVendorVerificationInfoNeeded } from "../lib/mailer";

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

function serializePublic(v: typeof vendorsTable.$inferSelect) {
  return {
    id: v.id,
    companyName: v.companyName,
    industry: v.industry,
    location: v.location,
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
  const vendor = rows[0]!;
  let isPrivileged = false;
  try {
    const activeId = await getActiveUserId(req);
    if (activeId) {
      const [active] = await db.select().from(usersTable).where(eq(usersTable.id, activeId)).limit(1);
      if (active && (active.role === "admin" || (active.role === "vendor" && active.vendorId === vendor.id))) {
        isPrivileged = true;
      }
    }
  } catch {
    // not authenticated
  }
  res.json(isPrivileged ? serialize(vendor) : serializePublic(vendor));
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

// Admin: list all vendors
router.get("/admin/vendors", async (req, res) => {
  const activeId = await getActiveUserId(req);
  const [active] = await db.select().from(usersTable).where(eq(usersTable.id, activeId)).limit(1);
  if (!active || active.role !== "admin") {
    res.status(403).json({ error: "admin only" });
    return;
  }

  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? "30"), 10) || 30));
  const offset = (page - 1) * pageSize;

  let rows = await db.select().from(vendorsTable).orderBy(vendorsTable.companyName);
  if (q) {
    const ql = q.toLowerCase();
    rows = rows.filter(
      (v) =>
        v.companyName.toLowerCase().includes(ql) ||
        v.email.toLowerCase().includes(ql) ||
        (v.industry ?? "").toLowerCase().includes(ql),
    );
  }
  const total = rows.length;
  const page_rows = rows.slice(offset, offset + pageSize);

  res.json({
    vendors: page_rows.map((v) => ({
      id: v.id,
      companyName: v.companyName,
      email: v.email,
      industry: v.industry,
      location: v.location,
      verified: v.verified,
      logoUrl: v.logoUrl ?? "",
      createdAt: v.createdAt.toISOString(),
    })),
    total,
    page,
    pageSize,
  });
});

// Admin: set/unset vendor verified flag
router.patch("/admin/vendors/:id/verify", async (req, res) => {
  const { id } = req.params as { id: string };
  if (!id) {
    res.status(400).json({ error: "missing id" });
    return;
  }
  const activeId = await getActiveUserId(req);
  const [active] = await db.select().from(usersTable).where(eq(usersTable.id, activeId)).limit(1);
  if (!active || active.role !== "admin") {
    res.status(403).json({ error: "admin only" });
    return;
  }
  const { verified } = req.body as { verified?: boolean };
  if (typeof verified !== "boolean") {
    res.status(400).json({ error: "verified must be a boolean" });
    return;
  }
  const [updated] = await db
    .update(vendorsTable)
    .set({ verified })
    .where(eq(vendorsTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "vendor not found" });
    return;
  }

  // Notify the vendor when they get verified (best-effort)
  if (verified) {
    try {
      await notifyVendorVerificationApproved({
        to: updated.email,
        contactName: updated.contactName,
        companyName: updated.companyName,
      });
    } catch (err) {
      req.log.warn({ err }, "Failed to send vendor verification approval email");
    }
  }

  res.json(serialize(updated));
});

// Admin: notify vendor that more information is needed before verification
router.post("/admin/vendors/:id/request-verification-info", async (req, res) => {
  const { id } = req.params as { id: string };
  if (!id) {
    res.status(400).json({ error: "missing id" });
    return;
  }
  const activeId = await getActiveUserId(req);
  const [active] = await db.select().from(usersTable).where(eq(usersTable.id, activeId)).limit(1);
  if (!active || active.role !== "admin") {
    res.status(403).json({ error: "admin only" });
    return;
  }
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (!message) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, id)).limit(1);
  if (!vendor) {
    res.status(404).json({ error: "vendor not found" });
    return;
  }
  if (vendor.verified) {
    res.status(409).json({ error: "vendor is already verified" });
    return;
  }

  try {
    await notifyVendorVerificationInfoNeeded({
      to: vendor.email,
      contactName: vendor.contactName,
      companyName: vendor.companyName,
      message,
    });
  } catch (err) {
    req.log.warn({ err }, "Failed to send vendor verification info-needed email");
    res.status(500).json({ error: "Could not send notification email" });
    return;
  }

  res.json({ ok: true });
});

const VendorEmailPrefsSchema = z.object({
  newApplication: z.boolean().optional(),
  trainerWithdrew: z.boolean().optional(),
  messages: z.boolean().optional(),
});

// GET /vendors/:id/email-prefs
router.get("/vendors/:id/email-prefs", async (req, res) => {
  const params = GetVendorParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid params" });
    return;
  }
  const activeId = await getActiveUserId(req);
  const [active] = await db.select().from(usersTable).where(eq(usersTable.id, activeId)).limit(1);
  if (!active || active.role !== "vendor" || active.vendorId !== params.data.id) {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  const [row] = await db
    .select({ emailPrefs: vendorsTable.emailPrefs })
    .from(vendorsTable)
    .where(eq(vendorsTable.id, params.data.id))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "vendor not found" });
    return;
  }
  res.json(resolveVendorEmailPrefs(row.emailPrefs));
});

// PATCH /vendors/:id/email-prefs
router.patch("/vendors/:id/email-prefs", async (req, res) => {
  const params = GetVendorParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid params" });
    return;
  }
  const body = VendorEmailPrefsSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "invalid body", details: body.error.issues });
    return;
  }
  const activeId = await getActiveUserId(req);
  const [active] = await db.select().from(usersTable).where(eq(usersTable.id, activeId)).limit(1);
  if (!active || active.role !== "vendor" || active.vendorId !== params.data.id) {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  const [existing] = await db
    .select({ emailPrefs: vendorsTable.emailPrefs })
    .from(vendorsTable)
    .where(eq(vendorsTable.id, params.data.id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "vendor not found" });
    return;
  }
  const merged = { ...resolveVendorEmailPrefs(existing.emailPrefs), ...body.data };
  await db.update(vendorsTable).set({ emailPrefs: merged }).where(eq(vendorsTable.id, params.data.id));
  res.json(merged);
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

// GET /vendors/:id/endorsements
router.get("/vendors/:id/endorsements", async (req, res) => {
  const params = GetVendorParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid params" });
    return;
  }
  const { id } = params.data;

  const activeId = await getActiveUserId(req);
  const [active] = await db.select().from(usersTable).where(eq(usersTable.id, activeId)).limit(1);
  if (!active) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }
  if (active.role !== "admin" && (active.role !== "vendor" || active.vendorId !== id)) {
    res.status(403).json({ error: "forbidden" });
    return;
  }

  const rows = await db
    .select({ endorsement: endorsementsTable, trainer: trainersTable })
    .from(endorsementsTable)
    .leftJoin(trainersTable, eq(endorsementsTable.trainerId, trainersTable.id))
    .where(eq(endorsementsTable.vendorId, id))
    .orderBy(desc(endorsementsTable.createdAt));

  res.json(
    rows
      .filter((r) => r.trainer !== null)
      .map((r) => ({
        id: r.endorsement.id,
        trainerId: r.endorsement.trainerId,
        vendorId: r.endorsement.vendorId,
        trainerName: r.trainer!.name,
        trainerAvatarUrl: r.trainer!.avatarUrl,
        text: r.endorsement.text,
        createdAt: r.endorsement.createdAt.toISOString(),
      })),
  );
});

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

// GET /vendors/:id/hiring-stats
router.get("/vendors/:id/hiring-stats", async (req, res) => {
  const params = GetVendorParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid params" });
    return;
  }
  const { id } = params.data;

  // Vendor-owner OR admin
  const activeId = await getActiveUserId(req);
  const [active] = await db.select().from(usersTable).where(eq(usersTable.id, activeId)).limit(1);
  if (!active) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }
  if (active.role !== "admin" && (active.role !== "vendor" || active.vendorId !== id)) {
    res.status(403).json({ error: "forbidden" });
    return;
  }

  // One row per requirement: earliest hiredAt among all its applications
  const perReq = await db
    .select({
      requirementId: requirementsTable.id,
      reqCreatedAt: requirementsTable.createdAt,
      firstHiredAt: sql<Date | null>`MIN(${applicationsTable.hiredAt})`,
    })
    .from(requirementsTable)
    .leftJoin(applicationsTable, and(
      eq(applicationsTable.requirementId, requirementsTable.id),
      isNotNull(applicationsTable.hiredAt),
    ))
    .where(eq(requirementsTable.vendorId, id))
    .groupBy(requirementsTable.id, requirementsTable.createdAt);

  // Keep only requirements that actually have a hired application
  const hiredReqs = perReq.filter((r) => r.firstHiredAt !== null);

  if (hiredReqs.length === 0) {
    res.json({ hiredCount: 0, avgDays: null, minDays: null, maxDays: null });
    return;
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  const daysList = hiredReqs.map((r) =>
    Math.max(0, Math.round((new Date(r.firstHiredAt!).getTime() - new Date(r.reqCreatedAt).getTime()) / msPerDay)),
  );

  const sum = daysList.reduce((acc, d) => acc + d, 0);
  const avg = Math.round(sum / daysList.length);
  const min = Math.min(...daysList);
  const max = Math.max(...daysList);

  res.json({ hiredCount: hiredReqs.length, avgDays: avg, minDays: min, maxDays: max });
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
