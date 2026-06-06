import { randomUUID } from "crypto";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "./index";
import { notificationsTable, usersTable, type NewNotification } from "./schema";

export type NotificationType =
  | "trainer_shortlisted"
  | "trainer_hired"
  | "requirement_approved"
  | "requirement_rejected"
  | "agreement_signed"
  | "payment_released"
  | "profile_verification_update"
  | "new_application_received";

export type CreateNotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  href?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function createNotification(input: CreateNotificationInput) {
  const [notification] = await db
    .insert(notificationsTable)
    .values({
      id: randomUUID(),
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      href: input.href ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      metadata: input.metadata ?? {},
    } satisfies NewNotification)
    .returning();

  return notification;
}

export async function createNotifications(inputs: CreateNotificationInput[]) {
  if (inputs.length === 0) return [];

  return db
    .insert(notificationsTable)
    .values(
      inputs.map((input) => ({
        id: randomUUID(),
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        href: input.href ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        metadata: input.metadata ?? {},
      } satisfies NewNotification)),
    )
    .returning();
}

export async function listNotificationsForUser(userId: string, limit = 50) {
  return db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, userId))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(limit);
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const [notification] = await db
    .update(notificationsTable)
    .set({ readAt: new Date() })
    .where(and(eq(notificationsTable.id, notificationId), eq(notificationsTable.userId, userId)))
    .returning();

  return notification;
}

export async function markAllNotificationsRead(userId: string) {
  return db
    .update(notificationsTable)
    .set({ readAt: new Date() })
    .where(and(eq(notificationsTable.userId, userId), isNull(notificationsTable.readAt)))
    .returning();
}

export async function findUsersForTrainerIds(trainerIds: string[]) {
  if (trainerIds.length === 0) return [];
  return db.select().from(usersTable).where(inArray(usersTable.trainerId, trainerIds));
}

export async function findUsersForVendorIds(vendorIds: string[]) {
  if (vendorIds.length === 0) return [];
  return db.select().from(usersTable).where(inArray(usersTable.vendorId, vendorIds));
}
