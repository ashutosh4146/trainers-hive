import { Router, type IRouter } from "express";
import { db, verificationRequestsTable, trainersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getActiveUserId } from "../lib/session";
import { newId } from "../lib/ids";
import { usersTable } from "@workspace/db";

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

  if (existing.length > 0 && existing[0]!.status === "pending") {
    res.status(409).json({ error: "A verification request is already pending" });
    return;
  }

  const id = newId("vreq");
  const message = typeof req.body?.message === "string" ? req.body.message : null;

  const [row] = await db
    .insert(verificationRequestsTable)
    .values({ id, trainerId, status: "pending", message })
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

  if (!status || !["approved", "rejected"].includes(status)) {
    res.status(400).json({ error: "status must be 'approved' or 'rejected'" });
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

  res.json(updated);
});

export default router;
