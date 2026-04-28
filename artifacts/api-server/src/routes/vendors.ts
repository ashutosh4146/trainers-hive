import { Router, type IRouter } from "express";
import { db, vendorsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { GetVendorParams, UpdateVendorParams, UpdateVendorBody } from "@workspace/api-zod";

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

export default router;
