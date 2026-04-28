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

**Firebase Auth** is integrated for real identity management:
- Backend: `firebase-admin` SDK initialised in `artifacts/api-server/src/lib/firebase.ts` using `FIREBASE_SERVICE_ACCOUNT` secret (JSON). After OTP verification, the backend issues a Firebase custom token (uid = sanitised email) returned in `POST /api/auth/otp/verify` response as `customToken`.
- Frontend: `firebase` SDK initialised in `artifacts/trainers-hive/src/lib/firebase.ts` using `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_MESSAGING_SENDER_ID` env vars. After OTP success, `signInWithCustomToken` signs the user into Firebase; `signOutFirebase` is called on sign-out.
- Firebase project: `trainershive-b2995`
- Note: Firebase integration is NOT a Replit connector — credentials are stored as secrets/env vars manually.

**Signup roles (user-facing):**
- `trainer` → maps to `user-trainer` (Priya Sharma)
- `vendor` → maps to `user-vendor` (Aarav Mehta @ Northwind Corp)
- `college` → also maps to `user-vendor` session (same capabilities, different label)

**Admin**: not shown in signup; accessible by backend session only (no role switcher in UI).

**Business email** required for `vendor` and `college` roles. Free domains (Gmail, Yahoo, etc.) are blocked on the signup/login forms.

**Routes**: `/signup` and `/login` are public. `/dashboard`, `/profile`, `/settings`, `/requirements/new` redirect to `/login` if not signed in.

`POST /api/session/switch { role }` switches the active demo user. The `college` role sends `"vendor"` to the backend.

## Key flows

- Vendor: post requirement → see applications → shortlist / hire / reject; leave reviews on hired trainers
- Trainer: browse requirements → apply with message + proposed rate → track application status; edit profile
- Admin: command-center dashboard with platform stats, activity feed, recent requirements, featured trainers; can remove any trainer or requirement from the marketplace via `DELETE /api/trainers/{id}` and `DELETE /api/requirements/{id}` (cascades child rows; logs a "removal" activity entry; UI gated on `user.role === "admin"` via `AdminRemoveButton`)

## Useful commands

- `pnpm run typecheck` — typecheck everything
- `pnpm --filter @workspace/api-spec run codegen` — regenerate Zod schemas + React hooks after editing `openapi.yaml`
- `pnpm --filter @workspace/db run push` — apply Drizzle schema changes to the DB
- `pnpm --filter @workspace/scripts run seed` — wipe and re-seed the database with realistic demo data

## Conventions

- Trainer rating stored as `numeric`; always serialize with `Number()` before returning.
- `subSkills`, `certifications`, `languages` stored as `jsonb` arrays.
- `lib/api-zod/src/index.ts` exports only `./generated/api` to avoid name collisions.
- Frontend imports hooks ONLY from `@workspace/api-client-react`.
- After mutations, invalidate the matching `getXxxQueryKey(...)` query.
- No emojis anywhere in the UI; use lucide-react icons.
