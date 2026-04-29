import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { hireInquiriesTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { newId } from "../lib/ids";
import { getActiveUserId } from "../lib/session";
import { notifyAdminNewInquiry } from "../lib/mailer";

const router: IRouter = Router();

router.post("/hire-inquiries", async (req, res) => {
  const { companyName, contactName, email, phone, trainingNeed, budget, timeline, headcount, location } = req.body;

  if (!companyName || !contactName || !email || !trainingNeed) {
    res.status(400).json({ error: "companyName, contactName, email and trainingNeed are required" });
    return;
  }

  const inquiry = await db
    .insert(hireInquiriesTable)
    .values({
      id: newId(),
      companyName,
      contactName,
      email,
      phone: phone || null,
      trainingNeed,
      budget: budget || null,
      timeline: timeline || null,
      headcount: headcount || null,
      location: location || null,
    })
    .returning();

  notifyAdminNewInquiry({
    companyName,
    contactName,
    email,
    phone,
    trainingNeed,
    budget,
    timeline,
    headcount,
    location,
  }).catch(() => {});

  res.status(201).json(inquiry[0]);
});

router.get("/hire-inquiries", async (req, res) => {
  const active = await getActiveUserId(req);
  if (!active || active.role !== "admin") {
    res.status(403).json({ error: "admin only" });
    return;
  }

  const inquiries = await db
    .select()
    .from(hireInquiriesTable)
    .orderBy(desc(hireInquiriesTable.createdAt));

  res.json(inquiries);
});

router.patch("/hire-inquiries/:id/status", async (req, res) => {
  const active = await getActiveUserId(req);
  if (!active || active.role !== "admin") {
    res.status(403).json({ error: "admin only" });
    return;
  }

  const { status } = req.body;
  if (!["new", "contacted", "in_progress", "closed"].includes(status)) {
    res.status(400).json({ error: "invalid status" });
    return;
  }

  const updated = await db
    .update(hireInquiriesTable)
    .set({ status })
    .where(eq(hireInquiriesTable.id, req.params.id))
    .returning();

  res.json(updated[0]);
});

export default router;
