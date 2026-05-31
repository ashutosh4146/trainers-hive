import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const engagementAgreementsTable = pgTable(
  "engagement_agreements",
  {
    id: text("id").primaryKey(),
    applicationId: text("application_id").notNull(),
    requirementId: text("requirement_id").notNull(),
    vendorId: text("vendor_id").notNull(),
    trainerId: text("trainer_id").notNull(),
    status: text("status").notNull().default("draft"),
    // "draft" | "awaiting_trainer" | "accepted" | "cancelled"

    // Commercial terms
    agreedFee: integer("agreed_fee"),
    feeCurrency: text("fee_currency").notNull().default("INR"),
    paymentSchedule: text("payment_schedule"),
    travelBoarding: text("travel_boarding"),
    cancellationNotice: text("cancellation_notice"),

    // Engagement scope
    startDate: text("start_date"),
    endDate: text("end_date"),
    sessionsCount: integer("sessions_count"),
    locationOrMode: text("location_or_mode"),
    deliverables: text("deliverables"),

    // Legal
    confidentialityClause: boolean("confidentiality_clause").notNull().default(true),
    ipOwnership: text("ip_ownership"),
    governingLawCity: text("governing_law_city").notNull().default("Mumbai"),
    specialClauses: text("special_clauses"),

    // Audit — vendor signature
    vendorUserId: text("vendor_user_id"),
    vendorAcceptedAt: timestamp("vendor_accepted_at", { withTimezone: true }),
    vendorAcceptedIp: text("vendor_accepted_ip"),
    vendorAcceptedUa: text("vendor_accepted_ua"),

    // Audit — trainer signature
    trainerUserId: text("trainer_user_id"),
    trainerAcceptedAt: timestamp("trainer_accepted_at", { withTimezone: true }),
    trainerAcceptedIp: text("trainer_accepted_ip"),
    trainerAcceptedUa: text("trainer_accepted_ua"),

    // Latest trainer change-request note (cleared when vendor resubmits)
    changesRequestedNote: text("changes_requested_note"),

    // Cancellation
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledByUserId: text("cancelled_by_user_id"),
    cancellationReason: text("cancellation_reason"),

    // Audit log
    auditLog: jsonb("audit_log").$type<Array<{
      at: string;
      actorUserId: string;
      actorRole: string;
      action: string;
      ip?: string;
      ua?: string;
      note?: string;
    }>>().notNull().default([]),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniqueAppAgreement: uniqueIndex("engagement_agreements_application_unique").on(
      t.applicationId,
    ),
  }),
);

export type EngagementAgreement = typeof engagementAgreementsTable.$inferSelect;
