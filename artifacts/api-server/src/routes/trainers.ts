import express, { Router, type IRouter } from "express";
import { db, trainersTable, reviewsTable, vendorsTable, endorsementsTable, applicationsTable, usersTable, requirementsTable } from "@workspace/db";
import { eq, and, sql, desc, asc, getTableColumns, type SQL } from "drizzle-orm";
import { z } from "zod";
import {
  ListTrainersQueryParams,
  GetTrainerParams,
  UpdateTrainerParams,
  UpdateTrainerBody,
  CreateTrainerReviewParams,
  CreateTrainerReviewBody,
  ListTrainerReviewsParams,
  DeleteTrainerParams,
  RequestTrainerResumeUploadUrlParams,
} from "@workspace/api-zod";
import { getActiveUserId } from "../lib/session";
import { newId } from "../lib/ids";
import { uploadResume, getResumeDownloadUrl, isValidResumeKey } from "../lib/s3";
import { notifyTrainerNewEndorsement } from "../lib/mailer";
import { verifyUnsubscribeToken } from "../lib/unsubscribeToken";

const ALLOWED_RESUME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const MAX_RESUME_BYTES = 10 * 1024 * 1024;

const router: IRouter = Router();

function normalizeCertifications(
  raw: unknown,
): Array<{ name: string; url?: string }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === "string") return { name: item };
      if (item && typeof item === "object" && "name" in item) {
        const o = item as { name?: unknown; url?: unknown };
        if (typeof o.name === "string") {
          return typeof o.url === "string" && o.url.length > 0
            ? { name: o.name, url: o.url }
            : { name: o.name };
        }
      }
      return null;
    })
    .filter((x): x is { name: string; url?: string } => x !== null);
}

function serializeTrainer(t: typeof trainersTable.$inferSelect & { endorsementCount?: number }) {
  return {
    id: t.id,
    name: t.name,
    headline: t.headline,
    mainSkill: t.mainSkill,
    subSkills: t.subSkills ?? [],
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
    gender: t.gender ?? undefined,
    engagedDates: t.engagedDates ?? [],
    endorsementCount: t.endorsementCount ?? 0,
  };
}

router.get("/trainers", async (req, res) => {
  // Must be signed in; vendors cannot browse the trainer list
  let activeId: string | null = null;
  try { activeId = await getActiveUserId(req); } catch { /* unauthenticated */ }
  if (!activeId) {
    res.status(401).json({ error: "authentication required" });
    return;
  }
  const [activeUser] = await db.select().from(usersTable).where(eq(usersTable.id, activeId)).limit(1);
  if (!activeUser || activeUser.role === "vendor") {
    res.status(403).json({ error: "vendors cannot browse trainer profiles" });
    return;
  }

  const parsed = ListTrainersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid query", details: parsed.error.issues });
    return;
  }
  const { q, skill, skills, location, remote, minExperience, gender, sort, limit, offset } = parsed.data;
  const conds: SQL[] = [];
  if (q) {
    const like = `%${q}%`;
    conds.push(
      sql`(${trainersTable.name} ILIKE ${like} OR ${trainersTable.headline} ILIKE ${like} OR ${trainersTable.mainSkill} ILIKE ${like} OR ${trainersTable.location} ILIKE ${like} OR ${trainersTable.subSkills}::text ILIKE ${like})`,
    );
  }
  if (skill) {
    conds.push(
      sql`(${trainersTable.mainSkill} ILIKE ${skill} OR ${trainersTable.subSkills} @> ${JSON.stringify([skill])}::jsonb)`,
    );
  }
  if (skills) {
    const list = skills.split(",").map((s) => s.trim()).filter(Boolean);
    if (list.length > 0) {
      const orParts = list.map(
        (s) =>
          sql`(${trainersTable.mainSkill} ILIKE ${s} OR ${trainersTable.subSkills} @> ${JSON.stringify([s])}::jsonb)`,
      );
      conds.push(sql`(${sql.join(orParts, sql` OR `)})`);
    }
  }
  if (location) {
    const locLike = `%${location}%`;
    conds.push(sql`${trainersTable.location} ILIKE ${locLike}`);
  }
  if (remote !== undefined) {
    conds.push(eq(trainersTable.remote, remote));
  }
  if (minExperience !== undefined) {
    conds.push(sql`${trainersTable.experienceYears} >= ${minExperience}`);
  }
  if (gender) {
    conds.push(eq(trainersTable.gender, gender));
  }
  const where = conds.length > 0 ? and(...conds) : undefined;
  const endorsementCountSq = sql<number>`(SELECT COUNT(*) FROM endorsements WHERE endorsements.trainer_id = ${trainersTable.id})`.as("endorsementCount");
  const baseQuery = db.select({ ...getTableColumns(trainersTable), endorsementCount: endorsementCountSq }).from(trainersTable);
  const orderBy =
    sort === "experience"
      ? desc(trainersTable.experienceYears)
      : sort === "recent"
        ? desc(trainersTable.createdAt)
        : sort === "endorsements"
          ? desc(endorsementCountSq)
          : desc(trainersTable.rating);
  const pageLimit = Math.min(Math.max(1, limit ?? 20), 100);
  const pageOffset = Math.max(0, offset ?? 0);
  const rows = where
    ? await baseQuery.where(where).orderBy(orderBy).limit(pageLimit).offset(pageOffset)
    : await baseQuery.orderBy(orderBy).limit(pageLimit).offset(pageOffset);
  res.json(rows.map(serializeTrainer));
});

router.get("/trainers/featured", async (_req, res) => {
  const endorsementCountSq = sql<number>`(SELECT COUNT(*) FROM endorsements WHERE endorsements.trainer_id = ${trainersTable.id})`.as("endorsementCount");
  const rows = await db
    .select({ ...getTableColumns(trainersTable), endorsementCount: endorsementCountSq })
    .from(trainersTable)
    .orderBy(desc(trainersTable.rating))
    .limit(6);
  res.json(rows.map(serializeTrainer));
});

const PREF_LABELS: Record<string, string> = {
  endorsements: "endorsement emails",
  applicationStatus: "application status emails",
  newRequirementMatch: "requirement match emails",
  messages: "message notification emails",
};

router.get("/trainers/unsubscribe", async (req, res) => {
  const token = typeof req.query.token === "string" ? req.query.token : null;

  const page = (title: string, body: string, color: string) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${title} — Trainers Hive</title>
  <style>
    body{margin:0;font-family:sans-serif;background:#f9fafb;display:flex;align-items:center;justify-content:center;min-height:100vh}
    .card{background:#fff;border-radius:12px;padding:40px 32px;max-width:460px;width:100%;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,.08)}
    h1{margin:0 0 12px;font-size:22px;color:${color}}
    p{margin:0 0 20px;color:#6b7280;font-size:15px}
    a{color:#0f766e;font-weight:600;text-decoration:none}
    .logo{font-size:20px;font-weight:700;color:#0f766e;margin-bottom:28px}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">Trainers Hive</div>
    <h1>${title}</h1>
    ${body}
  </div>
</body>
</html>`;

  if (!token) {
    res.status(400).send(page(
      "Invalid link",
      `<p>This unsubscribe link is missing or invalid. Please visit your <a href="/settings">account settings</a> to manage email preferences.</p>`,
      "#dc2626",
    ));
    return;
  }

  const parsed = verifyUnsubscribeToken(token);
  if (!parsed) {
    res.status(400).send(page(
      "Link expired or invalid",
      `<p>This unsubscribe link has expired or is invalid. Please visit your <a href="/settings">account settings</a> to manage email preferences.</p>`,
      "#dc2626",
    ));
    return;
  }

  const { trainerId, prefKey } = parsed;

  const [existing] = await db
    .select({ emailPrefs: trainersTable.emailPrefs })
    .from(trainersTable)
    .where(eq(trainersTable.id, trainerId))
    .limit(1);

  if (!existing) {
    res.status(404).send(page(
      "Trainer not found",
      `<p>We couldn't find the account associated with this link.</p>`,
      "#dc2626",
    ));
    return;
  }

  const defaults = { endorsements: true, applicationStatus: true, newRequirementMatch: true, messages: true };
  const merged = { ...defaults, ...(existing.emailPrefs ?? {}), [prefKey]: false };

  await db
    .update(trainersTable)
    .set({ emailPrefs: merged })
    .where(eq(trainersTable.id, trainerId));

  const label = PREF_LABELS[prefKey] ?? prefKey;
  res.send(page(
    "Unsubscribed",
    `<p>You have been unsubscribed from <strong>${label}</strong>.</p>
     <p>You can re-enable this at any time in your <a href="/settings">account settings</a>.</p>`,
    "#0f766e",
  ));
});

router.get("/trainers/:id", async (req, res) => {
  const params = GetTrainerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid params" });
    return;
  }

  // Must be signed in
  let activeId: string | null = null;
  try { activeId = await getActiveUserId(req); } catch { /* unauthenticated */ }
  if (!activeId) {
    res.status(401).json({ error: "authentication required" });
    return;
  }

  const [activeUser] = await db.select().from(usersTable).where(eq(usersTable.id, activeId)).limit(1);
  if (!activeUser) {
    res.status(401).json({ error: "authentication required" });
    return;
  }

  // Vendors may only view a trainer who has applied to one of their requirements
  if (activeUser.role === "vendor") {
    if (!activeUser.vendorId) {
      res.status(403).json({ error: "access denied" });
      return;
    }
    // Check: does this trainer have any application on a requirement owned by this vendor?
    const [application] = await db
      .select({ id: applicationsTable.id })
      .from(applicationsTable)
      .innerJoin(requirementsTable, eq(applicationsTable.requirementId, requirementsTable.id))
      .where(
        and(
          eq(applicationsTable.trainerId, params.data.id),
          eq(requirementsTable.vendorId, activeUser.vendorId),
        ),
      )
      .limit(1);
    if (!application) {
      res.status(403).json({ error: "you can only view trainers who have applied to your requirements" });
      return;
    }
  }

  const endorsementCountSq = sql<number>`(SELECT COUNT(*) FROM endorsements WHERE endorsements.trainer_id = ${trainersTable.id})`.as("endorsementCount");
  const rows = await db
    .select({ ...getTableColumns(trainersTable), endorsementCount: endorsementCountSq })
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
    certifications: normalizeCertifications(t.certifications),
    languages: t.languages ?? [],
    completedTrainings: t.completedTrainings,
    portfolioUrl: t.portfolioUrl ?? undefined,
    resumeUrl: t.resumeUrl ?? undefined,
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

  // Validate trainerType enum
  if (body.data.trainerType !== undefined && body.data.trainerType !== null) {
    const allowed = new Set(["trainer", "developer", "both"]);
    if (!allowed.has(body.data.trainerType)) {
      res.status(400).json({ error: "trainerType must be one of trainer, developer, both" });
      return;
    }
  }

  // Validate certifications
  if (body.data.certifications) {
    for (const c of body.data.certifications) {
      if (!c || typeof c.name !== "string" || c.name.trim().length === 0) {
        res.status(400).json({ error: "certifications: each item must have a non-empty name" });
        return;
      }
      if (c.name.length > 200) {
        res.status(400).json({ error: "certifications: name must be 200 chars or less" });
        return;
      }
      if (c.url !== undefined && c.url !== null && c.url !== "") {
        try {
          new URL(c.url);
        } catch {
          res.status(400).json({ error: `certifications: "${c.name}" url is not a valid URL` });
          return;
        }
      }
    }
  }

  // Validate resumeUrl: must be empty/null (clear) or a valid http(s) URL.
  // Trainers paste a shareable link (Drive, Dropbox, personal site, etc.) — we accept any URL.
  if (body.data.resumeUrl !== undefined && body.data.resumeUrl !== null && body.data.resumeUrl !== "") {
    try {
      const u = new URL(body.data.resumeUrl);
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        res.status(400).json({ error: "resumeUrl must be an http or https URL" });
        return;
      }
      if (body.data.resumeUrl.length > 2000) {
        res.status(400).json({ error: "resumeUrl must be 2000 characters or less" });
        return;
      }
    } catch {
      res.status(400).json({ error: "resumeUrl must be a valid URL" });
      return;
    }
  }

  // Validate experience years: integers in 0..80
  if (body.data.experienceYears !== undefined) {
    const v = body.data.experienceYears;
    if (!Number.isInteger(v) || v < 0 || v > 80) {
      res.status(400).json({ error: "experienceYears must be an integer 0..80" });
      return;
    }
  }
  if (body.data.developmentExperienceYears !== undefined) {
    const v = body.data.developmentExperienceYears;
    if (!Number.isInteger(v) || v < 0 || v > 80) {
      res.status(400).json({ error: "developmentExperienceYears must be an integer 0..80" });
      return;
    }
  }

  const update: Partial<typeof trainersTable.$inferInsert> = {};
  // Fields that store NULL when the client sends "" (clearing intent).
  const NULLABLE_ON_EMPTY = new Set(["resumeUrl", "trainerType", "portfolioUrl"]);
  for (const [k, v] of Object.entries(body.data)) {
    if (v === undefined) continue;
    if (NULLABLE_ON_EMPTY.has(k) && v === "") {
      (update as Record<string, unknown>)[k] = null;
    } else {
      (update as Record<string, unknown>)[k] = v;
    }
  }
  if (Object.keys(update).length > 0) {
    await db
      .update(trainersTable)
      .set(update)
      .where(eq(trainersTable.id, params.data.id));
  }
  const endorsementCountSqPatch = sql<number>`(SELECT COUNT(*) FROM endorsements WHERE endorsements.trainer_id = ${trainersTable.id})`.as("endorsementCount");
  const rows = await db
    .select({ ...getTableColumns(trainersTable), endorsementCount: endorsementCountSqPatch })
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
    certifications: normalizeCertifications(t.certifications),
    languages: t.languages ?? [],
    completedTrainings: t.completedTrainings,
    portfolioUrl: t.portfolioUrl ?? undefined,
    resumeUrl: t.resumeUrl ?? undefined,
  });
});

router.post(
  "/trainers/:id/resume",
  express.raw({ type: "*/*", limit: "11mb" }),
  async (req, res) => {
    const params = RequestTrainerResumeUploadUrlParams.safeParse(req.params);
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
      res.status(401).json({ error: "not authenticated" });
      return;
    }
    const isOwner = active.role === "trainer" && active.trainerId === params.data.id;
    const isAdmin = active.role === "admin";
    if (!isOwner && !isAdmin) {
      res.status(403).json({ error: "not allowed to upload resume for this trainer" });
      return;
    }

    const contentType = (req.headers["content-type"] ?? "").split(";")[0]!.trim();
    if (!ALLOWED_RESUME_TYPES.has(contentType)) {
      res.status(400).json({ error: "Resume must be a PDF, DOC, or DOCX file" });
      return;
    }

    const fileBuffer = req.body as Buffer;
    if (!Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
      res.status(400).json({ error: "No file data received" });
      return;
    }
    if (fileBuffer.length > MAX_RESUME_BYTES) {
      res.status(400).json({ error: "Resume must be 10 MB or smaller" });
      return;
    }

    try {
      const { objectKey } = await uploadResume(fileBuffer, contentType);
      res.json({ objectPath: objectKey });
    } catch (err) {
      req.log.error({ err }, "Failed to upload resume to S3");
      res.status(500).json({ error: "Failed to upload resume to storage" });
    }
  },
);

router.get("/trainers/:id/resume/url", async (req, res) => {
  const params = GetTrainerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid params" });
    return;
  }
  const activeId = await getActiveUserId(req);
  const [active] = activeId
    ? await db.select().from(usersTable).where(eq(usersTable.id, activeId)).limit(1)
    : [];
  if (!active) {
    res.status(401).json({ error: "not authenticated" });
    return;
  }
  const isOwner = active.role === "trainer" && active.trainerId === params.data.id;
  const isVendor = active.role === "vendor";
  const isAdmin = active.role === "admin";
  if (!isOwner && !isVendor && !isAdmin) {
    res.status(403).json({ error: "not authorized" });
    return;
  }
  const [trainer] = await db
    .select({ resumeUrl: trainersTable.resumeUrl })
    .from(trainersTable)
    .where(eq(trainersTable.id, params.data.id))
    .limit(1);
  if (!trainer) {
    res.status(404).json({ error: "trainer not found" });
    return;
  }
  if (!trainer.resumeUrl) {
    res.status(404).json({ error: "no resume on file" });
    return;
  }
  if (!isValidResumeKey(trainer.resumeUrl)) {
    res.status(404).json({ error: "no resume on file" });
    return;
  }
  const signedUrl = await getResumeDownloadUrl(trainer.resumeUrl);
  res.json({ url: signedUrl });
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
      ratingContent: r.review.ratingContent ?? undefined,
      ratingDelivery: r.review.ratingDelivery ?? undefined,
      ratingPunctuality: r.review.ratingPunctuality ?? undefined,
      ratingCommunication: r.review.ratingCommunication ?? undefined,
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

  const { ratingContent, ratingDelivery, ratingPunctuality, ratingCommunication, comment, engagementTitle } = body.data;
  const aggregateRating = Math.round(
    (ratingContent + ratingDelivery + ratingPunctuality + ratingCommunication) / 4,
  );

  const id = newId("rev");
  await db.insert(reviewsTable).values({
    id,
    trainerId: params.data.id,
    vendorId: active.vendorId,
    rating: aggregateRating,
    ratingContent,
    ratingDelivery,
    ratingPunctuality,
    ratingCommunication,
    comment,
    engagementTitle,
  });
  // Recompute trainer aggregate: use exact dimension averages for new reviews,
  // fall back to stored integer rating for legacy reviews (no dimension columns).
  const stats = await db
    .select({
      avg: sql<string>`COALESCE(AVG(
        CASE WHEN ${reviewsTable.ratingContent} IS NOT NULL
          THEN (${reviewsTable.ratingContent}::float +
                ${reviewsTable.ratingDelivery}::float +
                ${reviewsTable.ratingPunctuality}::float +
                ${reviewsTable.ratingCommunication}::float) / 4.0
          ELSE ${reviewsTable.rating}::float
        END
      ), 0)`,
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
    subtitle: `${aggregateRating}/5 stars`,
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
    rating: aggregateRating,
    ratingContent,
    ratingDelivery,
    ratingPunctuality,
    ratingCommunication,
    comment,
    engagementTitle: engagementTitle ?? undefined,
    createdAt: new Date().toISOString(),
  });
});

// ── Endorsements ─────────────────────────────────────────────────────────────

const EndorsementParams = z.object({ id: z.string().min(1) });
const EndorsementIdParams = z.object({ id: z.string().min(1), endorsementId: z.string().min(1) });
const EndorsementBody = z.object({ text: z.string().min(1).max(300) });

router.get("/trainers/:id/endorsements", async (req, res) => {
  const params = EndorsementParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "invalid params" }); return; }

  const rows = await db
    .select({ endorsement: endorsementsTable, vendor: vendorsTable })
    .from(endorsementsTable)
    .leftJoin(vendorsTable, eq(endorsementsTable.vendorId, vendorsTable.id))
    .where(eq(endorsementsTable.trainerId, params.data.id))
    .orderBy(desc(endorsementsTable.createdAt));

  const endorsements = rows.map((r) => ({
    id: r.endorsement.id,
    trainerId: r.endorsement.trainerId,
    vendorId: r.endorsement.vendorId,
    vendorName: r.vendor?.companyName ?? "Unknown",
    vendorLogoUrl: r.vendor?.logoUrl ?? undefined,
    text: r.endorsement.text,
    createdAt: r.endorsement.createdAt.toISOString(),
  }));

  // Compute canEndorse for authenticated vendor callers
  let canEndorse = false;
  try {
    const activeId = await getActiveUserId(req);
    const [active] = await db.select().from(usersTable).where(eq(usersTable.id, activeId)).limit(1);
    if (active?.role === "vendor" && active.vendorId) {
      // canEndorse = has completed engagement AND has not already endorsed
      const alreadyEndorsed = endorsements.some((e) => e.vendorId === active.vendorId);
      if (!alreadyEndorsed) {
        const [completed] = await db
          .select({ id: applicationsTable.id })
          .from(applicationsTable)
          .innerJoin(requirementsTable, eq(applicationsTable.requirementId, requirementsTable.id))
          .where(and(
            eq(applicationsTable.trainerId, params.data.id),
            eq(requirementsTable.vendorId, active.vendorId),
            eq(applicationsTable.status, "completed"),
          ))
          .limit(1);
        canEndorse = !!completed;
      }
    }
  } catch {
    // unauthenticated — canEndorse stays false
  }

  res.json({ endorsements, canEndorse });
});

router.post("/trainers/:id/endorsements", async (req, res) => {
  const params = EndorsementParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "invalid params" }); return; }
  const body = EndorsementBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "invalid body", details: body.error.issues }); return; }

  const activeId = await getActiveUserId(req);
  const [active] = await db.select().from(usersTable).where(eq(usersTable.id, activeId)).limit(1);
  if (!active || active.role !== "vendor" || !active.vendorId) {
    res.status(403).json({ error: "only vendors can endorse trainers" }); return;
  }

  // Require at least one completed application from this vendor for this trainer
  // Applications link to requirements which carry the vendorId
  const [completed] = await db
    .select({ id: applicationsTable.id })
    .from(applicationsTable)
    .innerJoin(requirementsTable, eq(applicationsTable.requirementId, requirementsTable.id))
    .where(and(
      eq(applicationsTable.trainerId, params.data.id),
      eq(requirementsTable.vendorId, active.vendorId),
      eq(applicationsTable.status, "completed"),
    ))
    .limit(1);
  if (!completed) {
    res.status(403).json({ error: "you must have a completed engagement with this trainer to endorse them" }); return;
  }

  const id = newId("end");
  try {
    await db.insert(endorsementsTable).values({
      id,
      trainerId: params.data.id,
      vendorId: active.vendorId,
      text: body.data.text,
    });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "23505") {
      res.status(409).json({ error: "you have already endorsed this trainer" }); return;
    }
    throw err;
  }

  const [[vendor], [trainerRow], [trainerUser], [trainerPrefsRow]] = await Promise.all([
    db.select().from(vendorsTable).where(eq(vendorsTable.id, active.vendorId)).limit(1),
    db.select({ name: trainersTable.name }).from(trainersTable).where(eq(trainersTable.id, params.data.id)).limit(1),
    db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.trainerId, params.data.id)).limit(1),
    db.select({ emailPrefs: trainersTable.emailPrefs }).from(trainersTable).where(eq(trainersTable.id, params.data.id)).limit(1),
  ]);

  const emailPrefs = trainerPrefsRow?.emailPrefs ?? { endorsements: true, applicationStatus: true, newRequirementMatch: true, messages: true };
  if (trainerUser?.email && trainerRow?.name && vendor && emailPrefs.endorsements !== false) {
    const domain = process.env.APP_DOMAIN?.trim() ?? "";
    const profileUrl = domain
      ? `https://${domain}/trainers/${params.data.id}`
      : `/trainers/${params.data.id}`;
    notifyTrainerNewEndorsement({
      trainerEmail: trainerUser.email,
      trainerName: trainerRow.name,
      vendorName: vendor.companyName,
      endorsementSnippet: body.data.text,
      profileUrl,
      trainerId: params.data.id,
    }).catch(() => {});
  }

  res.status(201).json({
    id,
    trainerId: params.data.id,
    vendorId: active.vendorId,
    vendorName: vendor?.companyName ?? "Unknown",
    vendorLogoUrl: vendor?.logoUrl ?? undefined,
    text: body.data.text,
    createdAt: new Date().toISOString(),
  });
});

router.put("/trainers/:id/endorsements/:endorsementId", async (req, res) => {
  const params = EndorsementIdParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "invalid params" }); return; }
  const body = EndorsementBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "invalid body", details: body.error.issues }); return; }

  const activeId = await getActiveUserId(req);
  const [active] = await db.select().from(usersTable).where(eq(usersTable.id, activeId)).limit(1);
  if (!active || active.role !== "vendor" || !active.vendorId) {
    res.status(403).json({ error: "not authorized" }); return;
  }

  const [existing] = await db
    .select()
    .from(endorsementsTable)
    .where(and(eq(endorsementsTable.id, params.data.endorsementId), eq(endorsementsTable.trainerId, params.data.id)))
    .limit(1);
  if (!existing) { res.status(404).json({ error: "endorsement not found" }); return; }
  if (existing.vendorId !== active.vendorId) { res.status(403).json({ error: "not your endorsement" }); return; }

  await db.update(endorsementsTable)
    .set({ text: body.data.text })
    .where(and(eq(endorsementsTable.id, params.data.endorsementId), eq(endorsementsTable.trainerId, params.data.id)));

  const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, active.vendorId)).limit(1);
  res.json({
    id: existing.id,
    trainerId: existing.trainerId,
    vendorId: existing.vendorId,
    vendorName: vendor?.companyName ?? "Unknown",
    vendorLogoUrl: vendor?.logoUrl ?? undefined,
    text: body.data.text,
    createdAt: existing.createdAt.toISOString(),
  });
});

router.delete("/trainers/:id/endorsements/:endorsementId", async (req, res) => {
  const params = EndorsementIdParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "invalid params" }); return; }

  const activeId = await getActiveUserId(req);
  const [active] = await db.select().from(usersTable).where(eq(usersTable.id, activeId)).limit(1);
  if (!active || active.role !== "vendor" || !active.vendorId) {
    res.status(403).json({ error: "not authorized" }); return;
  }

  const [existing] = await db
    .select()
    .from(endorsementsTable)
    .where(and(eq(endorsementsTable.id, params.data.endorsementId), eq(endorsementsTable.trainerId, params.data.id)))
    .limit(1);
  if (!existing) { res.status(404).json({ error: "endorsement not found" }); return; }
  if (existing.vendorId !== active.vendorId) { res.status(403).json({ error: "not your endorsement" }); return; }

  await db.delete(endorsementsTable).where(and(eq(endorsementsTable.id, params.data.endorsementId), eq(endorsementsTable.trainerId, params.data.id)));
  res.status(204).send();
});

const EmailPrefsBody = z.object({
  endorsements: z.boolean().optional(),
  applicationStatus: z.boolean().optional(),
  newRequirementMatch: z.boolean().optional(),
  messages: z.boolean().optional(),
});

router.get("/trainers/:id/email-prefs", async (req, res) => {
  const params = z.object({ id: z.string() }).safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "invalid params" }); return; }

  const activeId = await getActiveUserId(req);
  const [active] = await db.select().from(usersTable).where(eq(usersTable.id, activeId)).limit(1);
  if (!active) { res.status(401).json({ error: "unauthenticated" }); return; }
  if (active.role !== "trainer" || active.trainerId !== params.data.id) {
    res.status(403).json({ error: "not authorized" }); return;
  }

  const [trainer] = await db
    .select({ emailPrefs: trainersTable.emailPrefs })
    .from(trainersTable)
    .where(eq(trainersTable.id, params.data.id))
    .limit(1);
  if (!trainer) { res.status(404).json({ error: "trainer not found" }); return; }

  const defaults = { endorsements: true, applicationStatus: true, newRequirementMatch: true, messages: true };
  res.json({ ...defaults, ...(trainer.emailPrefs ?? {}) });
});

router.patch("/trainers/:id/email-prefs", async (req, res) => {
  const params = z.object({ id: z.string() }).safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "invalid params" }); return; }
  const body = EmailPrefsBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "invalid body", details: body.error.issues }); return; }

  const activeId = await getActiveUserId(req);
  const [active] = await db.select().from(usersTable).where(eq(usersTable.id, activeId)).limit(1);
  if (!active) { res.status(401).json({ error: "unauthenticated" }); return; }
  if (active.role !== "trainer" || active.trainerId !== params.data.id) {
    res.status(403).json({ error: "not authorized" }); return;
  }

  const [existing] = await db
    .select({ emailPrefs: trainersTable.emailPrefs })
    .from(trainersTable)
    .where(eq(trainersTable.id, params.data.id))
    .limit(1);
  if (!existing) { res.status(404).json({ error: "trainer not found" }); return; }

  const defaults = { endorsements: true, applicationStatus: true, newRequirementMatch: true, messages: true };
  const merged = { ...defaults, ...(existing.emailPrefs ?? {}), ...body.data };

  await db
    .update(trainersTable)
    .set({ emailPrefs: merged })
    .where(eq(trainersTable.id, params.data.id));

  res.json(merged);
});

export default router;
