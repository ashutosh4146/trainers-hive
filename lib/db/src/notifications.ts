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

export async function notifyVendorNewApplication(input: {
  vendorId: string;
  applicationId: string;
  requirementId: string;
  requirementTitle: string;
  trainerName: string;
}) {
  const users = await findUsersForVendorIds([input.vendorId]);
  return createNotifications(users.map((user) => ({
    userId: user.id,
    type: "new_application_received",
    title: "New application received",
    body: `${input.trainerName} applied for ${input.requirementTitle}.`,
    href: `/requirements/${input.requirementId}`,
    entityType: "application",
    entityId: input.applicationId,
    metadata: input,
  })));
}

export async function notifyTrainerApplicationStatus(input: {
  trainerId: string;
  applicationId: string;
  requirementId: string;
  requirementTitle: string;
  vendorName: string;
  status: "shortlisted" | "hired" | "rejected" | "completed";
}) {
  const users = await findUsersForTrainerIds([input.trainerId]);
  const type = input.status === "shortlisted"
    ? "trainer_shortlisted"
    : input.status === "hired"
      ? "trainer_hired"
      : "new_application_received";
  const title = input.status === "shortlisted"
    ? "You were shortlisted"
    : input.status === "hired"
      ? "You were hired"
      : input.status === "completed"
        ? "Training completed"
        : "Application update";

  return createNotifications(users.map((user) => ({
    userId: user.id,
    type,
    title,
    body: `${input.vendorName} updated your application for ${input.requirementTitle} to ${input.status}.`,
    href: input.status === "shortlisted" || input.status === "hired" ? "/messages" : `/requirements/${input.requirementId}`,
    entityType: "application",
    entityId: input.applicationId,
    metadata: input,
  })));
}

export async function notifyRequirementModeration(input: {
  vendorId: string;
  requirementId: string;
  requirementTitle: string;
  approved: boolean;
  reason?: string | null;
}) {
  const users = await findUsersForVendorIds([input.vendorId]);
  return createNotifications(users.map((user) => ({
    userId: user.id,
    type: input.approved ? "requirement_approved" : "requirement_rejected",
    title: input.approved ? "Requirement approved" : "Requirement needs review",
    body: input.approved
      ? `${input.requirementTitle} is live and visible to trainers.`
      : input.reason || `${input.requirementTitle} requires changes before it can continue.`,
    href: `/requirements/${input.requirementId}`,
    entityType: "requirement",
    entityId: input.requirementId,
    metadata: input,
  })));
}

export async function notifyAgreementSigned(input: {
  agreementId: string;
  applicationId: string;
  requirementTitle: string;
  vendorId: string;
  trainerId: string;
}) {
  const [vendorUsers, trainerUsers] = await Promise.all([
    findUsersForVendorIds([input.vendorId]),
    findUsersForTrainerIds([input.trainerId]),
  ]);
  return createNotifications([...vendorUsers, ...trainerUsers].map((user) => ({
    userId: user.id,
    type: "agreement_signed",
    title: "Agreement signed",
    body: `Agreement for ${input.requirementTitle} has been signed.`,
    href: "/agreements",
    entityType: "agreement",
    entityId: input.agreementId,
    metadata: input,
  })));
}

export async function notifyPaymentReleased(input: {
  paymentId: string;
  agreementId: string;
  requirementTitle: string;
  vendorId: string;
  trainerId: string;
  amount: number;
  currency?: string;
}) {
  const [vendorUsers, trainerUsers] = await Promise.all([
    findUsersForVendorIds([input.vendorId]),
    findUsersForTrainerIds([input.trainerId]),
  ]);
  return createNotifications([...vendorUsers, ...trainerUsers].map((user) => ({
    userId: user.id,
    type: "payment_released",
    title: "Payment recorded",
    body: `Payment of ${input.currency ?? "INR"} ${input.amount.toLocaleString("en-IN")} was recorded for ${input.requirementTitle}.`,
    href: "/agreements",
    entityType: "payment",
    entityId: input.paymentId,
    metadata: input,
  })));
}

export async function notifyProfileVerificationUpdate(input: {
  userId: string;
  role: "trainer" | "vendor";
  verified: boolean;
}) {
  return createNotification({
    userId: input.userId,
    type: "profile_verification_update",
    title: input.verified ? "Profile verified" : "Profile verification update",
    body: input.role === "vendor"
      ? input.verified
        ? "Your organisation profile is verified."
        : "Your organisation profile verification status was updated."
      : input.verified
        ? "Your trainer profile is verified."
        : "Your trainer profile verification status was updated.",
    href: "/profile",
    entityType: input.role,
    entityId: input.userId,
    metadata: input,
  });
}
