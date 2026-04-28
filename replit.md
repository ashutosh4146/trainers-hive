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

## Roles & demo session

No real authentication this build. The active demo user is stored in `session_state` table with key `"default"`. Three demo users exist:

- `user-vendor` — Aarav Mehta @ Northwind Corp (`vendorId: ven-northwind`)
- `user-trainer` — Priya Sharma (`trainerId: tr-priya`)
- `user-admin` — Trainers Hive Admin

A header role switcher calls `POST /api/session/switch { role }` to flip the active user. All role-gated routes (post requirement, apply, review, application status updates) check the active user.

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
