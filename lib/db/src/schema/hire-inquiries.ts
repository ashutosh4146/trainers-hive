import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const hireInquiriesTable = pgTable("hire_inquiries", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  companyName: text("company_name").notNull(),
  contactName: text("contact_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  trainingNeed: text("training_need").notNull(),
  budget: text("budget"),
  timeline: text("timeline"),
  headcount: text("headcount"),
  location: text("location"),
  status: text("status").notNull().default("new"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const hireInquiryMessagesTable = pgTable("hire_inquiry_messages", {
  id: text("id").primaryKey(),
  inquiryId: text("inquiry_id")
    .notNull()
    .references(() => hireInquiriesTable.id, { onDelete: "cascade" }),
  senderUserId: text("sender_user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type HireInquiryMessage = typeof hireInquiryMessagesTable.$inferSelect;
