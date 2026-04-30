import { Router, type IRouter } from "express";
import { db, trainersTable, reviewsTable, vendorsTable } from "@workspace/db";
import { eq, and, sql, desc, asc, type SQL } from "drizzle-orm";
import {
  ListTrainersQueryParams,
  GetTrainerParams,
  UpdateTrainerParams,
  UpdateTrainerBody,
  CreateTrainerReviewParams,
  CreateTrainerReviewBody,
  ListTrainerReviewsParams,
  DeleteTrainerParams,
} from "@workspace/api-zod";
import { applicationsTable, usersTable } from "@workspace/db";
import { getActiveUserId } from "../lib/session";
import { newId } from "../lib/ids";

const router: IRouter = Router();

function serializeTrainer(t: typeof trainersTable.$inferSelect) {
  return {
    id: t.id,
    name: t.name,
    headline: t.headline,
    mainSkill: t.mainSkill,
    subSkills: t.subSkills ?? [],
    experienceYears: t.experienceYears,
    location: t.location,
    remote: t.remote,
    rating: Number(t.rating),
    reviewCount: t.reviewCount,
    hourlyRate: t.hourlyRate,
    verified: t.verified,
    avatarUrl: t.avatarUrl,
    availability: t.availability ?? undefined,
    engagedDates: t.engagedDates ?? [],
  };
}

router.get("/trainers", async (req, res) => {
  const parsed = ListTrainersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid query", details: parsed.error.issues });
    return;
  }
  const { q, skill, location, remote, minExperience, sort } = parsed.data;
  const conds: SQL[] = [];
  if (q) {
    const like = `%${q}%`;
    conds.push(
      sql`(${trainersTable.name} ILIKE ${like} OR ${trainersTable.headline} ILIKE ${like} OR ${trainersTable.mainSkill} ILIKE ${like})`,
    );
  }
  if (skill) {
    conds.push(
      sql`(${trainersTable.mainSkill} = ${skill} OR ${trainersTable.subSkills} @> ${JSON.stringify([skill])}::jsonb)`,
    );
  }
  if (location) {
    conds.push(eq(trainersTable.location, location));
  }
  if (remote !== undefined) {
    conds.push(eq(trainersTable.remote, remote));
  }
  if (minExperience !== undefined) {
    conds.push(sql`${trainersTable.experienceYears} >= ${minExperience}`);
  }
  const where = conds.length > 0 ? and(...conds) : undefined;
  const orderBy =
    sort === "experience"
      ? desc(trainersTable.experienceYears)
      : sort === "recent"
        ? desc(trainersTable.createdAt)
        : desc(trainersTable.rating);
  const rows = where
    ? await db.select().from(trainersTable).where(where).orderBy(orderBy)
    : await db.select().from(trainersTable).orderBy(orderBy);
  res.json(rows.map(serializeTrainer));
});

router.get("/trainers/featured", async (_req, res) => {
  const rows = await db
    .select()
    .from(trainersTable)
    .orderBy(desc(trainersTable.rating))
    .limit(6);
  res.json(rows.map(serializeTrainer));
});

router.get("/trainers/:id", async (req, res) => {
  const params = GetTrainerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid params" });
    return;
  }
  const rows = await db
    .select()
    .from(trainersTable)
    .where(eq(trainersTable.id, params.data.id))
    .limit(1);
  if (rows.length === 0) {
    res.status(404).json({ error: "trainer not found" });
    return;
  }
  const t = rows[0]!;
  res.json({
    ...serializeTrainer(t),
    bio: t.bio,
    certifications: t.certifications ?? [],
    languages: t.languages ?? [],
    completedTrainings: t.completedTrainings,
    portfolioUrl: t.portfolioUrl ?? undefined,
  });
});

router.patch("/trainers/:id", async (req, res) => {
  const params = UpdateTrainerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid params" });
    return;
  }
  const body = UpdateTrainerBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "invalid body", details: body.error.issues });
    return;
  }

  // Authorization: only the trainer themselves or an admin may update.
  const activeId = await getActiveUserId(req);
  const [active] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, activeId))
    .limit(1);
  if (!active) {
    res.status(401).json({ error: "not authenticated" });
    return;
  }
  const isOwner =
    active.role === "trainer" && active.trainerId === params.data.id;
  const isAdmin = active.role === "admin";
  if (!isOwner && !isAdmin) {
    res.status(403).json({ error: "not allowed to edit this trainer" });
    return;
  }

  // Validate engagedDates ranges (date format + end >= start). Server-side guard
  // so direct API callers cannot poison conflict detection.
  if (body.data.engagedDates) {
    const isoRe = /^\d{4}-\d{2}-\d{2}$/;
    const isRealDate = (s: string) => {
      if (!isoRe.test(s)) return false;
      const [y, m, d] = s.split("-").map(Number);
      const dt = new Date(Date.UTC(y!, m! - 1, d!));
      return (
        dt.getUTCFullYear() === y &&
        dt.getUTCMonth() === m! - 1 &&
        dt.getUTCDate() === d
      );
    };
    for (const r of body.data.engagedDates) {
      if (!isRealDate(r.startDate) || !isRealDate(r.endDate)) {
        res.status(400).json({ error: "engagedDates must be valid YYYY-MM-DD calendar dates" });
        return;
      }
      if (r.endDate < r.startDate) {
        res.status(400).json({ error: "engagedDates: endDate must be on or after startDate" });
        return;
      }
    }
  }

  const update: Partial<typeof trainersTable.$inferInsert> = {};
  for (const [k, v] of Object.entries(body.data)) {
    if (v !== undefined) (update as Record<string, unknown>)[k] = v;
  }
  if (Object.keys(update).length > 0) {
    await db
      .update(trainersTable)
      .set(update)
      .where(eq(trainersTable.id, params.data.id));
  }
  const rows = await db
    .select()
    .from(trainersTable)
    .where(eq(trainersTable.id, params.data.id))
    .limit(1);
  if (rows.length === 0) {
    res.status(404).json({ error: "trainer not found" });
    return;
  }
  const t = rows[0]!;
  res.json({
    ...serializeTrainer(t),
    bio: t.bio,
    certifications: t.certifications ?? [],
    languages: t.languages ?? [],
    completedTrainings: t.completedTrainings,
    portfolioUrl: t.portfolioUrl ?? undefined,
  });
});

router.delete("/trainers/:id", async (req, res) => {
  const params = DeleteTrainerParams.safeParse(req.params);
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
    .from(trainersTable)
    .where(eq(trainersTable.id, params.data.id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "trainer not found" });
    return;
  }
  const trainerUser = await db
    .select({ email: usersTable.email, name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.trainerId, params.data.id))
    .limit(1);

  await db.delete(applicationsTable).where(eq(applicationsTable.trainerId, params.data.id));
  await db.delete(reviewsTable).where(eq(reviewsTable.trainerId, params.data.id));
  await db.delete(trainersTable).where(eq(trainersTable.id, params.data.id));
  if (trainerUser.length > 0) {
    await db.delete(usersTable).where(eq(usersTable.trainerId, params.data.id));
  }

  const { activityTable } = await import("@workspace/db");
  await db.insert(activityTable).values({
    id: newId("act"),
    type: "removal",
    title: `Admin removed trainer ${existing.name}`,
    subtitle: existing.headline,
    avatarUrl: active.avatarUrl,
  });

  if (trainerUser.length > 0) {
    const { notifyRemovedTrainer } = await import("../lib/mailer");
    notifyRemovedTrainer({ trainerEmail: trainerUser[0]!.email, trainerName: existing.name }).catch(() => {});
  }

  res.status(204).end();
});

router.get("/trainers/:id/reviews", async (req, res) => {
  const params = ListTrainerReviewsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid params" });
    return;
  }
  const rows = await db
    .select({
      review: reviewsTable,
      vendor: vendorsTable,
    })
    .from(reviewsTable)
    .leftJoin(vendorsTable, eq(reviewsTable.vendorId, vendorsTable.id))
    .where(eq(reviewsTable.trainerId, params.data.id))
    .orderBy(desc(reviewsTable.createdAt));
  res.json(
    rows.map((r) => ({
      id: r.review.id,
      trainerId: r.review.trainerId,
      vendorId: r.review.vendorId,
      vendorName: r.vendor?.companyName ?? "Unknown",
      vendorLogoUrl: r.vendor?.logoUrl ?? undefined,
      rating: r.review.rating,
      comment: r.review.comment,
      engagementTitle: r.review.engagementTitle ?? undefined,
      createdAt: r.review.createdAt.toISOString(),
    })),
  );
  void asc;
});

router.post("/trainers/:id/reviews", async (req, res) => {
  const params = CreateTrainerReviewParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid params" });
    return;
  }
  const body = CreateTrainerReviewBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "invalid body", details: body.error.issues });
    return;
  }

  const { getActiveUserId } = await import("../lib/session");
  const { usersTable } = await import("@workspace/db");
  const activeId = await getActiveUserId(req);
  const [active] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, activeId))
    .limit(1);
  if (!active || active.role !== "vendor" || !active.vendorId) {
    res.status(403).json({ error: "only vendors can review trainers" });
    return;
  }

  const id = newId("rev");
  await db.insert(reviewsTable).values({
    id,
    trainerId: params.data.id,
    vendorId: active.vendorId,
    rating: body.data.rating,
    comment: body.data.comment,
    engagementTitle: body.data.engagementTitle,
  });
  // Recompute trainer aggregate
  const stats = await db
    .select({
      avg: sql<string>`COALESCE(AVG(${reviewsTable.rating}), 0)`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(reviewsTable)
    .where(eq(reviewsTable.trainerId, params.data.id));
  await db
    .update(trainersTable)
    .set({
      rating: String(Number(stats[0]!.avg).toFixed(2)),
      reviewCount: stats[0]!.count,
    })
    .where(eq(trainersTable.id, params.data.id));

  // Activity
  const { activityTable } = await import("@workspace/db");
  await db.insert(activityTable).values({
    id: newId("act"),
    type: "review",
    title: `${active.name} left a review`,
    subtitle: `${body.data.rating}/5 stars`,
    avatarUrl: active.avatarUrl,
  });

  const [vendor] = await db
    .select()
    .from(vendorsTable)
    .where(eq(vendorsTable.id, active.vendorId))
    .limit(1);

  res.status(201).json({
    id,
    trainerId: params.data.id,
    vendorId: active.vendorId,
    vendorName: vendor?.companyName ?? "Unknown",
    vendorLogoUrl: vendor?.logoUrl ?? undefined,
    rating: body.data.rating,
    comment: body.data.comment,
    engagementTitle: body.data.engagementTitle ?? undefined,
    createdAt: new Date().toISOString(),
  });
});

export default router;
