import { Router, type IRouter } from "express";
import { db, trainersTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { GetTrainerParams } from "@workspace/api-zod";
import { getActiveUserId } from "../lib/session";

const router: IRouter = Router();

const DEFAULT_TRAINER_EMAIL_PREFS = {
  endorsements: true,
  applicationStatus: true,
  newRequirementMatch: true,
  messages: true,
};

const TrainerEmailPrefsSchema = z.object({
  endorsements: z.boolean().optional(),
  applicationStatus: z.boolean().optional(),
  newRequirementMatch: z.boolean().optional(),
  messages: z.boolean().optional(),
});

function resolveTrainerEmailPrefs(raw: unknown) {
  return {
    ...DEFAULT_TRAINER_EMAIL_PREFS,
    ...(raw && typeof raw === "object" ? raw as Partial<typeof DEFAULT_TRAINER_EMAIL_PREFS> : {}),
  };
}

async function isOwningTrainer(req: import("express").Request, res: import("express").Response, trainerId: string) {
  const activeId = await getActiveUserId(req);
  const [active] = await db.select().from(usersTable).where(eq(usersTable.id, activeId)).limit(1);
  if (!active || active.role !== "trainer" || active.trainerId !== trainerId) {
    res.status(403).json({ error: "forbidden" });
    return false;
  }
  return true;
}

router.get("/trainers/:id/email-prefs", async (req, res) => {
  const params = GetTrainerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid params" });
    return;
  }

  if (!(await isOwningTrainer(req, res, params.data.id))) return;

  const [row] = await db
    .select({ emailPrefs: trainersTable.emailPrefs })
    .from(trainersTable)
    .where(eq(trainersTable.id, params.data.id))
    .limit(1);

  if (!row) {
    res.status(404).json({ error: "trainer not found" });
    return;
  }

  res.json(resolveTrainerEmailPrefs(row.emailPrefs));
});

router.patch("/trainers/:id/email-prefs", async (req, res) => {
  const params = GetTrainerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid params" });
    return;
  }

  const body = TrainerEmailPrefsSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "invalid body", details: body.error.issues });
    return;
  }

  if (!(await isOwningTrainer(req, res, params.data.id))) return;

  const [existing] = await db
    .select({ emailPrefs: trainersTable.emailPrefs })
    .from(trainersTable)
    .where(eq(trainersTable.id, params.data.id))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "trainer not found" });
    return;
  }

  const merged = { ...resolveTrainerEmailPrefs(existing.emailPrefs), ...body.data };
  await db.update(trainersTable).set({ emailPrefs: merged }).where(eq(trainersTable.id, params.data.id));

  res.json(merged);
});

export default router;
