import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const verificationRequestsTable = pgTable("verification_requests", {
  id: text("id").primaryKey(),
  trainerId: text("trainer_id").notNull(),
  status: text("status").notNull().default("pending"),
  message: text("message"),
  adminNote: text("admin_note"),
  // Identity & qualification fields
  aadhaarNumber: text("aadhaar_number"),
  panNumber: text("pan_number"),
  qualification: text("qualification"),
  dateOfBirth: text("date_of_birth"), // stored as YYYY-MM-DD string
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type VerificationRequest = typeof verificationRequestsTable.$inferSelect;
