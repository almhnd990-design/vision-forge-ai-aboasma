# GhostOps AI — Build state

Branch: `ghostops-commercial-mvp`
Last verified locally: see the table below.

## Verified locally (this checkout)

| Command | Result |
|---|---|
| `npm run typecheck` | pass — 0 errors |
| `npm run lint` | pass — 0 errors, 0 warnings |
| `npm run build` | pass — 20 routes + 10 prerendered legal pages |
| `npm run test:unit` | **123/123 pass** |
| `npm run test:production` | **24/24 pass** |
| `npm run test:commercial` | **100/100 pass** (1 documented skip) |

Total: **247 passing checks**.

## Critical environment facts (read before running a build)

1. **`next build` needs full process access on this machine.** Next forks `jest-worker`
   children; under a restricted sandbox that fails with `spawn EPERM`. Setting
   `experimental.workerThreads: true` gets compilation through but trips Next's own
   `DataCloneError`, so the standard build path is kept. On Vercel/normal CI this is a
   non-issue.
2. **`npm ci` needs `--ignore-scripts`** in restricted environments: `unrs-resolver`'s
   postinstall cannot spawn. The native packages that matter (`@next/swc-win32-x64-msvc`)
   ship as optional dependencies and are unaffected.
3. The test suites spawn a real Next server, so they also need process access.

## Architecture

| Layer | Path | Status |
|---|---|---|
| Plan / price / limit single source of truth | `lib/plans.ts` | done |
| Feature registry with `live \| beta \| planned` | `lib/plans.ts` | done |
| Runtime capability gating | `lib/config.ts`, `lib/env-contract.ts` | done |
| DB schema + RLS + billing-column guard | `supabase/migrations/*.sql` | done — **not applied**, no Supabase project |
| Tenant access, entitlement + quota enforcement | `lib/db/access.ts` | done |
| AI reasoning with provider abstraction | `lib/ai/reason.ts` | done |
| Deterministic engine wrapper + state machine | `lib/agent/{engine,service}.ts` | done |
| **Scheduled scans (due-job selection + execution)** | `lib/agent/schedule.ts` | done — no scheduler hosting configured |
| Billing: Stripe client, event application, idempotency | `lib/billing/*` | done |
| Connectors: framework, registry, Stripe connector, AES-256-GCM secrets | `lib/connectors/*` | done |
| API routes | `app/api/**` (12 routes) | done |
| Pricing UI in EN/AR | `components/pricing.tsx`, `app/[locale]/pricing` | done |
| Auth UI + onboarding + settings + connections | `app/[locale]/{sign-in,sign-up,onboarding,settings,connections}` | done |
| **Dashboard cloud persistence (server is the store)** | `components/dashboard.tsx`, `app/api/workspace/snapshot` | done |
| **Scan schedule control in settings** | `components/scan-schedule-card.tsx` | done, gated by the feature registry |
| Legal / trust pages (5 docs × 2 locales) | `lib/legal/content.ts` | done, marked as drafts |

## Non-negotiable product rules

1. No price, plan name, limit or Stripe price id outside `lib/plans.ts`.
2. A feature may only be marketed as included when its availability is not `planned`.
3. Deterministic findings are the only source of financial truth; the AI layer may never
   introduce or alter a number, and output referencing an unknown finding is discarded.
4. Entitlements and quotas are enforced server-side. Hiding UI is never the control.
5. Missing credentials produce an explicit configuration state that names the variables.
   Nothing is ever simulated.
6. Authentication is checked before input validation on every customer-facing route.
7. **The scheduler is machine-only** (`AGENT_RUN_SECRET`, constant-time compared) and the set
   of work comes from the database, never from the caller.

## Dashboard storage modes (important)

| Deployment state | Behaviour |
|---|---|
| Accounts configured, workspace exists | **Cloud mode.** Analyses run via `POST /api/analysis/run`; findings, review history and plan usage are read from the database through RLS. `localStorage` is deliberately NOT written, so there is no divergent second source of truth. |
| Accounts not configured | **Local mode.** The deterministic engine runs in the browser exactly as before, with a banner stating that nothing is persisted server-side. |

## What is NOT tested (and must not be claimed)

- **Live Stripe checkout, portal and webhook delivery against real Stripe signatures** — no
  Stripe account. Only the refusal paths are verified.
- **Supabase authentication, RLS and tenant isolation against a live project** — no Supabase
  project. The SQL is written and reviewed, **not executed**.
- **AI reasoning against a live provider** — no OpenAI/DeepSeek key. Only the unconfigured
  state, the anti-fabrication validator and provider selection are tested.
- **A real scheduled scan firing end to end** — needs a live database, a connected provider
  and a hosted trigger. The due-job selection, cadence arithmetic and refusal paths are tested.
- **The cloud dashboard path with a real account** — needs a Supabase project.
- **Any browser-driven UI test.**
