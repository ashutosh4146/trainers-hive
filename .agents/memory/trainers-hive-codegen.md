---
name: Trainers Hive API codegen is NOT live
description: Why you must hand-edit the generated API client instead of running codegen in this repo.
---

# Trainers Hive: the generated API client is hand-maintained, not codegen-driven

`lib/api-client-react/src/generated/api.ts` (~6400 lines) contains all the real
business endpoints (agreements, vendors, trainers, applications, admin, etc.),
but `lib/api-spec/openapi.yaml` only defines `/healthz`. The spec and the
generated client are out of sync.

**Do NOT run `pnpm --filter @workspace/api-spec run codegen`.** Orval is configured
with `clean: true`, so a codegen run would delete the entire hand-maintained
client and regenerate only the healthz hook — breaking the whole app.

**How to apply:** To add or change an API surface, hand-edit the generated files
following the exact existing pattern (e.g. the `listMyAgreements` /
`useListMyAgreements` / `getListMyAgreementsQueryKey` block in
`generated/api.ts`, and the matching interface in `generated/api.schemas.ts`).
Often you don't need a new endpoint at all — check whether an existing list
endpoint already returns the data you need first (e.g. `/my-agreements` returns
fee, dates, counterparty name, and status for the Vendor Spend Dashboard).

**Why:** The project was scaffolded contract-first, but the team evolved the
client by hand. The healthz-only spec is a leftover, not the source of truth.
