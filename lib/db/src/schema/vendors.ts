import { pgTable, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

export const vendorsTable = pgTable("vendors", {
  id: text("id").primaryKey(),
  companyName: text("company_name").notNull(),
  orgType: text("org_type"),
  industry: text("industry").notNull(),
  location: text("location").notNull(),
  contactName: text("contact_name").notNull(),
  contactDesignation: text("contact_designation").notNull(),
  email: text("email").notNull(),
  about: text("about"),
  logoUrl: text("logo_url").notNull(),
  websiteUrl: text("website_url"),
  verified: boolean("verified").notNull().default(false),
  emailPrefs: jsonb("email_prefs")
    .$type<{
      newApplication: boolean;
      trainerWithdrew: boolean;
      messages: boolean;
    }>()
    .notNull()
    .default({
      newApplication: true,
      trainerWithdrew: true,
      messages: true,
    }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Vendor = typeof vendorsTable.$inferSelect;
export type VendorEmailPrefs = NonNullable<Vendor["emailPrefs"]>;
