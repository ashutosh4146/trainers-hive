import { Router, type IRouter } from "express";
import { db, usersTable, trainersTable, vendorsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { SwitchUserBody } from "@workspace/api-zod";
import { getActiveUserId, setActiveUserId } from "../lib/session";
import { newId } from "../lib/ids";

const router: IRouter = Router();

router.get("/session/me", async (req, res) => {
  const id = await getActiveUserId(req);
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
  const { role, name, email, orgName } = parsed.data;

  if (email) {
    const existing = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    if (existing.length > 0) {
      const u = existing[0]!;
      if (u.deactivatedAt) {
        res.status(403).json({ error: "account_deactivated", message: "This account has been deactivated." });
        return;
      }
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
      return;
    }

    const displayName = name || email.split("@")[0]!;
    let trainerId: string | undefined;
    let vendorId: string | undefined;

    if (role === "trainer") {
      const tid = newId("trainer");
      await db.insert(trainersTable).values({
        id: tid,
        name: displayName,
        headline: "",
        mainSkill: "",
        subSkills: [],
        experienceYears: 0,
        location: "",
        hourlyRate: 0,
        bio: "",
        avatarUrl: "",
        verified: false,
        certifications: [],
        languages: [],
        completedTrainings: 0,
      });
      trainerId = tid;
    } else if (role === "vendor") {
      const vid = newId("vendor");
      await db.insert(vendorsTable).values({
        id: vid,
        companyName: orgName || displayName,
        industry: "",
        location: "",
        contactName: displayName,
        contactDesignation: "",
        email: email,
        logoUrl: "",
        verified: false,
      });
      vendorId = vid;
    }

    const uid = newId("user");
    const [newUser] = await db
      .insert(usersTable)
      .values({
        id: uid,
        name: displayName,
        email: email,
        role,
        avatarUrl: null,
        trainerId: trainerId ?? null,
        vendorId: vendorId ?? null,
      })
      .returning();

    await setActiveUserId(newUser!.id);
    res.json({
      id: newUser!.id,
      role: newUser!.role,
      name: newUser!.name,
      email: newUser!.email,
      avatarUrl: newUser!.avatarUrl ?? undefined,
      vendorId: newUser!.vendorId ?? undefined,
      trainerId: newUser!.trainerId ?? undefined,
    });
    return;
  }

  const rows = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.role, role))
    .limit(1);
  if (rows.length === 0) {
    res.status(404).json({ error: "no demo user for role" });
    return;
  }
  const u = rows[0]!;
  if (u.deactivatedAt) {
    res.status(403).json({ error: "account_deactivated", message: "This account has been deactivated." });
    return;
  }
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
