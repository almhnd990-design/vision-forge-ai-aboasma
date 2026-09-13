# GhostOps AI — Build state

Branch: `ghostops-commercial-mvp` · Commit: `7e3238aa`
Pushed: 74 files, verified byte-identical to the local working tree (Git blob SHA-1).

## Verified locally (this checkout)

| Command | Result |
|---|---|
| `npm ci --ignore-scripts` | 318 packages |
| `npm run typecheck` | pass — 0 errors |
| `npm run lint` | pass — 0 errors, 0 warnings |
| `npm run build` | pass — 15 routes + 10 prerendered legal pages |
| `npm run test:unit` | **75/75 pass** (commercial architecture) |
| `npm run test:production` | **24/24 pass** (pre-existing suite, still green) |
| `npm run test:commercial` | **50/50 pass** (HTTP guards, pricing, webhook) |

Total: **149 passing checks**. See "What is NOT tested" below before quoting this number.

## Critical environment facts (read before running a build)

1. **`next build` needs full process access on this machine.** Next forks `jest-worker`
   children; under a restricted sandbox that fails with `spawn EPERM`. Setting
   `experimental.workerThreads: true` gets compilation through but trips Next's own
   `DataCloneError`, so the standard build path is kept. On Vercel/normal CI this is a
   non-issue.
2. **`npm ci` needs `--ignore-scripts`** in restricted environments: `unrs-resolver`'s
   postinstall cannot spawn. The native packages that matter (`@next/swc-win32-x64-msvc`)
   ship as optional dependencies and are unaffected.
3. `STDIO` note: the test suites spawn a real Next server, so they also need process access.

## Architecture

| Layer | Path | Status |
|---|---|---|
| Plan / price / limit single source of truth | `lib/plans.ts` | done |
| Feature registry with `live \| beta \| planned` | `lib/plans.ts` | done |
| Runtime capability gating | `lib/config.ts`, `lib/env-contract.ts` | done |
| Locale primitives (acyclic) | `lib/locale.ts` | done |
| DB schema + RLS + billing-column guard | `supabase/migrations/*.sql` | done — **not applied**, no Supabase project |
| DB row types | `lib/db/types.ts` | done |
| Tenant access, entitlement + quota enforcement | `lib/db/access.ts` | done |
| Supabase clients (browser / request-scoped / service) | `lib/db/{browser,server}.ts` | done |
| AI reasoning with provider abstraction | `lib/ai/reason.ts` | done |
| Deterministic engine wrapper + state machine | `lib/agent/engine.ts`, `lib/agent/service.ts` | done |
| Billing: Stripe client, event application, idempotency | `lib/billing/*` | done |
| Connectors: framework, registry, Stripe connector, AES-256-GCM secrets | `lib/connectors/*` | done |
| API routes | `app/api/{analysis,findings,connections,billing}/**` | done |
| Pricing UI in EN/AR | `components/pricing.tsx`, `app/[locale]/pricing` | done |
| Legal / trust pages (5 docs × 2 locales) | `lib/legal/content.ts`, `app/[locale]/legal/[doc]` | done, marked as drafts |
| Auth UI, onboarding, settings, dashboard rewire | — | **not started** |
| Connector UI (connect / sync / disconnect) | — | **not started** (API exists) |

## Non-negotiable product rules

1. No price, plan name, limit or Stripe price id outside `lib/plans.ts`.
2. A feature may only be marketed as included when its availability is not `planned`.
3. Deterministic findings are the only source of financial truth; the AI layer may never
   introduce or alter a number, and output referencing an unknown finding is discarded.
4. Entitlements and quotas are enforced server-side. Hiding UI is never the control.
5. Missing credentials produce an explicit configuration state that names the variables.
   Nothing is ever simulated: no payment, no connection, no sync, no AI text.
6. Authentication is checked before input validation on every customer-facing route.

## What is NOT tested (and must not be claimed)

- **Live Stripe checkout, portal and webhook delivery against real Stripe signatures** —
  no Stripe account is configured. Only the refusal paths are verified (503/400).
- **Supabase authentication, RLS and tenant isolation against a live project** — no
  Supabase project exists. The SQL is written and reviewed, not executed.
- **AI reasoning against a live provider** — no OpenAI/DeepSeek key. Only the
  unconfigured state, the anti-fabrication validator and provider selection are tested.
- **The Stripe connector against a real Stripe account** — only its spec, honesty flags
  and registry behaviour are tested.
- **Any browser-driven UI test.** Onboarding, settings, auth screens and the connector UI
  do not exist yet.
