import {
  pgTable,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

export type OnlineProfile = { label: string; url: string };
export type WorkSample = { title: string; url: string; fromYear?: string; fromMonth?: string; toYear?: string; toMonth?: string; current?: boolean; description?: string };
export type Presentation = { title: string; url: string; description?: string };
export type Patent = { title: string; url?: string; year?: string; description?: string };
export type EmploymentDetail = { company: string; title: string; from?: string; to?: string; current?: boolean; description?: string };
export type EducationDetail = { degree: string; institute: string; year?: string; description?: string };

export type TrainerProfileExtras = {
  mobileNumber?: string;
  dateOfBirth?: string;
  workPermit?: string;
  locality?: string;
  fullAddress?: string;
  onlineProfiles?: OnlineProfile[];
  workSamples?: WorkSample[];
  presentations?: Presentation[];
  patents?: Patent[];
  employmentDetails?: EmploymentDetail[];
  educationDetails?: EducationDetail[];
};

export const trainersTable = pgTable("trainers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  headline: text("headline").notNull(),
  mainSkill: text("main_skill").notNull(),
  subSkills: jsonb("sub_skills").$type<string[]>().notNull().default([]),
  experienceYears: integer("experience_years").notNull(),
  location: text("location").notNull(),
  remote: boolean("remote").notNull().default(true),
  rating: numeric("rating").notNull().default("0"),
  reviewCount: integer("review_count").notNull().default(0),
  hourlyRate: integer("hourly_rate").notNull(),
  verified: boolean("verified").notNull().default(false),
  avatarUrl: text("avatar_url").notNull(),
  availability: text("availability"),
  bio: text("bio").notNull(),
  certifications: jsonb("certifications")
    .$type<Array<{ name: string; url?: string }>>()
    .notNull()
    .default([]),
  languages: jsonb("languages").$type<string[]>().notNull().default([]),
  completedTrainings: integer("completed_trainings").notNull().default(0),
  portfolioUrl: text("portfolio_url"),
  developmentExperienceYears: integer("development_experience_years")
    .notNull()
    .default(0),
  trainerType: text("trainer_type"), // 'trainer' | 'developer' | 'both' | null
  resumeUrl: text("resume_url"),
  gender: text("gender"), // 'male' | 'female' | null
  engagedDates: jsonb("engaged_dates")
    .$type<Array<{ startDate: string; endDate: string; note?: string }>>()
    .notNull()
    .default([]),
  profileExtras: jsonb("profile_extras")
    .$type<TrainerProfileExtras>()
    .notNull()
    .default({}),
  emailPrefs: jsonb("email_prefs")
    .$type<{
      endorsements: boolean;
      applicationStatus: boolean;
      newRequirementMatch: boolean;
      messages: boolean;
    }>()
    .notNull()
    .default({
      endorsements: true,
      applicationStatus: true,
      newRequirementMatch: true,
      messages: true,
    }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Trainer = typeof trainersTable.$inferSelect;
export type TrainerEmailPrefs = NonNullable<Trainer["emailPrefs"]>;
