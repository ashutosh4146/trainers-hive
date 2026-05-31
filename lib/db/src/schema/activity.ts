import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const activityTable = pgTable("activity", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  subtitle: text("subtitle").notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Activity = typeof activityTable.$inferSelect;
