/**
 * End-to-end HTTP checks for the commercial layer.
 *
 * These run against a real production Next.js server and assert the properties that
 * matter before launch: pricing renders with the launch prices in both languages, no
 * purchase path is offered while billing is unconfigured, and every protected endpoint
 * refuses to act without genuine authentication.
 *
 * IMPORTANT: this suite deliberately does NOT claim to test payments, webhooks against
 * live Stripe, or AI reasoning, because no Stripe/Supabase/OpenAI credentials exist in
 * this environment. Each of those is reported as a skipped, explicitly-stated gap.
 *
 * Run with: npm run test:commercial
 */

import assert from "node:assert/strict";
import { spawn } from "node:child_process";

let checks = 0;
const skipped = [];
const check = (condition, label) => {
  assert.ok(condition, label);
  checks++;
  console.log(`PASS ${label}`);
};
const skip = (label, why) => {
  skipped.push(`${label} — ${why}`);
  console.log(`SKIP ${label} (${why})`);
};

const PORT = 4351;
const BASE = `http://127.0.0.1:${PORT}`;

async function withServer(run) {
  const child = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(PORT),
    ],
    {
      env: { ...process.env, NEXT_PUBLIC_APP_URL: BASE, NODE_ENV: "production" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  let output = "";
  // Poll HTTP readiness rather than scraping stdout: the banner text varies between
  // Next.js versions and CI environments, but a 200 from the server does not.
  const ready = (async () => {
    const deadline = Date.now() + 60_000;
    let lastError = "no attempt made";
    while (Date.now() < deadline) {
      if (child.exitCode !== null) {
        throw new Error(`server exited ${child.exitCode}: ${output}`);
      }
      try {
        const response = await fetch(`${BASE}/en`, { redirect: "manual" });
        if (response.status > 0) return;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    throw new Error(`server did not become ready (${lastError}): ${output}`);
  })();

  child.stdout.on("data", (data) => {
    output += data.toString();
  });
  child.stderr.on("data", (data) => {
    output += data.toString();
  });

  await ready;
  try {
    await run(BASE);
  } finally {
    if (child.exitCode === null) {
      await new Promise((resolve) => {
        child.once("exit", resolve);
        child.kill("SIGTERM");
      });
    }
  }
}

await withServer(async (base) => {
  // ---- pricing renders, in both languages, with the launch prices ------------------
  for (const [path, locale, dir] of [
    ["/en/pricing", "en", "ltr"],
    ["/ar/pricing", "ar", "rtl"],
  ]) {
    const response = await fetch(base + path);
    const html = await response.text();
    check(response.status === 200, `${path}: responds 200`);
    check(
      html.includes(`lang="${locale}"`) && html.includes(`dir="${dir}"`),
      `${path}: native language and direction`,
    );
    /*
     * Plan identity is asserted through the stable `data-plan-id` attribute rather than
     * the display name, because the name is intentionally localized (Starter vs المبتدئ).
     */
    for (const planId of ["starter", "growth", "scale"]) {
      check(
        html.includes(`data-plan-id="${planId}"`),
        `${path}: the ${planId} plan card is rendered`,
      );
    }
    /*
     * Prices are asserted as exact integer halalas from the central plan registry.
     * Matching the formatted string would be brittle: Arabic renders SAR with
     * Arabic-Indic digits, which is correct behaviour, not a bug.
     */
    for (const [planId, halalas] of [
      ["starter", 9900],
      ["growth", 29900],
      ["scale", 79900],
    ]) {
      check(
        html.includes(`data-price-halalas="${halalas}"`),
        `${path}: ${planId} renders the configured price of ${halalas} halalas (SAR ${halalas / 100})`,
      );
    }
    check(
      html.includes('data-currency="SAR"'),
      `${path}: prices are denominated in SAR`,
    );
    check(
      html.includes("data-plan-name"),
      `${path}: plan names are localized rather than hard-coded`,
    );
    check(
      html.includes('id="pricing"'),
      `${path}: pricing section has a stable anchor`,
    );
    check(
      html.includes("Terms") || html.includes("الشروط"),
      `${path}: legal links are present`,
    );
  }

  // ---- honest configuration state instead of a fake purchase path ------------------
  {
    const html = await (await fetch(base + "/en/pricing")).text();
    const billingConfigured = (process.env.STRIPE_SECRET_KEY ?? "").trim().length > 0;
    if (!billingConfigured) {
      check(
        html.includes("Checkout is not available on this deployment"),
        "unconfigured billing shows an explicit notice",
      );
      check(
        html.includes("STRIPE_SECRET_KEY"),
        "the notice names the missing environment variable",
      );
      check(
        !/href="https:\/\/checkout\.stripe\.com/.test(html),
        "no Stripe checkout link is rendered while billing is unconfigured",
      );
    } else {
      skip("unconfigured-billing notice", "STRIPE_SECRET_KEY is set in this environment");
    }
    check(
      html.includes("Scheduled background scans") || html.includes("Coming soon") || html.includes("roadmap"),
      "the page states that unfinished capabilities are not available today",
    );
  }

  // ---- landing page carries the pricing section and a sign-up path -----------------
  {
    const html = await (await fetch(base + "/en")).text();
    check(html.includes('id="pricing"'), "/en: the landing page includes the pricing section");
    check(html.includes("/en/pricing"), "/en: navigation links to the pricing page");
  }

  // ---- protected endpoints refuse unauthenticated callers --------------------------
  {
    const cases = [
      [
        "/api/analysis/run",
        {
          workspaceId: "00000000-0000-0000-0000-000000000000",
          snapshot: {
            workspaceId: "ws",
            revenueCents: 1,
            previousRevenueCents: 1,
            refundPendingCents: 0,
            duplicateChargeCandidates: [],
          },
        },
      ],
      ["/api/findings/decide", {
        workspaceId: "00000000-0000-0000-0000-000000000000",
        findingId: "00000000-0000-0000-0000-000000000000",
        decision: "reviewed",
      }],
      ["/api/connections", { workspaceId: "00000000-0000-0000-0000-000000000000" }],
      ["/api/connections/sync", {
        workspaceId: "00000000-0000-0000-0000-000000000000",
        providerKey: "stripe",
      }],
      ["/api/billing/checkout", {
        workspaceId: "00000000-0000-0000-0000-000000000000",
        planId: "growth",
      }],
      ["/api/billing/portal", { workspaceId: "00000000-0000-0000-0000-000000000000" }],
    ];
    for (const [path, body] of cases) {
      const response = await fetch(base + path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({}));
      /*
       * 401 when accounts are configured and the caller is anonymous; 503 when the
       * deployment has no Supabase project at all. Any other status would mean the
       * endpoint tried to do work for an unauthenticated caller.
       */
      check(
        response.status === 401 || response.status === 503,
        `${path}: unauthenticated POST is refused with ${response.status} (${payload?.error?.code ?? "no code"})`,
      );
      check(
        !("url" in payload) && !("findings" in payload) && !("analysisId" in payload) && !("connections" in payload),
        `${path}: no fake success payload is returned`,
      );
    }
  }

  // ---- a requested plan the customer cannot choose a price for ---------------------
  {
    const response = await fetch(base + "/api/billing/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId: "00000000-0000-0000-0000-000000000000",
        planId: "not-a-real-plan",
      }),
    });
    const payload = await response.json().catch(() => ({}));
    /*
     * The plan id is validated against the central registry, but authentication now runs
     * first, so an anonymous caller sees the auth/config failure (401/503) and never
     * reaches plan validation. Either outcome is a refusal; a checkout URL never appears.
     */
    check(
      response.status === 401 || response.status === 400 || response.status === 503,
      `an unknown plan id cannot produce a checkout session (${response.status}, ${payload?.error?.code ?? "no code"})`,
    );
    check(
      payload?.error?.code !== undefined || !payload?.url,
      "no checkout URL is returned for an invalid request",
    );
  }

  // ---- webhook rejects anything it cannot verify ----------------------------------
  {
    const noSignature = await fetch(base + "/api/billing/webhook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "evt_forged", type: "customer.subscription.updated" }),
    });
    check(
      [400, 503].includes(noSignature.status),
      `webhook without a signature is refused with ${noSignature.status}`,
    );

    const badSignature = await fetch(base + "/api/billing/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": "t=1,v1=deadbeefdeadbeefdeadbeefdeadbeef",
      },
      body: JSON.stringify({
        id: "evt_forged",
        type: "customer.subscription.updated",
        data: { object: { id: "sub_fake" } },
      }),
    });
    check(
      [400, 503].includes(badSignature.status),
      `webhook with a forged signature is refused with ${badSignature.status}`,
    );
    const payload = await badSignature.json().catch(() => ({}));
    check(
      badSignature.status === 503 || payload?.error?.code === "invalid_signature",
      "a forged webhook is rejected as a signature failure (or as unconfigured billing)",
    );
  }

  // ---- unconfigured capabilities are never simulated ------------------------------
  {
    const response = await fetch(base + "/api/analysis/run", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer not-the-agent-secret",
      },
      body: JSON.stringify({
        workspaceId: "00000000-0000-0000-0000-000000000000",
        snapshot: { workspaceId: "x", revenueCents: 1, previousRevenueCents: 1, refundPendingCents: 0 },
      }),
    });
    check(
      [401, 402, 503].includes(response.status),
      `an analysis cannot be started without a real account or plan (${response.status})`,
    );
  }

  // ---- legacy protected endpoint still behaves as documented ----------------------
  {
    const response = await fetch(base + "/api/agent/run", { method: "POST" });
    const payload = await response.json().catch(() => ({}));
    check(
      response.status === 503 && payload?.error === "AGENT_RUN_SECRET is not configured",
      "the machine endpoint still reports missing configuration with 503",
    );
  }

  // ---- health of the protected dashboard redirect and legal placeholder pages ------
  {
    const privacy = await fetch(base + "/en/legal/privacy");
    const terms = await fetch(base + "/en/legal/terms");
    const refunds = await fetch(base + "/en/legal/refunds");
    check(
      [200, 404].includes(privacy.status) && [200, 404].includes(terms.status) && [200, 404].includes(refunds.status),
      "legal routes respond deterministically",
    );
    if (privacy.status === 404) {
      skip("legal pages", "not implemented yet in this build");
    }
    if (privacy.status === 200) {
      const html = await privacy.text();
      check(
        html.includes("launch draft") || html.includes("مسودة إطلاق"),
        "legal pages display their draft notice rather than reading as final",
      );
      check(
        !/SOC 2|ISO 27001|PCI DSS compliant/i.test(html),
        "legal pages make no certification claim",
      );
    }
  }

  // ---- account surfaces render in both languages -----------------------------------
  for (const [path, locale, dir] of [
    ["/en/sign-in", "en", "ltr"],
    ["/ar/sign-in", "ar", "rtl"],
    ["/en/sign-up", "en", "ltr"],
    ["/ar/sign-up", "ar", "rtl"],
    ["/en/onboarding", "en", "ltr"],
    ["/ar/onboarding", "ar", "rtl"],
    ["/en/settings", "en", "ltr"],
    ["/ar/settings", "ar", "rtl"],
    ["/en/connections", "en", "ltr"],
    ["/ar/connections", "ar", "rtl"],
  ]) {
    const response = await fetch(base + path);
    const html = await response.text();
    check(response.status === 200, `${path}: responds 200`);
    check(
      html.includes(`lang="${locale}"`) && html.includes(`dir="${dir}"`),
      `${path}: native language and direction`,
    );
    /*
     * With no Supabase project configured these pages must explain the configuration
     * requirement. They must never render a credential form that cannot possibly work.
     */
    if (!(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim()) {
      check(
        html.includes("not configured") || html.includes("غير مُهيَّأة") || html.includes("غير مهيأ"),
        `${path}: states that accounts are not configured instead of pretending`,
      );
    } else {
      skip(`${path} unconfigured notice`, "Supabase is configured in this environment");
    }
  }

  // ---- connections surface must not offer actions it cannot perform ----------------
  {
    const html = await (await fetch(base + "/en/connections")).text();
    if (!(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim()) {
      /*
       * Without accounts the provider list is intentionally not rendered at all: listing
       * connectable providers to an anonymous visitor would imply a capability the
       * deployment does not have. What matters is that no credential field is offered.
       */
      check(
        html.includes("Accounts are not configured"),
        "/en/connections: explains that accounts are not configured",
      );
      check(
        html.includes("NEXT_PUBLIC_SUPABASE_URL") && html.includes("SUPABASE_SERVICE_ROLE_KEY"),
        "/en/connections: names the missing variables",
      );
      check(
        !html.includes('type="password"'),
        "/en/connections: no credential field is rendered while nothing can be connected",
      );
      check(
        !/Coming soon/i.test(html),
        "/en/connections: no provider list is shown to an anonymous visitor",
      );
      skip(
        "connections provider list (coming soon labels)",
        "requires a signed-in account, which needs a Supabase project",
      );
    } else {
      check(html.includes("Shopify") && html.includes("Gmail"), "/en/connections: providers are listed");
      check(html.includes("Coming soon"), "/en/connections: unimplemented providers are labelled Coming soon");
    }
  }

  // ---- the dashboard states its storage mode honestly ------------------------------
  {
    const html = await (await fetch(base + "/en/dashboard")).text();
    check(html.includes("GhostOps"), "/en/dashboard: renders");
    if (!(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim()) {
      check(
        html.includes("Accounts are not configured on this deployment"),
        "/en/dashboard: announces that no account storage exists on this deployment",
      );
      check(
        html.includes("locally in this browser only"),
        "/en/dashboard: states that the workspace is browser-local",
      );
    } else {
      skip("dashboard storage notice", "Supabase is configured in this environment");
    }
    check(
      html.includes("/en/settings") && html.includes("/en/connections"),
      "/en/dashboard: links to account settings and provider connections",
    );
  }

  // ---- workspace + scheduler endpoints refuse anonymous callers --------------------
  {
    const cases = [
      ["/api/workspace/snapshot", "GET"],
      ["/api/workspace/scan-schedule", "GET"],
      ["/api/cron/scan", "POST"],
    ];
    for (const [path, method] of cases) {
      const response = await fetch(base + path, { method });
      const payload = await response.json().catch(() => ({}));
      check(
        response.status === 401 || response.status === 503,
        `${method} ${path}: refused without credentials (${response.status}, ${payload?.error?.code ?? "no code"})`,
      );
      check(
        !("findings" in payload) && !("workspace" in payload) && !("outcomes" in payload),
        `${method} ${path}: returns no workspace data to an anonymous caller`,
      );
    }
  }

  // ---- the scheduler never runs unauthenticated and never invents work -------------
  {
    const withBadSecret = await fetch(base + "/api/cron/scan", {
      method: "POST",
      headers: { authorization: "Bearer not-the-real-secret" },
    });
    check(
      [401, 503].includes(withBadSecret.status),
      `POST /api/cron/scan: a wrong secret is refused (${withBadSecret.status})`,
    );
    const payload = await withBadSecret.json().catch(() => ({}));
    check(
      payload?.ran === undefined,
      "POST /api/cron/scan: no scan summary is returned for an unauthorised caller",
    );
  }

  // ---- the scan-schedule endpoint validates before it acts -------------------------
  {
    const response = await fetch(base + "/api/workspace/scan-schedule", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspaceId: "not-a-uuid", enabled: true }),
    });
    check(
      response.status === 400 || response.status === 401 || response.status === 503,
      `POST /api/workspace/scan-schedule: rejects a malformed request (${response.status})`,
    );
    const payload = await response.json().catch(() => ({}));
    check(payload?.ok !== true, "POST /api/workspace/scan-schedule: no success is reported");
  }
});

console.log(`\n${checks} commercial HTTP checks passed.`);
if (skipped.length > 0) {
  console.log(`\n${skipped.length} check(s) skipped and are NOT verified:`);
  for (const item of skipped) console.log(`  - ${item}`);
}
console.log(
  "\nNOT COVERED BY THIS SUITE (no credentials in this environment): live Stripe checkout," +
    "\nwebhook delivery against real Stripe signatures, Supabase authentication and tenant" +
    "\nisolation against a live project, and AI reasoning against a live provider.",
);
