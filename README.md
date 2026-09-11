# GhostOps AI

Autonomous business operations and financial recovery agent for online businesses.

## Architecture

- Next.js App Router / TypeScript
- Server-side agent execution endpoint
- Deterministic analytics first; LLM reasoning is intentionally invoked only for cases that require judgment
- Supabase-ready auth/data configuration
- OAuth/API-first integrations; never request customer passwords
- Approval gate for sensitive execution
- Vercel-ready deployment

## Current foundation

The repository contains the branded public experience, command-center concept, typed business-state/insight contracts, a deterministic intelligence engine, and a secured `/api/agent/run` endpoint suitable for scheduled/server-to-server invocation.

The UI intentionally does **not** pretend external services are connected. Amazon, Shopify, Stripe, Gmail and AI-provider execution require their real credentials before those production connectors can be enabled.

## Local setup

1. `npm install`
2. Copy `.env.example` to `.env.local`
3. Set `AGENT_RUN_SECRET` at minimum to exercise the agent endpoint.
4. `npm run dev`

## Agent test

POST `/api/agent/run` with `Authorization: Bearer <AGENT_RUN_SECRET>` and a business snapshot. The deterministic engine returns evidence-backed insights without spending LLM tokens.

## Production security principles

Secrets remain server-side. Use least-privilege OAuth scopes. Start integrations read-only. Require explicit approval for sensitive writes. Persist an audit trail before enabling external execution.

## Next production gates

Real authentication/data persistence and real third-party connectors require the corresponding Supabase/OAuth/API credentials. No mock connector should be presented as live.
