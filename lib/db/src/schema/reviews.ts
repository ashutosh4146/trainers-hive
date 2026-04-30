import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

export const reviewsTable = pgTable("reviews", {
  id: text("id").primaryKey(),
  trainerId: text("trainer_id").notNull(),
  vendorId: text("vendor_id").notNull(),
  rating: integer("rating").notNull(),
  ratingContent: integer("rating_content"),
  ratingDelivery: integer("rating_delivery"),
  ratingPunctuality: integer("rating_punctuality"),
  ratingCommunication: integer("rating_communication"),
  comment: text("comment").notNull(),
  engagementTitle: text("engagement_title"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Review = typeof reviewsTable.$inferSelect;
