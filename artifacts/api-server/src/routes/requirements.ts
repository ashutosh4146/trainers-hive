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
import { eq, and, desc, asc, sql, inArray, type SQL } from "drizzle-orm";
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
  FlagRequirementParams,
  FlagRequirementBody,
  UnflagRequirementParams,
  HideRequirementParams,
  WarnRequirementVendorParams,
  WarnRequirementVendorBody,
} from "@workspace/api-zod";
import { newId } from "../lib/ids";
import { getActiveUserId } from "../lib/session";
import { notifyVendorNewApplication, notifyTrainerNewRequirementMatch, notifyVendorWarning } from "../lib/mailer";
import { resolveVendorEmailPrefs } from "../lib/vendor-email-prefs";
import { openai } from "@workspace/integrations-openai-ai-server";

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
    audienceType: r.audienceType ?? undefined,
    audienceCount: r.audienceCount ?? undefined,
    flagged: r.flagged ?? false,
    flagReason: r.flagReason ?? undefined,
    flaggedBy: r.flaggedBy ?? undefined,
    flaggedAt: r.flaggedAt?.toISOString() ?? undefined,
    vendorVerified: vendor?.verified ?? false,
    isUrgent: r.isUrgent ?? false,
    isFeatured: r.isFeatured ?? false,
    isPrivate: r.isPrivate ?? false,
    hireThroughUs: r.hireThroughUs ?? false,
    hidden: r.hidden ?? false,
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
  const { q, skill, location, remote, status, vendorId, sort, flagged, skills, limit, offset } = parsed.data as typeof parsed.data & { skills?: string; limit?: number; offset?: number };

  // Detect session — used for private gating and trainer relevance ranking
  let isAuthenticated = false;
  let isAdmin = false;
  let trainerMainSkill: string | null = null;
  let trainerSubSkills: string[] = [];
  try {
    const activeId = await getActiveUserId(req);
    if (activeId) {
      isAuthenticated = true;
      const [activeUser] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, activeId))
        .limit(1);
      if (activeUser?.role === "admin") isAdmin = true;
      if (activeUser?.role === "trainer" && activeUser.trainerId) {
        const [trainerRow] = await db
          .select({ mainSkill: trainersTable.mainSkill, subSkills: trainersTable.subSkills })
          .from(trainersTable)
          .where(eq(trainersTable.id, activeUser.trainerId))
          .limit(1);
        if (trainerRow) {
          trainerMainSkill = trainerRow.mainSkill;
          trainerSubSkills = (trainerRow.subSkills as string[]) ?? [];
        }
      }
    }
  } catch {
    // not authenticated — hide private requirements
  }

  const isTrainerSession = trainerMainSkill !== null;

  const conds: SQL[] = [];
  if (q) {
    const like = `%${q}%`;
    conds.push(
      sql`(${requirementsTable.title} ILIKE ${like} OR ${requirementsTable.description} ILIKE ${like})`,
    );
  }
  // Single legacy param OR new comma-separated multi-skills
  const skillList = skills
    ? skills.split(",").map((s) => s.trim()).filter(Boolean)
    : skill
      ? [skill]
      : [];
  if (skillList.length > 0) {
    const orClauses = skillList.map(
      (s) => sql`(${requirementsTable.skill} ILIKE ${`%${s}%`} OR ${requirementsTable.subSkills} @> ${JSON.stringify([s])}::jsonb)`,
    );
    conds.push(sql`(${sql.join(orClauses, sql` OR `)})`);
  }
  if (location) conds.push(eq(requirementsTable.location, location));
  if (remote !== undefined) conds.push(eq(requirementsTable.remote, remote));
  if (status) conds.push(eq(requirementsTable.status, status));
  if (vendorId) conds.push(eq(requirementsTable.vendorId, vendorId));
  if (flagged !== undefined) conds.push(eq(requirementsTable.flagged, flagged));
  // Hide private requirements from guests
  if (!isAuthenticated) conds.push(eq(requirementsTable.isPrivate, false));
  // Always hide "hire through us" requirements from the public listing
  conds.push(eq(requirementsTable.hireThroughUs, false));
  // Hide admin-hidden requirements from non-admins
  if (!isAdmin) conds.push(eq(requirementsTable.hidden, false));

  // For trainer sessions, restrict to requirements where at least one skill overlaps
  if (isTrainerSession) {
    const trainerAllSkills = [trainerMainSkill!, ...trainerSubSkills];
    // requirement.skill matches any of trainer's skills  OR
    // requirement has at least one subSkill that matches any of trainer's skills
    const skillJsonb = JSON.stringify(trainerAllSkills);
    conds.push(
      sql`(
        ${requirementsTable.skill} = ANY(ARRAY(SELECT jsonb_array_elements_text(${skillJsonb}::jsonb)))
        OR ${requirementsTable.subSkills} ?| ARRAY(SELECT jsonb_array_elements_text(${skillJsonb}::jsonb))
      )`,
    );
  }

  const where = conds.length > 0 ? and(...conds) : undefined;

  // Trainer relevance ordering: main-skill match → sub-skill match → date
  let orderBy: SQL;
  if (isTrainerSession && !sort) {
    const mainSkillJson = JSON.stringify(trainerMainSkill);
    const subSkillsJson = JSON.stringify(trainerSubSkills);
    orderBy = sql`
      CASE
        WHEN ${requirementsTable.skill} = ${trainerMainSkill}
          OR ${requirementsTable.subSkills} @> ${mainSkillJson}::jsonb THEN 1
        ELSE 2
      END ASC,
      CASE
        WHEN ${requirementsTable.subSkills} ?| ARRAY(SELECT jsonb_array_elements_text(${subSkillsJson}::jsonb)) THEN 1
        ELSE 2
      END ASC,
      ${requirementsTable.createdAt} DESC
    `;
  } else {
    orderBy =
      sort === "deadline"
        ? asc(requirementsTable.deadline)
        : sort === "budget"
          ? desc(requirementsTable.budget)
          : desc(requirementsTable.createdAt);
  }

  // Featured requirements always surface first, then apply the secondary sort
  const pageLimit = Math.min(Math.max(1, limit ?? 20), 100);
  const pageOffset = Math.max(0, offset ?? 0);
  const rows = where
    ? await db.select().from(requirementsTable).where(where).orderBy(desc(requirementsTable.isFeatured), orderBy).limit(pageLimit).offset(pageOffset)
    : await db.select().from(requirementsTable).orderBy(desc(requirementsTable.isFeatured), orderBy).limit(pageLimit).offset(pageOffset);
  res.json(await fetchListWithCounts(rows));
});

router.get("/requirements/recent", async (_req, res) => {
  const rows = await db
    .select()
    .from(requirementsTable)
    .where(and(eq(requirementsTable.status, "open"), eq(requirementsTable.hireThroughUs, false)))
    .orderBy(desc(requirementsTable.isFeatured), desc(requirementsTable.createdAt))
    .limit(8);
  res.json(await fetchListWithCounts(rows));
});

router.post("/requirements", async (req, res) => {
  const parsed = CreateRequirementBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid body", details: parsed.error.issues });
    return;
  }
  const rawAudience = typeof (req.body as { audienceType?: unknown })?.audienceType === "string"
    ? ((req.body as { audienceType: string }).audienceType.trim().toLowerCase())
    : "";
  if (rawAudience !== "freshers" && rawAudience !== "lateral") {
    res.status(400).json({ error: "audienceType is required and must be 'freshers' or 'lateral'" });
    return;
  }
  const audienceType = rawAudience;
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
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (deadline < today) {
    res.status(400).json({ error: "Deadline cannot be in the past" });
    return;
  }
  const startDate = parsed.data.startDate ? new Date(parsed.data.startDate) : null;
  if (startDate && startDate < today) {
    res.status(400).json({ error: "Training start date cannot be in the past" });
    return;
  }
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
    audienceType,
    audienceCount: parsed.data.audienceCount,
    isUrgent: parsed.data.isUrgent ?? false,
    isFeatured: parsed.data.isFeatured ?? false,
    isPrivate: parsed.data.isPrivate ?? false,
    hireThroughUs: parsed.data.hireThroughUs ?? false,
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

  // Fire-and-forget: notify matching trainers who have opted in
  (async () => {
    try {
      const reqSkill = parsed.data.skill;
      const reqSubSkills = parsed.data.subSkills ?? [];
      const allReqSkills = [reqSkill, ...reqSubSkills];
      const skillJsonb = JSON.stringify(allReqSkills);
      const matchingTrainers = await db
        .select({
          id: trainersTable.id,
          name: trainersTable.name,
          emailPrefs: trainersTable.emailPrefs,
        })
        .from(trainersTable)
        .where(
          sql`(
            ${trainersTable.mainSkill} = ANY(ARRAY(SELECT jsonb_array_elements_text(${skillJsonb}::jsonb)))
            OR ${trainersTable.subSkills} ?| ARRAY(SELECT jsonb_array_elements_text(${skillJsonb}::jsonb))
          )`,
        );

      const domain = process.env.APP_DOMAIN?.trim() ?? "";
      const requirementUrl = domain
        ? `https://${domain}/requirements/${id}`
        : `/requirements/${id}`;

      await Promise.allSettled(
        matchingTrainers.map(async (trainer) => {
          const prefs = trainer.emailPrefs ?? { endorsements: true, applicationStatus: true, newRequirementMatch: true, messages: true };
          if (prefs.newRequirementMatch === false) return;
          const [trainerUser] = await db
            .select({ email: usersTable.email })
            .from(usersTable)
            .where(eq(usersTable.trainerId, trainer.id))
            .limit(1);
          if (!trainerUser?.email) return;
          return notifyTrainerNewRequirementMatch({
            trainerEmail: trainerUser.email,
            trainerName: trainer.name,
            requirementTitle: parsed.data.title,
            vendorName: vendor?.companyName ?? "a vendor",
            skill: reqSkill,
            requirementUrl,
            trainerId: trainer.id,
          });
        }),
      );
    } catch {
      // swallow — email notification is best-effort
    }
  })();

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

  // Only the owning vendor or an admin sees contact details
  let showContact = false;
  try {
    const activeId = await getActiveUserId(req);
    if (activeId) {
      const [active] = await db.select().from(usersTable).where(eq(usersTable.id, activeId)).limit(1);
      if (active && (active.role === "admin" || (active.role === "vendor" && active.vendorId === r.vendorId))) {
        showContact = true;
      }
    }
  } catch {
    // not authenticated
  }

  res.json({
    ...card,
    description: r.description,
    vendor: vendor
      ? {
          id: vendor.id,
          companyName: vendor.companyName,
          industry: vendor.industry,
          location: vendor.location,
          ...(showContact ? {
            contactName: vendor.contactName,
            contactDesignation: vendor.contactDesignation,
            email: vendor.email,
          } : {}),
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

  const activeId = await getActiveUserId(req);
  const [active] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, activeId))
    .limit(1);

  const [existing] = await db
    .select()
    .from(requirementsTable)
    .where(eq(requirementsTable.id, params.data.id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "requirement not found" });
    return;
  }

  const isAdmin = active?.role === "admin";
  const isOwner = active?.role === "vendor" && active.vendorId === existing.vendorId;
  if (!isAdmin && !isOwner) {
    res.status(403).json({ error: "forbidden" });
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

  // Block apply if the trainer's engaged dates overlap the requirement window.
  const [requirementRow] = await db
    .select()
    .from(requirementsTable)
    .where(eq(requirementsTable.id, params.data.id))
    .limit(1);
  if (requirementRow?.startDate) {
    const [trainerRow] = await db
      .select()
      .from(trainersTable)
      .where(eq(trainersTable.id, active.trainerId))
      .limit(1);
    const engaged = (trainerRow?.engagedDates ?? []) as Array<{
      startDate: string;
      endDate: string;
      note?: string;
    }>;
    if (engaged.length > 0) {
      const reqStart = requirementRow.startDate.slice(0, 10);
      const days = Math.max(0, (requirementRow.durationDays ?? 1) - 1);
      const reqEndDate = new Date(reqStart + "T00:00:00Z");
      reqEndDate.setUTCDate(reqEndDate.getUTCDate() + days);
      const reqEnd = reqEndDate.toISOString().slice(0, 10);
      const conflict = engaged.find((r) => {
        if (!r?.startDate || !r?.endDate) return false;
        const s = r.startDate.slice(0, 10);
        const e = r.endDate.slice(0, 10);
        return s <= reqEnd && reqStart <= e;
      });
      if (conflict) {
        res.status(409).json({
          error: "engaged_dates_conflict",
          message: `You're already engaged from ${conflict.startDate} to ${conflict.endDate}. Update your availability to apply.`,
          conflict,
        });
        return;
      }
    }
  }

  const DEFAULT_MSG = "I am interested in this requirement and believe my skills and experience make me a strong fit. I look forward to discussing further.";
  const finalMessage = body.data.message?.trim() || DEFAULT_MSG;
  const finalRate = body.data.proposedRate ?? undefined;

  const id = newId("app");
  try {
    await db.insert(applicationsTable).values({
      id,
      requirementId: params.data.id,
      trainerId: active.trainerId,
      status: "submitted",
      message: finalMessage,
      proposedRate: finalRate,
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
    const vendorEmailPrefs = resolveVendorEmailPrefs(vendor?.emailPrefs);
    if (vendor?.email && vendorEmailPrefs.newApplication !== false) {
      notifyVendorNewApplication({
        vendorEmail: vendor.email,
        vendorName: vendor.companyName,
        trainerName: active.name ?? "A trainer",
        requirementTitle: r.title,
        proposedRate: finalRate,
        message: finalMessage,
      }).catch(() => {});
    }
  }
  res.status(201).json({
    id,
    requirementId: params.data.id,
    trainerId: active.trainerId,
    status: "submitted",
    message: finalMessage,
    proposedRate: finalRate,
    createdAt: new Date().toISOString(),
  });
});

router.get("/requirements/:id/applications", async (req, res) => {
  const params = ListRequirementApplicationsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid params" });
    return;
  }

  // Authorization: only the owning vendor or an admin may view the applicant
  // list (which now includes engagedDates and applicant rates/messages).
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
  if (active.role !== "admin") {
    const [reqRow] = await db
      .select()
      .from(requirementsTable)
      .where(eq(requirementsTable.id, params.data.id))
      .limit(1);
    if (!reqRow) {
      res.status(404).json({ error: "requirement not found" });
      return;
    }
    const isOwner =
      active.role === "vendor" &&
      !!active.vendorId &&
      active.vendorId === reqRow.vendorId;
    if (!isOwner) {
      res.status(403).json({ error: "not allowed" });
      return;
    }
  }

  // Vendor ownership is already verified in the auth block above;
  // admins bypass ownership — vendorNote is only returned to the owning vendor.
  const isOwningVendor = active.role === "vendor";

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
      withdrawnReason: r.app.withdrawnReason ?? undefined,
      ...(isOwningVendor && r.app.vendorNote != null
        ? { vendorNote: r.app.vendorNote }
        : {}),
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
            developmentExperienceYears:
              r.trainer.developmentExperienceYears ?? 0,
            trainerType: r.trainer.trainerType ?? undefined,
            engagedDates: r.trainer.engagedDates ?? [],
          }
        : null,
    })),
  );
});

// GET /requirements/:id/suggested-trainers — public (vendors/admins use this)
router.get("/requirements/:id/suggested-trainers", async (req, res) => {
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

  const reqSkill = r.skill;
  const reqSubSkills = (r.subSkills as string[]) ?? [];
  const allReqSkills = [reqSkill, ...reqSubSkills];
  const skillJsonb = JSON.stringify(allReqSkills);

  // Find trainers with any skill overlap; rank by match tier then rating
  const rows = await db
    .select({
      id: trainersTable.id,
      name: trainersTable.name,
      mainSkill: trainersTable.mainSkill,
      rating: trainersTable.rating,
      avatarUrl: trainersTable.avatarUrl,
      reviewCount: trainersTable.reviewCount,
    })
    .from(trainersTable)
    .where(
      sql`(
        ${trainersTable.mainSkill} = ANY(ARRAY(SELECT jsonb_array_elements_text(${skillJsonb}::jsonb)))
        OR ${trainersTable.subSkills} ?| ARRAY(SELECT jsonb_array_elements_text(${skillJsonb}::jsonb))
      )`,
    )
    .orderBy(
      sql`
        CASE
          WHEN ${trainersTable.mainSkill} = ${reqSkill} THEN 1
          WHEN ${trainersTable.mainSkill} = ANY(ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(reqSubSkills)}::jsonb))) THEN 2
          ELSE 3
        END ASC
      `,
      desc(trainersTable.rating),
    )
    .limit(5);

  res.json(
    rows.map((t) => ({
      id: t.id,
      name: t.name,
      mainSkill: t.mainSkill,
      rating: Number(t.rating),
      avatarUrl: t.avatarUrl,
      reviewCount: t.reviewCount,
    })),
  );
});

// GET /requirements/:id/ai-matches  — vendor owner only
router.get("/requirements/:id/ai-matches", async (req, res) => {
  const params = GetRequirementParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid params" });
    return;
  }

  const activeId = await getActiveUserId(req);
  const [active] = await db.select().from(usersTable).where(eq(usersTable.id, activeId)).limit(1);
  if (!active || active.role !== "vendor" || !active.vendorId) {
    res.status(403).json({ error: "vendor only" });
    return;
  }

  const [requirement] = await db
    .select()
    .from(requirementsTable)
    .where(eq(requirementsTable.id, params.data.id))
    .limit(1);
  if (!requirement) {
    res.status(404).json({ error: "requirement not found" });
    return;
  }
  if (requirement.vendorId !== active.vendorId) {
    res.status(403).json({ error: "not your requirement" });
    return;
  }

  // Fetch up to 50 trainers from DB for LLM ranking
  const trainers = await db
    .select({
      id: trainersTable.id,
      name: trainersTable.name,
      mainSkill: trainersTable.mainSkill,
      subSkills: trainersTable.subSkills,
      experienceYears: trainersTable.experienceYears,
      rating: trainersTable.rating,
      avatarUrl: trainersTable.avatarUrl,
      location: trainersTable.location,
      verified: trainersTable.verified,
      bio: trainersTable.bio,
    })
    .from(trainersTable)
    .orderBy(desc(trainersTable.rating))
    .limit(50);

  if (trainers.length === 0) {
    res.json([]);
    return;
  }

  const trainerList = trainers
    .map((t, i) => {
      const skills = [t.mainSkill, ...((t.subSkills as string[]) ?? [])].join(", ");
      const bio = t.bio ? ` Bio: ${String(t.bio).slice(0, 100)}` : "";
      return `${i + 1}. ID=${t.id} Name="${t.name}" Skills="${skills}" Exp=${t.experienceYears}yr Rating=${Number(t.rating).toFixed(1)} Location="${t.location ?? ""}".${bio}`;
    })
    .join("\n");

  const subSkillsText = (requirement.subSkills as string[] ?? []).join(", ");
  const prompt = `You are a talent-matching assistant for a B2B training marketplace.

Requirement:
- Title: "${requirement.title}"
- Primary skill needed: "${requirement.skill}"
- Sub-skills: "${subSkillsText}"
- Duration: ${requirement.durationDays} days
- Location: "${requirement.location}"
- Budget: ${requirement.budget > 0 ? `₹${requirement.budget}` : "negotiable"}
${requirement.description ? `- Description: "${String(requirement.description).slice(0, 300)}"` : ""}

Trainer candidates:
${trainerList}

Pick the top 5 trainers best suited for this requirement. Consider skill match, experience, and rating. Return ONLY a valid JSON array (no markdown, no extra text) with exactly this structure:
[{"trainerId":"<id>","reason":"<one sentence explaining why this trainer fits>"}]`;

  let ranked: Array<{ trainerId: string; reason: string }> = [];
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = completion.choices[0]?.message?.content ?? "[]";
    const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      ranked = parsed.filter(
        (x): x is { trainerId: string; reason: string } =>
          typeof x?.trainerId === "string" && typeof x?.reason === "string",
      ).slice(0, 5);
    }
  } catch {
    res.json([]);
    return;
  }

  const trainerMap = new Map(trainers.map((t) => [t.id, t]));
  const result = ranked
    .map(({ trainerId, reason }) => {
      const t = trainerMap.get(trainerId);
      if (!t) return null;
      return {
        trainerId: t.id,
        name: t.name,
        mainSkill: t.mainSkill,
        subSkills: (t.subSkills as string[]) ?? [],
        experienceYears: t.experienceYears,
        rating: Number(t.rating),
        avatarUrl: t.avatarUrl ?? "",
        location: t.location ?? undefined,
        verified: t.verified ?? false,
        reason,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  res.json(result);
});

// POST /requirements/:id/flag  — trainer only
router.post("/requirements/:id/flag", async (req, res) => {
  const params = FlagRequirementParams.safeParse(req.params);
  const body = FlagRequirementBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "invalid request" });
    return;
  }
  const activeId = await getActiveUserId(req);
  const [active] = await db.select().from(usersTable).where(eq(usersTable.id, activeId)).limit(1);
  if (!active || active.role !== "trainer") {
    res.status(403).json({ error: "only trainers can flag requirements" });
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
  const [updated] = await db
    .update(requirementsTable)
    .set({ flagged: true, flagReason: body.data.reason, flaggedBy: active.trainerId ?? activeId, flaggedAt: new Date() })
    .where(eq(requirementsTable.id, params.data.id))
    .returning();
  const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, updated.vendorId)).limit(1);
  const [countRow] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(applicationsTable)
    .where(eq(applicationsTable.requirementId, updated.id));
  res.json(await buildRequirementCard(updated, vendor ?? null, countRow?.count ?? 0));
});

// POST /requirements/:id/bulk-reject  — vendor-owner only
router.post("/requirements/:id/bulk-reject", async (req, res) => {
  const params = GetRequirementParams.safeParse(req.params);
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
  const [reqRow] = await db
    .select()
    .from(requirementsTable)
    .where(eq(requirementsTable.id, params.data.id))
    .limit(1);
  if (!reqRow) {
    res.status(404).json({ error: "requirement not found" });
    return;
  }
  if (reqRow.vendorId !== active.vendorId) {
    res.status(403).json({ error: "forbidden" });
    return;
  }

  // Enforce server-side: at least one hired application must exist
  const [hiredCheck] = await db
    .select({ id: applicationsTable.id })
    .from(applicationsTable)
    .where(
      and(
        eq(applicationsTable.requirementId, params.data.id),
        eq(applicationsTable.status, "hired"),
      ),
    )
    .limit(1);
  if (!hiredCheck) {
    res.status(409).json({ error: "no_hired_trainer", message: "At least one trainer must be hired before bulk-rejecting." });
    return;
  }

  // Find all submitted/shortlisted applications
  const toReject = await db
    .select({ app: applicationsTable, trainer: trainersTable })
    .from(applicationsTable)
    .leftJoin(trainersTable, eq(applicationsTable.trainerId, trainersTable.id))
    .where(
      and(
        eq(applicationsTable.requirementId, params.data.id),
        sql`${applicationsTable.status} IN ('submitted', 'shortlisted')`,
      ),
    );

  if (toReject.length === 0) {
    res.json({ rejectedCount: 0 });
    return;
  }

  const appIds = toReject.map((r) => r.app.id);
  await db
    .update(applicationsTable)
    .set({ status: "rejected" })
    .where(inArray(applicationsTable.id, appIds));

  // Fire status-update emails for each rejected trainer
  const { notifyTrainerStatusUpdate } = await import("../lib/mailer");
  const [vendor] = await db
    .select()
    .from(vendorsTable)
    .where(eq(vendorsTable.id, active.vendorId))
    .limit(1);

  await Promise.allSettled(
    toReject.map(async (r) => {
      const [[trainerUser], [trainerPrefsRow]] = await Promise.all([
        db.select().from(usersTable).where(eq(usersTable.trainerId, r.app.trainerId)).limit(1),
        db.select({ emailPrefs: trainersTable.emailPrefs }).from(trainersTable).where(eq(trainersTable.id, r.app.trainerId)).limit(1),
      ]);
      const emailPrefs = trainerPrefsRow?.emailPrefs ?? { endorsements: true, applicationStatus: true, newRequirementMatch: true, messages: true };
      if (trainerUser?.email && r.trainer && emailPrefs.applicationStatus !== false) {
        return notifyTrainerStatusUpdate({
          trainerEmail: trainerUser.email,
          trainerName: r.trainer.name,
          requirementTitle: reqRow.title,
          vendorName: vendor?.companyName ?? "the vendor",
          status: "rejected",
          trainerId: r.app.trainerId,
        });
      }
    }),
  );

  await db.insert(activityTable).values({
    id: newId("act"),
    type: "application",
    title: `${toReject.length} application${toReject.length === 1 ? "" : "s"} rejected in bulk`,
    subtitle: reqRow.title,
    avatarUrl: active.avatarUrl,
  });

  res.json({ rejectedCount: toReject.length });
});

// GET /admin/requirements/hire-through-us  — admin only
router.get("/admin/requirements/hire-through-us", async (req, res) => {
  const activeId = await getActiveUserId(req);
  const [active] = await db.select().from(usersTable).where(eq(usersTable.id, activeId)).limit(1);
  if (!active || active.role !== "admin") {
    res.status(403).json({ error: "admin only" });
    return;
  }
  const rows = await db
    .select()
    .from(requirementsTable)
    .where(eq(requirementsTable.hireThroughUs, true))
    .orderBy(desc(requirementsTable.createdAt));
  res.json(await fetchListWithCounts(rows));
});

// POST /requirements/:id/unflag  — admin only
router.post("/requirements/:id/unflag", async (req, res) => {
  const params = UnflagRequirementParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid params" });
    return;
  }
  const activeId = await getActiveUserId(req);
  const [active] = await db.select().from(usersTable).where(eq(usersTable.id, activeId)).limit(1);
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
  const [updated] = await db
    .update(requirementsTable)
    .set({ flagged: false, flagReason: null, flaggedBy: null, flaggedAt: null })
    .where(eq(requirementsTable.id, params.data.id))
    .returning();
  const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, updated.vendorId)).limit(1);
  const [countRow] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(applicationsTable)
    .where(eq(applicationsTable.requirementId, updated.id));
  res.json(await buildRequirementCard(updated, vendor ?? null, countRow?.count ?? 0));
});

async function ensureAdmin(req: Parameters<typeof getActiveUserId>[0]): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const activeId = await getActiveUserId(req);
  if (!activeId) return { ok: false, status: 401, error: "not authenticated" };
  const [active] = await db.select().from(usersTable).where(eq(usersTable.id, activeId)).limit(1);
  if (!active || active.role !== "admin") return { ok: false, status: 403, error: "admin only" };
  return { ok: true };
}

async function setHidden(id: string, hidden: boolean) {
  const [existing] = await db.select().from(requirementsTable).where(eq(requirementsTable.id, id)).limit(1);
  if (!existing) return null;
  const [updated] = await db
    .update(requirementsTable)
    .set({ hidden })
    .where(eq(requirementsTable.id, id))
    .returning();
  const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, updated.vendorId)).limit(1);
  const [countRow] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(applicationsTable)
    .where(eq(applicationsTable.requirementId, updated.id));
  return buildRequirementCard(updated, vendor ?? null, countRow?.count ?? 0);
}

// POST /requirements/:id/hide  — admin only
router.post("/requirements/:id/hide", async (req, res) => {
  const params = HideRequirementParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "invalid params" }); return; }
  const auth = await ensureAdmin(req);
  if (!auth.ok) { res.status(auth.status).json({ error: auth.error }); return; }
  const card = await setHidden(params.data.id, true);
  if (!card) { res.status(404).json({ error: "requirement not found" }); return; }
  res.json(card);
});

// POST /requirements/:id/unhide  — admin only
router.post("/requirements/:id/unhide", async (req, res) => {
  const params = HideRequirementParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "invalid params" }); return; }
  const auth = await ensureAdmin(req);
  if (!auth.ok) { res.status(auth.status).json({ error: auth.error }); return; }
  const card = await setHidden(params.data.id, false);
  if (!card) { res.status(404).json({ error: "requirement not found" }); return; }
  res.json(card);
});

// POST /requirements/:id/warn  — admin only; emails the vendor a moderation message
router.post("/requirements/:id/warn", async (req, res) => {
  const params = WarnRequirementVendorParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "invalid params" }); return; }
  const body = WarnRequirementVendorBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "invalid body", details: body.error.issues }); return; }
  const auth = await ensureAdmin(req);
  if (!auth.ok) { res.status(auth.status).json({ error: auth.error }); return; }
  const [existing] = await db.select().from(requirementsTable).where(eq(requirementsTable.id, params.data.id)).limit(1);
  if (!existing) { res.status(404).json({ error: "requirement not found" }); return; }
  const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, existing.vendorId)).limit(1);
  if (!vendor || !vendor.email) { res.status(404).json({ error: "vendor email not found" }); return; }
  await notifyVendorWarning({
    to: vendor.email,
    vendorName: vendor.contactName ?? vendor.companyName ?? "there",
    requirementTitle: existing.title,
    requirementId: existing.id,
    message: body.data.message,
  });
  req.log.info({ requirementId: existing.id, vendorEmail: vendor.email }, "admin warned vendor");
  res.json({ ok: true });
});

export default router;
