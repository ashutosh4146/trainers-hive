import { Router, type IRouter } from "express";
import { z } from "zod";
import {
  listNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead,
} from "@workspace/db/notifications";
import { getActiveUserId } from "../lib/session";

const router: IRouter = Router();

function serializeNotification(notification: any) {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body ?? undefined,
    href: notification.href ?? undefined,
    entityType: notification.entityType ?? undefined,
    entityId: notification.entityId ?? undefined,
    metadata: notification.metadata ?? {},
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  };
}

router.get("/notifications", async (req, res) => {
  const activeId = await getActiveUserId(req);
  const limitRaw = typeof req.query.limit === "string" ? Number(req.query.limit) : 50;
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 100) : 50;
  const notifications = await listNotificationsForUser(activeId, limit);
  res.json(notifications.map(serializeNotification));
});

router.patch("/notifications/:id/read", async (req, res) => {
  const params = z.object({ id: z.string().min(1) }).safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid params" });
    return;
  }
  const activeId = await getActiveUserId(req);
  const notification = await markNotificationRead(activeId, params.data.id);
  if (!notification) {
    res.status(404).json({ error: "notification not found" });
    return;
  }
  res.json(serializeNotification(notification));
});

router.post("/notifications/read-all", async (_req, res) => {
  const activeId = await getActiveUserId(_req);
  const notifications = await markAllNotificationsRead(activeId);
  res.json({ updatedCount: notifications.length });
});

export default router;
