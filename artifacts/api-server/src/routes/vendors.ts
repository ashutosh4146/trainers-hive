import { Router, type IRouter } from "express";
import { db, vendorsTable, usersTable, requirementsTable, applicationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { GetVendorParams, UpdateVendorParams, UpdateVendorBody } from "@workspace/api-zod";
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

export default router;
