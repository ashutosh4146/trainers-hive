import { Router, type IRouter } from "express";
import { db, trainersTable, usersTable, vendorsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getActiveUserId } from "../lib/session";

const router: IRouter = Router();

const LinkSchema = z.object({ label: z.string().trim().min(1), url: z.string().trim().url() });
const WorkSampleSchema = z.object({
  title: z.string().trim().min(1),
  url: z.string().trim().url(),
  fromYear: z.string().optional(),
  fromMonth: z.string().optional(),
  toYear: z.string().optional(),
  toMonth: z.string().optional(),
  current: z.boolean().optional(),
  description: z.string().optional(),
});
const PresentationSchema = z.object({ title: z.string().trim().min(1), url: z.string().trim().url(), description: z.string().optional() });
const PatentSchema = z.object({ title: z.string().trim().min(1), url: z.string().trim().url().optional().or(z.literal("")), year: z.string().optional(), description: z.string().optional() });
const EmploymentSchema = z.object({ company: z.string().trim().min(1), title: z.string().trim().min(1), from: z.string().optional(), to: z.string().optional(), current: z.boolean().optional(), description: z.string().optional() });
const EducationSchema = z.object({ degree: z.string().trim().min(1), institute: z.string().trim().min(1), year: z.string().optional(), description: z.string().optional() });

const TrainerProfileExtrasSchema = z.object({
  mobileNumber: z.string().optional(),
  dateOfBirth: z.string().optional(),
  workPermit: z.string().optional(),
  locality: z.string().optional(),
  fullAddress: z.string().optional(),
  onlineProfiles: z.array(LinkSchema).optional(),
  workSamples: z.array(WorkSampleSchema).optional(),
  presentations: z.array(PresentationSchema).optional(),
  patents: z.array(PatentSchema).optional(),
  employmentDetails: z.array(EmploymentSchema).optional(),
  educationDetails: z.array(EducationSchema).optional(),
});

const VendorProfileExtrasSchema = z.object({
  mobileNumber: z.string().optional(),
  locality: z.string().optional(),
  fullAddress: z.string().optional(),
  onlineProfiles: z.array(LinkSchema).optional(),
});

const TrainerPayloadSchema = z.object({
  avatarUrl: z.string().trim().url().optional().or(z.literal("")),
  profileExtras: TrainerProfileExtrasSchema.default({}),
});

const VendorPayloadSchema = z.object({
  logoUrl: z.string().trim().url().optional().or(z.literal("")),
  profileExtras: VendorProfileExtrasSchema.default({}),
});

async function getActiveUser(req: import("express").Request) {
  const activeId = await getActiveUserId(req);
  const [active] = await db.select().from(usersTable).where(eq(usersTable.id, activeId)).limit(1);
  return active;
}

router.get("/trainers/:id/profile-extras", async (req, res) => {
  const id = req.params.id;
  if (!id) return res.status(400).json({ error: "invalid params" });
  const active = await getActiveUser(req);
  if (!active || (active.role !== "admin" && !(active.role === "trainer" && active.trainerId === id))) {
    return res.status(403).json({ error: "forbidden" });
  }
  const [trainer] = await db.select({ avatarUrl: trainersTable.avatarUrl, profileExtras: trainersTable.profileExtras }).from(trainersTable).where(eq(trainersTable.id, id)).limit(1);
  if (!trainer) return res.status(404).json({ error: "trainer not found" });
  res.json({ avatarUrl: trainer.avatarUrl, profileExtras: trainer.profileExtras ?? {} });
});

router.patch("/trainers/:id/profile-extras", async (req, res) => {
  const id = req.params.id;
  if (!id) return res.status(400).json({ error: "invalid params" });
  const body = TrainerPayloadSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "invalid body", details: body.error.issues });
  const active = await getActiveUser(req);
  if (!active || (active.role !== "admin" && !(active.role === "trainer" && active.trainerId === id))) {
    return res.status(403).json({ error: "forbidden" });
  }
  const patch: Partial<typeof trainersTable.$inferInsert> = { profileExtras: body.data.profileExtras };
  if (body.data.avatarUrl !== undefined && body.data.avatarUrl !== "") patch.avatarUrl = body.data.avatarUrl;
  await db.update(trainersTable).set(patch).where(eq(trainersTable.id, id));
  const [trainer] = await db.select({ avatarUrl: trainersTable.avatarUrl, profileExtras: trainersTable.profileExtras }).from(trainersTable).where(eq(trainersTable.id, id)).limit(1);
  res.json({ avatarUrl: trainer?.avatarUrl, profileExtras: trainer?.profileExtras ?? {} });
});

router.get("/vendors/:id/profile-extras", async (req, res) => {
  const id = req.params.id;
  if (!id) return res.status(400).json({ error: "invalid params" });
  const active = await getActiveUser(req);
  if (!active || (active.role !== "admin" && !(active.role === "vendor" && active.vendorId === id))) {
    return res.status(403).json({ error: "forbidden" });
  }
  const [vendor] = await db.select({ logoUrl: vendorsTable.logoUrl, profileExtras: vendorsTable.profileExtras }).from(vendorsTable).where(eq(vendorsTable.id, id)).limit(1);
  if (!vendor) return res.status(404).json({ error: "vendor not found" });
  res.json({ logoUrl: vendor.logoUrl, profileExtras: vendor.profileExtras ?? {} });
});

router.patch("/vendors/:id/profile-extras", async (req, res) => {
  const id = req.params.id;
  if (!id) return res.status(400).json({ error: "invalid params" });
  const body = VendorPayloadSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "invalid body", details: body.error.issues });
  const active = await getActiveUser(req);
  if (!active || (active.role !== "admin" && !(active.role === "vendor" && active.vendorId === id))) {
    return res.status(403).json({ error: "forbidden" });
  }
  const patch: Partial<typeof vendorsTable.$inferInsert> = { profileExtras: body.data.profileExtras };
  if (body.data.logoUrl !== undefined && body.data.logoUrl !== "") patch.logoUrl = body.data.logoUrl;
  await db.update(vendorsTable).set(patch).where(eq(vendorsTable.id, id));
  const [vendor] = await db.select({ logoUrl: vendorsTable.logoUrl, profileExtras: vendorsTable.profileExtras }).from(vendorsTable).where(eq(vendorsTable.id, id)).limit(1);
  res.json({ logoUrl: vendor?.logoUrl, profileExtras: vendor?.profileExtras ?? {} });
});

export default router;
