/**
 * Minimal ESM loader hooks so Node can execute the TypeScript sources directly in tests.
 *
 * Two jobs:
 *  1. resolve the project's `@/*` path alias (`tsconfig.json` -> `paths`)
 *  2. strip TypeScript syntax, because the sources use `import type` and interfaces
 *
 * Node 24 can strip types natively for `.ts`, but not for `.mts`-style explicit
 * specifiers inside a `.mjs` test that imports `../lib/x.ts` and then hits `@/...` inside
 * those modules. These hooks make both work.
 */

import { register } from "node:module";
import { pathToFileURL } from "node:url";

// Load .env / .env.local the same way Next does, so configuration-gated tests see the
// real environment instead of an empty one.
const nextEnv = await import("@next/env");
const loadEnvConfig = nextEnv.loadEnvConfig ?? nextEnv.default?.loadEnvConfig;
loadEnvConfig?.(process.cwd(), true);

register("./alias-loader-hooks.mjs", pathToFileURL("./scripts/"));
