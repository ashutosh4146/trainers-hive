# Trainers Hive

A B2B training marketplace where vendors (companies, colleges, institutes) post training requirements and verified trainers apply. Built as a pnpm monorepo.

## Architecture

- **Frontend**: `artifacts/trainers-hive` — React + Vite + TypeScript, wouter routing, TanStack Query, Tailwind + shadcn/ui, framer-motion, recharts
- **Backend**: `artifacts/api-server` — Express + Drizzle ORM, OpenAPI-driven
- **Database**: PostgreSQL (Replit-managed, `DATABASE_URL`)
- **Shared libs**:
  - `lib/api-spec` — OpenAPI source (`openapi.yaml`)
  - `lib/api-zod` — generated Zod schemas
  - `lib/api-client-react` — generated React Query hooks
  - `lib/db` — Drizzle schema (one table per file in `src/schema/`)
- **Mockup sandbox**: `artifacts/mockup-sandbox` — design exploration only

## Auth & roles

Frontend auth state stored in `localStorage` key `th_auth` (via `src/hooks/useAuth.ts`).

**Firebase Auth** is integrated for real identity management using **Email Link (passwordless/magic link)** sign-in:
- Firebase sends the sign-in email itself — no third-party email service needed.
- Auth flow: user enters email → `sendSignInLinkToEmail()` → Firebase emails a magic link → user clicks link → redirected to `/auth/callback` → `signInWithEmailLink()` completes Firebase sign-in → backend session switch → dashboard.
- Pending sign-in data (role, name, orgName) stored in `localStorage` key `th_pending_auth` until callback completes.
- Backend: `firebase-admin` SDK in `artifacts/api-server/src/lib/firebase.ts` using `FIREBASE_SERVICE_ACCOUNT` secret (JSON). OTP routes still exist but are no longer used by the frontend.
- Frontend: `firebase` SDK in `artifacts/trainers-hive/src/lib/firebase.ts` using `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_MESSAGING_SENDER_ID` env vars.
- Auth callback page: `artifacts/trainers-hive/src/pages/AuthCallback.tsx` — route `/auth/callback`.
- Firebase project: `trainershive-b2995`
- **Required Firebase Console steps**: (1) Authentication → Sign-in method → Enable "Email link (passwordless sign-in)". (2) Authentication → Settings → Authorized domains → add your Replit dev domain.
- Note: Firebase integration is NOT a Replit connector — credentials are stored as secrets/env vars manually.

**Signup roles (user-facing):**
- `trainer` → maps to `user-trainer` (Priya Sharma)
- `vendor` → maps to `user-vendor` (Aarav Mehta @ Northwind Corp)
- `college` → also maps to `user-vendor` session (same capabilities, different label)

**Admin**: not shown in signup; accessible by backend session only (no role switcher in UI).

**Business email** required for `vendor` and `college` roles. Free domains (Gmail, Yahoo, etc.) are blocked on the signup/login forms.

**Routes**: `/signup` and `/login` are public. `/dashboard`, `/profile`, `/settings`, `/requirements/new` redirect to `/login` if not signed in. `/support`, `/about`, `/terms` are public static pages accessible without auth.

`POST /api/session/switch { role }` switches the active demo user. The `college` role sends `"vendor"` to the backend.

## Key flows

- Vendor: post requirement → see applications → shortlist / hire / reject; leave reviews on hired trainers
- Trainer: browse requirements → apply with message + proposed rate → track application status; edit profile
- Admin: command-center dashboard with platform stats, activity feed, recent requirements, featured trainers; can remove any trainer or requirement from the marketplace via `DELETE /api/trainers/{id}` and `DELETE /api/requirements/{id}` (cascades child rows; logs a "removal" activity entry; UI gated on `user.role === "admin"` via `AdminRemoveButton`). Admin dashboard also shows a **Flagged Requirements** section listing all flagged requirements with Unflag and Remove actions.
- **Requirement flagging**: Trainers can flag a requirement from the detail page (`POST /requirements/:id/flag` with a `reason`). A flag dialog offers preset reason chips plus a free-text "Other" field. The flagged requirement shows a badge on the detail page and cannot be re-flagged by the same trainer. Admin can unflag via `POST /requirements/:id/unflag` or permanently delete. DB columns: `flagged bool`, `flag_reason text`, `flagged_by text`, `flagged_at timestamptz`.
- **Trainer engaged dates**: trainers can mark booked date ranges on their Profile (`engagedDates: [{startDate, endDate, note?}]` stored as jsonb on `trainers`). When viewing a requirement, the Apply button is replaced by a conflict notice if the requirement window (`startDate` + `durationDays`) overlaps any engaged range. Server enforces overlap on `POST /requirements/:id/apply` (returns `409 engaged_dates_conflict`). `PATCH /trainers/:id` is owner-or-admin only and validates engagedDates as real `YYYY-MM-DD` calendar dates with `endDate >= startDate`. `GET /requirements/:id/applications` is owning-vendor-or-admin only (the response now includes engagedDates on nested trainers).
- **In-app messaging**: Vendor and trainer can exchange messages scoped to a specific application once it is shortlisted or hired. DB table `messages` (`id`, `applicationId`, `senderUserId`, `body`, `createdAt`). Routes: `GET /applications/:id/messages` and `POST /applications/:id/messages` — auth-gated to the owning vendor and the applying trainer. UI: `MessageThread` dialog component (`src/components/MessageThread.tsx`) used by both sides; Enter key sends, Shift+Enter newline, messages bubble left/right by `senderUserId`. Vendor: "Message" button appears next to Hire on shortlisted/hired application rows in `RequirementDetail.tsx`. Trainer: "Message" button appears next to the status badge for shortlisted/hired applications in `Dashboard.tsx` (click on row still navigates to requirement).

## Useful commands

- `pnpm run typecheck` — typecheck everything
- `pnpm --filter @workspace/api-spec run codegen` — regenerate Zod schemas + React hooks after editing `openapi.yaml`
- `pnpm --filter @workspace/db run push` — apply Drizzle schema changes to the DB
- `pnpm --filter @workspace/scripts run seed` — wipe and re-seed the database with realistic demo data

## Conventions

- Trainer rating stored as `numeric`; always serialize with `Number()` before returning.
- `subSkills`, `languages` stored as `jsonb` string arrays.
- `certifications` stored as `jsonb` array of `{name: string, url?: string}` (legacy plain-string entries are normalized server-side via `normalizeCertifications`).
- Trainer profile additional fields: `developmentExperienceYears` (int, default 0, separate from `experienceYears` which now means training years), `trainerType` ("trainer" | "developer" | "both", nullable), `resumeUrl` (text, nullable — plain shareable URL until object storage is wired).
- **Profile edit form (Profile.tsx)** uses an 11-field spec for trainers: full name, registered email (read-only from `currentUser.email`), primary skill (cmdk Combobox with custom-add), sub-skills (chip TagInput), training years + development years (separate inputs), location, languages (chip TagInput), certifications (name + verification URL editor), optional resume URL, bio, trainerType (Select). Headline / hourlyRate / remote toggle were removed from this form (the columns remain in DB and existing values are preserved).
- **Invite gating**: TrainerDetail's "Invite to Requirement" button only renders when `user?.role === "vendor"`. Trainers, admins, and guests do not see it.
- **api-zod entry point**: `lib/api-zod/src/validators.ts` (NOT index.ts). Package exports point here. `index.ts` is orval-managed and excluded from tsconfig to avoid duplicate-export collisions.
- **Requirements schema extended fields**: `trainingType`, `trainingMode` ("remote"|"in-person"|"hybrid"), `trainerCount`, `trainerType` ("part-time"|"full-time"|"mentor"), `benefits` ("ta-da"|"stay-only"|"none"), `certifications`, `language`, `trainerScope` ("local"|"pan-india"), `startDate`. All nullable, backward-compatible.
- Budget/feeType are kept in DB for legacy data but NOT shown in the UI — payout is discussed directly between vendor and trainer.
- Frontend imports hooks ONLY from `@workspace/api-client-react`.
- After mutations, invalidate the matching `getXxxQueryKey(...)` query.
- No emojis anywhere in the UI; use lucide-react icons.
- Footer (AppLayout.tsx) links to `/about`, `/hire-us`, `/support`, `/terms`.
