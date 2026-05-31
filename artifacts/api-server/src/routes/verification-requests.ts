import { Router, type IRouter } from "express";
import { db, verificationRequestsTable, trainersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getActiveUserId } from "../lib/session";
import { newId } from "../lib/ids";
import { usersTable } from "@workspace/db";
import { notifyTrainerVerificationUpdate } from "../lib/mailer";

const router: IRouter = Router();

router.post("/verification-requests", async (req, res) => {
  const userId = await getActiveUserId(req);
  const userRows = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (userRows.length === 0 || userRows[0]!.role !== "trainer") {
    res.status(403).json({ error: "Only trainers can apply for verification" });
    return;
  }
  const trainerId = userRows[0]!.trainerId;
  if (!trainerId) {
    res.status(400).json({ error: "Trainer profile not found" });
    return;
  }

  const existing = await db
    .select()
    .from(verificationRequestsTable)
    .where(eq(verificationRequestsTable.trainerId, trainerId))
    .limit(1);

  if (existing.length > 0) {
    const prevStatus = existing[0]!.status;
    if (prevStatus === "pending") {
      res.status(409).json({ error: "A verification request is already pending" });
      return;
    }
    if (prevStatus === "approved") {
      res.status(409).json({ error: "Trainer is already verified" });
      return;
    }
    if (prevStatus !== "needs_info" && prevStatus !== "rejected") {
      res.status(409).json({ error: "Cannot resubmit verification request" });
      return;
    }
  }

  const message = typeof req.body?.message === "string" ? req.body.message : null;
  const aadhaarNumber = typeof req.body?.aadhaarNumber === "string" ? req.body.aadhaarNumber.trim() || null : null;
  const panNumber = typeof req.body?.panNumber === "string" ? req.body.panNumber.trim().toUpperCase() || null : null;
  const qualification = typeof req.body?.qualification === "string" ? req.body.qualification.trim() || null : null;
  const dateOfBirth = typeof req.body?.dateOfBirth === "string" ? req.body.dateOfBirth.trim() || null : null;

  // Resubmission: previous request was needs_info or rejected — update it back to pending
  // (clearing the admin note) so admin sees a fresh resubmission with the latest details.
  if (existing.length > 0) {
    const [updated] = await db
      .update(verificationRequestsTable)
      .set({
        status: "pending",
        message,
        aadhaarNumber,
        panNumber,
        qualification,
        dateOfBirth,
        adminNote: null,
        updatedAt: new Date(),
      })
      .where(eq(verificationRequestsTable.id, existing[0]!.id))
      .returning();
    res.status(200).json(updated);
    return;
  }

  const id = newId("vreq");
  const [row] = await db
    .insert(verificationRequestsTable)
    .values({ id, trainerId, status: "pending", message, aadhaarNumber, panNumber, qualification, dateOfBirth })
    .returning();

  res.status(201).json(row);
});

router.get("/verification-requests/my", async (req, res) => {
  const userId = await getActiveUserId(req);
  const userRows = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (userRows.length === 0 || !userRows[0]!.trainerId) {
    res.json(null);
    return;
  }
  const trainerId = userRows[0]!.trainerId!;
  const rows = await db
    .select()
    .from(verificationRequestsTable)
    .where(eq(verificationRequestsTable.trainerId, trainerId))
    .limit(1);

  res.json(rows[0] ?? null);
});

router.get("/verification-requests", async (req, res) => {
  const userId = await getActiveUserId(req);
  const userRows = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (userRows.length === 0 || userRows[0]!.role !== "admin") {
    res.status(403).json({ error: "Admin only" });
    return;
  }

  const requests = await db.select().from(verificationRequestsTable);
  const results = await Promise.all(
    requests.map(async (r) => {
      const trainer = await db
        .select({ id: trainersTable.id, name: trainersTable.name, avatarUrl: trainersTable.avatarUrl, mainSkill: trainersTable.mainSkill })
        .from(trainersTable)
        .where(eq(trainersTable.id, r.trainerId))
        .limit(1);
      return { ...r, trainer: trainer[0] ?? null };
    })
  );

  res.json(results);
});

router.patch("/verification-requests/:id", async (req, res) => {
  const userId = await getActiveUserId(req);
  const userRows = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (userRows.length === 0 || userRows[0]!.role !== "admin") {
    res.status(403).json({ error: "Admin only" });
    return;
  }

  const { id } = req.params as { id: string };
  const { status, adminNote } = req.body as { status?: string; adminNote?: string };

  if (!status || !["approved", "rejected", "needs_info"].includes(status)) {
    res.status(400).json({ error: "status must be 'approved', 'rejected', or 'needs_info'" });
    return;
  }

  const reqRows = await db
    .select()
    .from(verificationRequestsTable)
    .where(eq(verificationRequestsTable.id, id))
    .limit(1);
  if (reqRows.length === 0) {
    res.status(404).json({ error: "Request not found" });
    return;
  }

  const [updated] = await db
    .update(verificationRequestsTable)
    .set({ status, adminNote: adminNote ?? null, updatedAt: new Date() })
    .where(eq(verificationRequestsTable.id, id))
    .returning();

  if (status === "approved") {
    await db
      .update(trainersTable)
      .set({ verified: true })
      .where(eq(trainersTable.id, reqRows[0]!.trainerId));
  }

  // Notify trainer by email (best-effort)
  try {
    const trainerRow = await db
      .select({ name: trainersTable.name })
      .from(trainersTable)
      .where(eq(trainersTable.id, reqRows[0]!.trainerId))
      .limit(1);
    const userRow = await db
      .select({ email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.trainerId, reqRows[0]!.trainerId))
      .limit(1);
    if (userRow.length > 0 && userRow[0]!.email) {
      await notifyTrainerVerificationUpdate({
        to: userRow[0]!.email,
        trainerName: trainerRow[0]?.name ?? "there",
        status: status as "approved" | "rejected" | "needs_info",
        adminNote: adminNote ?? null,
      });
    }
  } catch (err) {
    req.log.warn({ err }, "Failed to send verification update email");
  }

  res.json(updated);
});

export default router;
