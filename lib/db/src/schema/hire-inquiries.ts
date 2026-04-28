import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const hireInquiriesTable = pgTable("hire_inquiries", {
  id: text("id").primaryKey(),
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
