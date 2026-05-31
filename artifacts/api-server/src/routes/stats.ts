import { Router, type IRouter } from "express";
import {
  db,
  requirementsTable,
  applicationsTable,
  trainersTable,
  vendorsTable,
  reviewsTable,
  activityTable,
  usersTable,
} from "@workspace/db";
import { eq, desc, sql, gte } from "drizzle-orm";
import { getActiveUserId } from "../lib/session";

const router: IRouter = Router();

function trendBuckets(rows: { createdAt: Date }[]) {
  const days = 14;
  const result: { date: string; count: number }[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    result.push({ date: key, count: 0 });
  }
  const map = new Map(result.map((r) => [r.date, r]));
  for (const row of rows) {
    const key = row.createdAt.toISOString().slice(0, 10);
    const bucket = map.get(key);
    if (bucket) bucket.count += 1;
  }
  return result;
}

router.get("/stats/vendor", async (req, res) => {
  const activeId = await getActiveUserId(req);
  const [active] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, activeId))
    .limit(1);
  if (!active || active.role !== "vendor" || !active.vendorId) {
    res.json({
      totalRequirements: 0,
      openRequirements: 0,
      applicationsReceived: 0,
      shortlistedTrainers: 0,
      hiredTrainers: 0,
      skillBreakdown: [],
      applicationsTrend: trendBuckets([]),
    });
    return;
  }
  const reqs = await db
    .select()
    .from(requirementsTable)
    .where(eq(requirementsTable.vendorId, active.vendorId));
  const reqIds = reqs.map((r) => r.id);
  let apps: { status: string; createdAt: Date }[] = [];
  if (reqIds.length > 0) {
    apps = await db
      .select({
        status: applicationsTable.status,
        createdAt: applicationsTable.createdAt,
      })
      .from(applicationsTable)
      .where(sql`${applicationsTable.requirementId} IN ${reqIds}`);
  }
  const skillMap = new Map<string, number>();
  for (const r of reqs) {
    skillMap.set(r.skill, (skillMap.get(r.skill) ?? 0) + 1);
  }
  res.json({
    totalRequirements: reqs.length,
    openRequirements: reqs.filter((r) => r.status === "open").length,
    applicationsReceived: apps.length,
    shortlistedTrainers: apps.filter((a) => a.status === "shortlisted").length,
    hiredTrainers: apps.filter((a) => a.status === "hired").length,
    skillBreakdown: Array.from(skillMap.entries())
      .map(([skill, count]) => ({ skill, count }))
      .sort((a, b) => b.count - a.count),
    applicationsTrend: trendBuckets(apps),
  });
});

router.get("/stats/trainer", async (req, res) => {
  const activeId = await getActiveUserId(req);
  const [active] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, activeId))
    .limit(1);
  if (!active || active.role !== "trainer" || !active.trainerId) {
    res.json({
      applicationsSent: 0,
      shortlisted: 0,
      hired: 0,
      averageRating: 0,
      totalReviews: 0,
      profileViews: 0,
      applicationsTrend: trendBuckets([]),
    });
    return;
  }
  const apps = await db
    .select({ status: applicationsTable.status, createdAt: applicationsTable.createdAt })
    .from(applicationsTable)
    .where(eq(applicationsTable.trainerId, active.trainerId));
  const [trainer] = await db
    .select()
    .from(trainersTable)
    .where(eq(trainersTable.id, active.trainerId))
    .limit(1);
  res.json({
    applicationsSent: apps.length,
    shortlisted: apps.filter((a) => a.status === "shortlisted").length,
    hired: apps.filter((a) => a.status === "hired").length,
    averageRating: trainer ? Number(trainer.rating) : 0,
    totalReviews: trainer?.reviewCount ?? 0,
    profileViews: 247,
    applicationsTrend: trendBuckets(apps),
  });
});

router.get("/stats/platform", async (_req, res) => {
  const [{ trainerCount } = { trainerCount: 0 }] = await db
    .select({ trainerCount: sql<number>`COUNT(*)::int` })
    .from(trainersTable);
  const [{ vendorCount } = { vendorCount: 0 }] = await db
    .select({ vendorCount: sql<number>`COUNT(*)::int` })
    .from(vendorsTable);
  const [{ openCount } = { openCount: 0 }] = await db
    .select({ openCount: sql<number>`COUNT(*)::int` })
    .from(requirementsTable)
    .where(eq(requirementsTable.status, "open"));
  const [{ hireCount } = { hireCount: 0 }] = await db
    .select({ hireCount: sql<number>`COUNT(*)::int` })
    .from(applicationsTable)
    .where(eq(applicationsTable.status, "hired"));
  const reqs = await db.select({ skill: requirementsTable.skill }).from(requirementsTable);
  const skillMap = new Map<string, number>();
  for (const r of reqs) {
    skillMap.set(r.skill, (skillMap.get(r.skill) ?? 0) + 1);
  }
  res.json({
    trainerCount,
    vendorCount,
    openRequirementCount: openCount,
    completedEngagements: hireCount,
    skillBreakdown: Array.from(skillMap.entries())
      .map(([skill, count]) => ({ skill, count }))
      .sort((a, b) => b.count - a.count),
  });
  void reviewsTable;
});

function weeklyBuckets(rows: { createdAt: Date }[], weeksBack = 12) {
  const result: { week: string; count: number }[] = [];
  const now = new Date();
  for (let i = weeksBack - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i * 7);
    result.push({ week: d.toISOString().slice(0, 10), count: 0 });
  }
  const startMs = new Date(result[0].week + "T00:00:00Z").getTime();
  for (const row of rows) {
    const ms = row.createdAt.getTime() - startMs;
    if (ms < 0) continue;
    const idx = Math.floor(ms / (7 * 24 * 60 * 60 * 1000));
    if (idx < weeksBack) result[idx].count += 1;
  }
  return result;
}

router.get("/admin/analytics", async (req, res) => {
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
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 84); // 12 weeks

  const [trainerRows, appRows, reqRows] = await Promise.all([
    db.select({ createdAt: trainersTable.createdAt }).from(trainersTable).where(gte(trainersTable.createdAt, cutoff)),
    db.select({ createdAt: applicationsTable.createdAt }).from(applicationsTable).where(gte(applicationsTable.createdAt, cutoff)),
    db.select({ createdAt: requirementsTable.createdAt }).from(requirementsTable).where(gte(requirementsTable.createdAt, cutoff)),
  ]);

  res.json({
    trainerSignupsTrend: weeklyBuckets(trainerRows),
    applicationsTrend: weeklyBuckets(appRows),
    requirementsTrend: weeklyBuckets(reqRows),
  });
});

router.get("/activity", async (req, res) => {
  const userId = await getActiveUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Sign in to view platform activity" });
    return;
  }
  const rows = await db
    .select()
    .from(activityTable)
    .orderBy(desc(activityTable.createdAt))
    .limit(20);
  res.json(
    rows.map((a) => ({
      id: a.id,
      type: a.type,
      title: a.title,
      subtitle: a.subtitle,
      createdAt: a.createdAt.toISOString(),
      avatarUrl: a.avatarUrl ?? undefined,
    })),
  );
});

export default router;
