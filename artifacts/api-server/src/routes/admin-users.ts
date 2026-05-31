import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, and, isNull, isNotNull, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { getActiveUserId } from "../lib/session";

const router: IRouter = Router();

function serializeAdminUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    avatarUrl: u.avatarUrl ?? undefined,
    vendorId: u.vendorId ?? undefined,
    trainerId: u.trainerId ?? undefined,
    createdAt: u.createdAt.toISOString(),
    deactivatedAt: u.deactivatedAt?.toISOString() ?? undefined,
  };
}

async function requireAdmin(req: Parameters<typeof getActiveUserId>[0]): Promise<typeof usersTable.$inferSelect | null> {
  const activeId = await getActiveUserId(req);
  const [active] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, activeId))
    .limit(1);
  if (!active || active.role !== "admin") return null;
  return active;
}

const ListQuerySchema = z.object({
  q: z.string().optional(),
  role: z.enum(["trainer", "vendor", "admin"]).optional(),
  status: z.enum(["active", "deactivated"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

router.get("/admin/users", async (req, res) => {
  const admin = await requireAdmin(req);
  if (!admin) {
    res.status(403).json({ error: "admin only" });
    return;
  }

  const parsed = ListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid query", details: parsed.error.issues });
    return;
  }
  const { q, role, status, page, pageSize } = parsed.data;

  const conds: SQL[] = [];
  if (q) {
    const like = `%${q}%`;
    conds.push(sql`(${usersTable.name} ILIKE ${like} OR ${usersTable.email} ILIKE ${like})`);
  }
  if (role) conds.push(eq(usersTable.role, role));
  if (status === "active") conds.push(isNull(usersTable.deactivatedAt));
  if (status === "deactivated") conds.push(isNotNull(usersTable.deactivatedAt));

  const where = conds.length > 0 ? and(...conds) : undefined;

  const [{ total }] = await db
    .select({ total: sql<number>`COUNT(*)::int` })
    .from(usersTable)
    .where(where ?? sql`TRUE`);

  const offset = (page - 1) * pageSize;
  const rows = await db
    .select()
    .from(usersTable)
    .where(where ?? sql`TRUE`)
    .orderBy(sql`${usersTable.createdAt} DESC`)
    .limit(pageSize)
    .offset(offset);

  res.json({
    users: rows.map(serializeAdminUser),
    total,
    page,
    pageSize,
  });
});

router.patch("/admin/users/:id/deactivate", async (req, res) => {
  const admin = await requireAdmin(req);
  if (!admin) {
    res.status(403).json({ error: "admin only" });
    return;
  }
  const { id } = req.params;
  if (!id) {
    res.status(400).json({ error: "missing id" });
    return;
  }
  if (id === admin.id) {
    res.status(400).json({ error: "cannot deactivate yourself" });
    return;
  }

  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "user not found" });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ deactivatedAt: new Date() })
    .where(eq(usersTable.id, id))
    .returning();

  res.json(serializeAdminUser(updated!));
});

router.patch("/admin/users/:id/reactivate", async (req, res) => {
  const admin = await requireAdmin(req);
  if (!admin) {
    res.status(403).json({ error: "admin only" });
    return;
  }
  const { id } = req.params;
  if (!id) {
    res.status(400).json({ error: "missing id" });
    return;
  }

  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "user not found" });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ deactivatedAt: null })
    .where(eq(usersTable.id, id))
    .returning();

  res.json(serializeAdminUser(updated!));
});

const ChangeRoleSchema = z.object({
  role: z.enum(["trainer", "vendor"]),
});

router.patch("/admin/users/:id/role", async (req, res) => {
  const admin = await requireAdmin(req);
  if (!admin) {
    res.status(403).json({ error: "admin only" });
    return;
  }
  const { id } = req.params;
  if (!id) {
    res.status(400).json({ error: "missing id" });
    return;
  }

  const body = ChangeRoleSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "invalid body", details: body.error.issues });
    return;
  }

  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "user not found" });
    return;
  }
  if (existing.role === "admin") {
    res.status(400).json({ error: "cannot change role of an admin account" });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ role: body.data.role })
    .where(eq(usersTable.id, id))
    .returning();

  res.json(serializeAdminUser(updated!));
});

export default router;
