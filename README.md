# GhostOps AI

A premium bilingual interface for business operations and recovery intelligence, built on the existing Next.js App Router application.

## Routes and design

- `/` redirects to `/en`; `/dashboard` redirects to `/en/dashboard`.
- `/en` and `/ar` are the English and Arabic landing pages.
- `/en/dashboard` and `/ar/dashboard` provide the command center.
- Native dictionaries, server-rendered `lang`/`dir`, logical CSS properties, and self-hosted Manrope/Noto Sans Arabic fonts provide LTR/RTL support.
- The included hooded mascot retains the cyan eyes, indigo/purple lighting, and G identity from the supplied visual reference. The production asset is `public/brand/ghostops-mascot.png`; no remote image URL or generated-asset service is needed at runtime.

## Run and verify

```sh
npm ci
npm run build
npm run test:production
npm run lint
npm run typecheck
npm start
```

The production test starts its own local servers, checks localized routes and assets, and exercises the preserved server endpoint with an ephemeral test credential. It does not call a third-party service or send business data externally.

## Working dashboard

The command center starts empty. Users can enter a business snapshot or import the supplied JSON format, analyze it using the existing deterministic engine, search/filter findings, inspect evidence, record/reopen reviews, export reports, and clear local data. All amounts entered in the form are SAR; JSON amounts are integer halalas (`revenueCents`, etc.).

The workspace is explicitly **local to the browser**, persisted under `ghostops.workspace.v1`. It is not a cloud account, background agent, or live provider connection. Storage failures are surfaced; JSON export provides a portable copy. Snapshot imports are schema-validated and limited to 100 KB / 50 charge candidates. Review actions never contact providers or transfer funds.

The Connections section lists integration requirements honestly. Shopify, Stripe, Amazon, Gmail, cloud authentication/storage, and paid AI reasoning are not activated by this redesign. A connector implementation and provider authorization are needed before those capabilities can be enabled; a key alone does not make a planned connector operational.

## Preserved backend

`POST /api/agent/run`, `lib/agent/analyze.ts`, and `lib/agent/types.ts` remain unchanged. The endpoint uses `Authorization: Bearer <AGENT_RUN_SECRET>` for server-to-server access and validates snapshots with Zod. It reports 503 when its secret is missing, 401 for unauthorized requests, and 400 for invalid input.

The landing page and local dashboard do not need private credentials. Configure `AGENT_RUN_SECRET` only on the server when using the protected API. Other environment variables in `.env.example` are reserved for future integrations. Never use `NEXT_PUBLIC_` for secrets.

## Vercel and review

Use the Next.js preset, repository root, `npm ci`, and `npm run build`. The lockfile is included. This change targets `ghostops-sixextra-redesign` for a pull request into `main`; it must not be merged or promoted to production automatically.

See `VALIDATION.md` for the completed checks and their limits.
