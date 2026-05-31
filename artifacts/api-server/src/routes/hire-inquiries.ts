import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { hireInquiriesTable, hireInquiryMessagesTable } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";
import { newId } from "../lib/ids";
import { getActiveUserId } from "../lib/session";
import { notifyAdminNewInquiry } from "../lib/mailer";

const router: IRouter = Router();

const ALLOWED_STATUSES = ["new", "contacted", "in_progress", "resolved", "closed"];

async function getCurrentUser(req: Parameters<typeof getActiveUserId>[0]) {
  const id = await getActiveUserId(req);
  const [user] = await db
    .select({ id: usersTable.id, role: usersTable.role, name: usersTable.name, email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, id))
    .limit(1);
  return user ?? null;
}

router.post("/hire-inquiries", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }

  const { companyName, contactName, email, phone, trainingNeed, budget, timeline, headcount, location } = req.body;

  if (!companyName || !contactName || !email || !trainingNeed) {
    res.status(400).json({ error: "companyName, contactName, email and trainingNeed are required" });
    return;
  }

  const inquiry = await db
    .insert(hireInquiriesTable)
    .values({
      id: newId("inq"),
      userId: user.id,
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
  const user = await getCurrentUser(req);
  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "admin only" });
    return;
  }

  const inquiries = await db
    .select()
    .from(hireInquiriesTable)
    .orderBy(hireInquiriesTable.createdAt);

  res.json(inquiries.reverse());
});

router.get("/hire-inquiries/mine", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }

  const inquiries = await db
    .select()
    .from(hireInquiriesTable)
    .where(eq(hireInquiriesTable.userId, user.id))
    .orderBy(hireInquiriesTable.createdAt);

  res.json(inquiries.reverse());
});

router.get("/hire-inquiries/:id", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }

  const [inquiry] = await db
    .select()
    .from(hireInquiriesTable)
    .where(eq(hireInquiriesTable.id, req.params.id))
    .limit(1);

  if (!inquiry) {
    res.status(404).json({ error: "not found" });
    return;
  }

  if (user.role !== "admin" && inquiry.userId !== user.id) {
    res.status(403).json({ error: "forbidden" });
    return;
  }

  res.json(inquiry);
});

router.patch("/hire-inquiries/:id/status", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "admin only" });
    return;
  }

  const { status } = req.body;
  if (!ALLOWED_STATUSES.includes(status)) {
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

router.get("/hire-inquiries/:id/messages", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }

  const [inquiry] = await db
    .select({ id: hireInquiriesTable.id, userId: hireInquiriesTable.userId })
    .from(hireInquiriesTable)
    .where(eq(hireInquiriesTable.id, req.params.id))
    .limit(1);

  if (!inquiry) {
    res.status(404).json({ error: "not found" });
    return;
  }

  if (user.role !== "admin" && inquiry.userId !== user.id) {
    res.status(403).json({ error: "forbidden" });
    return;
  }

  const messages = await db
    .select()
    .from(hireInquiryMessagesTable)
    .where(eq(hireInquiryMessagesTable.inquiryId, req.params.id))
    .orderBy(asc(hireInquiryMessagesTable.createdAt), asc(hireInquiryMessagesTable.id));

  res.json(messages);
});

router.post("/hire-inquiries/:id/messages", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }

  const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
  if (!body) {
    res.status(400).json({ error: "body is required" });
    return;
  }

  const [inquiry] = await db
    .select({ id: hireInquiriesTable.id, userId: hireInquiriesTable.userId })
    .from(hireInquiriesTable)
    .where(eq(hireInquiriesTable.id, req.params.id))
    .limit(1);

  if (!inquiry) {
    res.status(404).json({ error: "not found" });
    return;
  }

  if (user.role !== "admin" && inquiry.userId !== user.id) {
    res.status(403).json({ error: "forbidden" });
    return;
  }

  const [msg] = await db
    .insert(hireInquiryMessagesTable)
    .values({
      id: newId("him"),
      inquiryId: req.params.id,
      senderUserId: user.id,
      body,
    })
    .returning();

  res.status(201).json(msg);
});

export default router;
