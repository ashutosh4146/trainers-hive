import {
  pgTable,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

export const requirementsTable = pgTable("requirements", {
  id: text("id").primaryKey(),
  vendorId: text("vendor_id").notNull(),
  title: text("title").notNull(),
  skill: text("skill").notNull(),
  subSkills: jsonb("sub_skills").$type<string[]>().notNull().default([]),
  durationDays: integer("duration_days").notNull(),
  budget: integer("budget").notNull(),
  feeType: text("fee_type").notNull(),
  location: text("location").notNull(),
  remote: boolean("remote").notNull().default(false),
  deadline: timestamp("deadline", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("open"),
  description: text("description").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Requirement = typeof requirementsTable.$inferSelect;
