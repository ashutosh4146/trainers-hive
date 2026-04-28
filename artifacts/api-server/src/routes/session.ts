import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { SwitchUserBody } from "@workspace/api-zod";
import { getActiveUserId, setActiveUserId } from "../lib/session";

const router: IRouter = Router();

router.get("/session/me", async (req, res) => {
  const id = await getActiveUserId();
  const rows = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (rows.length === 0) {
    res.status(404).json({ error: "active user not found" });
    return;
  }
  const u = rows[0]!;
  res.json({
    id: u.id,
    role: u.role,
    name: u.name,
    email: u.email,
    avatarUrl: u.avatarUrl ?? undefined,
    vendorId: u.vendorId ?? undefined,
    trainerId: u.trainerId ?? undefined,
  });
});

router.post("/session/switch", async (req, res) => {
  const parsed = SwitchUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid body", details: parsed.error.issues });
    return;
  }
  const role = parsed.data.role;
  const rows = await db.select().from(usersTable).where(eq(usersTable.role, role)).limit(1);
  if (rows.length === 0) {
    res.status(404).json({ error: "no demo user for role" });
    return;
  }
  const u = rows[0]!;
  await setActiveUserId(u.id);
  res.json({
    id: u.id,
    role: u.role,
    name: u.name,
    email: u.email,
    avatarUrl: u.avatarUrl ?? undefined,
    vendorId: u.vendorId ?? undefined,
    trainerId: u.trainerId ?? undefined,
  });
});

export default router;
