import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  role: text("role").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  avatarUrl: text("avatar_url"),
  vendorId: text("vendor_id"),
  trainerId: text("trainer_id"),
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
});

export type User = typeof usersTable.$inferSelect;
