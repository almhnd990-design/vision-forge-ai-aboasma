/**
 * Prints the real configuration state of this deployment.
 *
 * Nothing is inferred and nothing is assumed: each capability is reported as available
 * only when every environment variable it needs is present. This exists so operators (and
 * the delivery report) can state precisely what is live rather than guessing.
 *
 * Run with: npm run check:env
 */

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

/** Minimal .env reader so this script has no dependencies. */
function readEnvFile(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const rawLine of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const fileEnv = {
  ...readEnvFile(path.join(root, ".env")),
  ...readEnvFile(path.join(root, ".env.local")),
  ...readEnvFile(path.join(root, ".env.production")),
};
const env = { ...fileEnv, ...process.env };
const present = (key) => Boolean(String(env[key] ?? "").trim());
const sources = (key) => {
  const fromFile = Boolean(String(fileEnv[key] ?? "").trim());
  const fromProcess = Boolean(String(process.env[key] ?? "").trim());
  if (fromFile && fromProcess) return "file+env";
  if (fromFile) return "file";
  if (fromProcess) return "process";
  return "MISSING";
};

const groups = [
  {
    name: "Authentication / cloud persistence (required for a paid product)",
    keys: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
  },
  {
    name: "Billing (required to take money)",
    keys: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRICE_STARTER", "STRIPE_PRICE_GROWTH", "STRIPE_PRICE_SCALE"],
  },
  {
    name: "Connector credential encryption (required to store provider keys)",
    keys: ["CONNECTOR_ENCRYPTION_KEY"],
  },
  {
    name: "AI reasoning (optional; deterministic analysis works without it)",
    keys: ["OPENAI_API_KEY", "DEEPSEEK_API_KEY"],
    anyOf: true,
  },
  {
    name: "Legacy machine endpoint (optional; not customer authentication)",
    keys: ["AGENT_RUN_SECRET"],
  },
  {
    name: "Application URL / SEO",
    keys: ["NEXT_PUBLIC_APP_URL"],
  },
];

const capabilityState = [];
function capability(label, ok, detail) {
  capabilityState.push({ label, ok, detail });
}

console.log("GhostOps AI — configuration check\n");
console.log(`Working directory: ${root}\n`);

for (const group of groups) {
  console.log(`── ${group.name}`);
  for (const key of group.keys) {
    const state = sources(key);
    console.log(`   ${present(key) ? "SET    " : "MISSING"}  ${key.padEnd(30)} (${state})`);
  }
  if (group.anyOf) {
    const anyPresent = group.keys.some(present);
    console.log(`   → ${anyPresent ? "at least one provider configured" : "no provider configured"}`);
  }
  console.log("");
}

capability(
  "Accounts, sign-in and cloud persistence",
  present("NEXT_PUBLIC_SUPABASE_URL") && present("NEXT_PUBLIC_SUPABASE_ANON_KEY") && present("SUPABASE_SERVICE_ROLE_KEY"),
  "needs Supabase URL, anon key and service role key",
);
capability(
  "Paid subscriptions (Stripe checkout, webhooks, portal)",
  ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRICE_STARTER", "STRIPE_PRICE_GROWTH", "STRIPE_PRICE_SCALE"].every(present) &&
    present("SUPABASE_SERVICE_ROLE_KEY"),
  "needs all five Stripe variables plus server-side database access",
);
capability(
  "Stripe business-data connector",
  present("CONNECTOR_ENCRYPTION_KEY"),
  "needs CONNECTOR_ENCRYPTION_KEY to store the restricted key securely",
);
capability("AI reasoning layer", present("OPENAI_API_KEY") || present("DEEPSEEK_API_KEY"), "OpenAI or DeepSeek key");
capability("Deterministic analysis engine", true, "always available; requires no credentials");
capability("Shopify connector", false, "not implemented in this release");
capability("Amazon SP-API connector", false, "not implemented in this release");
capability("Gmail connector", false, "not implemented in this release");
capability("Scheduled background scans", false, "no scheduler exists yet");

console.log("── Capability summary");
for (const item of capabilityState) {
  console.log(`   ${item.ok ? "AVAILABLE" : "NOT AVAILABLE"}  ${item.label}`);
  if (!item.ok) console.log(`                → requires: ${item.detail}`);
}

const launchBlockers = capabilityState.filter(
  (c) => !c.ok && ["Accounts, sign-in and cloud persistence", "Paid subscriptions (Stripe checkout, webhooks, portal)"].includes(c.label),
);

console.log("");
if (launchBlockers.length > 0) {
  console.log("LAUNCH BLOCKERS:");
  for (const blocker of launchBlockers) console.log(`  - ${blocker.label}: ${blocker.detail}`);
  console.log("\nVerdict: NOT commercial-launch ready until the blockers above are configured and tested.");
} else {
  console.log("No configuration blockers detected. Live end-to-end verification is still required.");
}
console.log(
  "\nReminder: this script reports configuration only. It does not prove that a payment,\n" +
    "a webhook, an authentication flow or an AI call succeeds.",
);
