import { Router, type IRouter, type Response } from "express";
import {
  db,
  usersTable,
  requirementsTable,
  applicationsTable,
  trainersTable,
  vendorsTable,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { getActiveUserId } from "../lib/session";

const router: IRouter = Router();

async function requireAdmin(req: Parameters<typeof getActiveUserId>[0]) {
  const activeId = await getActiveUserId(req);
  if (!activeId) return null;
  const [active] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, activeId))
    .limit(1);
  if (!active || active.role !== "admin") return null;
  return active;
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsvRow(values: unknown[]): string {
  return values.map(csvEscape).join(",") + "\r\n";
}

function timestampedFilename(stem: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `${stem}_${today}.csv`;
}

function setDownloadHeaders(res: Response, filename: string) {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "no-store");
}

router.get("/admin/export/requirements", async (req, res) => {
  const admin = await requireAdmin(req);
  if (!admin) {
    res.status(403).json({ error: "admin only" });
    return;
  }

  const rows = await db
    .select({
      id: requirementsTable.id,
      title: requirementsTable.title,
      skill: requirementsTable.skill,
      vendorName: vendorsTable.companyName,
      status: requirementsTable.status,
      location: requirementsTable.location,
      deadline: requirementsTable.deadline,
      createdAt: requirementsTable.createdAt,
      applicationCount: sql<number>`COALESCE((SELECT COUNT(*)::int FROM ${applicationsTable} a WHERE a.requirement_id = ${requirementsTable.id}), 0)`,
    })
    .from(requirementsTable)
    .leftJoin(vendorsTable, eq(vendorsTable.id, requirementsTable.vendorId))
    .orderBy(requirementsTable.createdAt);

  const filename = timestampedFilename("requirements");
  setDownloadHeaders(res, filename);

  res.write(
    toCsvRow([
      "id",
      "title",
      "skill",
      "vendor_name",
      "status",
      "location",
      "deadline",
      "application_count",
      "created_at",
    ]),
  );

  for (const r of rows) {
    res.write(
      toCsvRow([
        r.id,
        r.title,
        r.skill,
        r.vendorName ?? "",
        r.status,
        r.location,
        r.deadline ? r.deadline.toISOString() : "",
        r.applicationCount ?? 0,
        r.createdAt ? r.createdAt.toISOString() : "",
      ]),
    );
  }

  res.end();
  req.log?.info(
    { adminId: admin.id, rowCount: rows.length, filename },
    "admin exported requirements CSV",
  );
});

router.get("/admin/export/applications", async (req, res) => {
  const admin = await requireAdmin(req);
  if (!admin) {
    res.status(403).json({ error: "admin only" });
    return;
  }

  const rows = await db
    .select({
      id: applicationsTable.id,
      requirementTitle: requirementsTable.title,
      trainerName: trainersTable.name,
      trainerEmail: sql<string | null>`(SELECT u.email FROM ${usersTable} u WHERE u.trainer_id = ${applicationsTable.trainerId} ORDER BY u.created_at ASC LIMIT 1)`,
      status: applicationsTable.status,
      proposedRate: applicationsTable.proposedRate,
      createdAt: applicationsTable.createdAt,
    })
    .from(applicationsTable)
    .leftJoin(
      requirementsTable,
      eq(requirementsTable.id, applicationsTable.requirementId),
    )
    .leftJoin(trainersTable, eq(trainersTable.id, applicationsTable.trainerId))
    .orderBy(applicationsTable.createdAt);

  const filename = timestampedFilename("applications");
  setDownloadHeaders(res, filename);

  res.write(
    toCsvRow([
      "id",
      "requirement_title",
      "trainer_name",
      "trainer_email",
      "status",
      "proposed_rate",
      "applied_at",
    ]),
  );

  for (const r of rows) {
    res.write(
      toCsvRow([
        r.id,
        r.requirementTitle ?? "",
        r.trainerName ?? "",
        r.trainerEmail ?? "",
        r.status,
        r.proposedRate ?? 0,
        r.createdAt ? r.createdAt.toISOString() : "",
      ]),
    );
  }

  res.end();
  req.log?.info(
    { adminId: admin.id, rowCount: rows.length, filename },
    "admin exported applications CSV",
  );
});

export default router;
