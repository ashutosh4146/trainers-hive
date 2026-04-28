import {
  pgTable,
  text,
  integer,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const applicationsTable = pgTable(
  "applications",
  {
    id: text("id").primaryKey(),
    requirementId: text("requirement_id").notNull(),
    trainerId: text("trainer_id").notNull(),
    status: text("status").notNull().default("submitted"),
    message: text("message").notNull(),
    proposedRate: integer("proposed_rate").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniqueApp: uniqueIndex("applications_req_trainer_unique").on(
      t.requirementId,
      t.trainerId,
    ),
  }),
);

export type Application = typeof applicationsTable.$inferSelect;
