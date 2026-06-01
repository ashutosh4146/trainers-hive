import {
  pgTable,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { engagementAgreementsTable } from "./engagement-agreements";

export const agreementPaymentsTable = pgTable("agreement_payments", {
  id: text("id").primaryKey(),
  agreementId: text("agreement_id")
    .notNull()
    .references(() => engagementAgreementsTable.id),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("INR"),
  paidAt: text("paid_at").notNull(),
  note: text("note"),
  recordedByUserId: text("recorded_by_user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type AgreementPayment = typeof agreementPaymentsTable.$inferSelect;
