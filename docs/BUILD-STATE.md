# GhostOps AI — Build state

Branch: `ghostops-commercial-mvp`
Last verified locally: see `node_modules`-independent commands below.

## Verified locally (this checkout)

| Command | Result |
|---|---|
| `npm ci --ignore-scripts` | 318 packages installed |
| `npm run typecheck` | pass (0 errors) |
| `npm run lint` | pass (0 warnings) |
| `npm run build` | pass — Next.js 15.5.24, 6 routes |
| `npm run test:production` | **24/24 pass** |

## Critical environment fact (read before running builds)

`next build` forks `jest-worker` child processes. In this machine's sandboxed
workspace mode, `child_process.fork` fails with `spawn EPERM`, so the build must run
with full file/process access. On Vercel and normal CI this is a non-issue.
`experimental.workerThreads: true` gets compilation further but trips Next's own
`DataCloneError`, so the standard build path is kept.

`npm ci` must be run with `--ignore-scripts` in restricted environments because
`unrs-resolver`'s postinstall cannot spawn. The native packages that actually matter
(`@next/swc-win32-x64-msvc`) ship as optional dependencies and are unaffected.

## Architecture layers present

| Layer | Path | Status |
|---|---|---|
| Plan/pricing single source of truth | `lib/plans.ts` | done |
| Feature registry (live/beta/planned) | `lib/plans.ts` | done |
| Runtime capability gating | `lib/config.ts` | done |
| Locale primitives (acyclic) | `lib/locale.ts` | done |
| DB schema + RLS | `supabase/migrations/*.sql` | done (not applied — no Supabase project) |
| DB row types | `lib/db/types.ts` | done |
| Tenant access + entitlement enforcement | `lib/db/access.ts` | done |
| Supabase clients (browser/request/service) | `lib/db/{browser,server}.ts` | done |
| AI reasoning (provider-abstracted, no fabrication) | `lib/ai/reason.ts` | done |
| Billing / connectors / API routes / UI | — | in progress |

## Non-negotiable product rules

1. No price, plan name, limit or Stripe price ID outside `lib/plans.ts`.
2. A feature may only be marketed as included when its `availability` is not `planned`.
3. Deterministic findings are the only source of financial truth; the AI layer may
   never introduce or alter a number.
4. Plan entitlements are enforced server-side; hiding UI is never the control.
5. When credentials are missing, show an explicit configuration state. Never simulate
   a payment, a connection, a sync, or an AI result.
