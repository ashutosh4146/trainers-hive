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
  budget: integer("budget").notNull().default(0),
  feeType: text("fee_type").notNull().default("negotiable"),
  location: text("location").notNull().default(""),
  remote: boolean("remote").notNull().default(false),
  deadline: timestamp("deadline", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("open"),
  description: text("description").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  // Extended fields
  trainingType: text("training_type"),       // "technical" | "soft-skills" | "leadership" | "sales" | "compliance" | "other"
  trainingMode: text("training_mode"),       // "remote" | "in-person" | "hybrid"
  trainerCount: integer("trainer_count"),    // how many trainers needed
  trainerType: text("trainer_type"),         // "part-time" | "full-time" | "mentor"
  benefits: text("benefits"),               // "ta-da" | "stay-only" | "none"
  certifications: text("certifications"),   // certifications required (optional)
  language: text("language"),               // specific language required (optional)
  trainerScope: text("trainer_scope"),      // "local" | "pan-india"
  startDate: text("start_date"),            // expected start date (ISO string)
  audienceType: text("audience_type"),      // "freshers" | "lateral" | "both"
  // Posting options / upgrade flags
  isUrgent: boolean("is_urgent").notNull().default(false),
  isFeatured: boolean("is_featured").notNull().default(false),
  isPrivate: boolean("is_private").notNull().default(false),
  hireThroughUs: boolean("hire_through_us").notNull().default(false),
  // Flagging
  flagged: boolean("flagged").notNull().default(false),
  flagReason: text("flag_reason"),
  flaggedBy: text("flagged_by"),            // trainer id
  flaggedAt: timestamp("flagged_at", { withTimezone: true }),
  // Admin moderation: hide from public listing (still visible to vendor & admin)
  hidden: boolean("hidden").notNull().default(false),
});

export type Requirement = typeof requirementsTable.$inferSelect;
