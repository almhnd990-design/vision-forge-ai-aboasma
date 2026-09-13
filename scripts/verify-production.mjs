import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
let checks = 0;
const check = (condition, label) => {
  assert.ok(condition, label);
  checks++;
  console.log(`PASS ${label}`);
};
async function withServer(secret, run) {
  const port = secret ? 4342 : 4341;
  const child = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    {
      env: { ...process.env, AGENT_RUN_SECRET: secret },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let output = "";
  child.stderr.on("data", (data) => {
    output += data;
  });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Server failed to start: ${output}`)),
        20000,
      );
      child.stdout.on("data", (data) => {
        output += data;
        if (output.includes("Ready in")) {
          clearTimeout(timer);
          resolve();
        }
      });
      child.once("exit", (code) => {
        clearTimeout(timer);
        reject(new Error(`Server exited ${code}: ${output}`));
      });
    });
    await run(`http://127.0.0.1:${port}`);
  } finally {
    if (child.exitCode === null)
      await new Promise((resolve) => {
        child.once("exit", resolve);
        child.kill("SIGTERM");
      });
  }
}
await withServer("", async (base) => {
  for (const [path, locale, direction] of [
    ["/en", "en", "ltr"],
    ["/ar", "ar", "rtl"],
    ["/en/dashboard", "en", "ltr"],
    ["/ar/dashboard", "ar", "rtl"],
  ]) {
    const response = await fetch(base + path);
    const html = await response.text();
    check(
      response.status === 200 && html.includes("GhostOps"),
      `${path}: page renders`,
    );
    check(
      html.includes(`lang="${locale}"`) && html.includes(`dir="${direction}"`),
      `${path}: native language/direction`,
    );
    if (!path.endsWith("dashboard")) {
      check(
        ["platform", "workflow", "trust"].every((id) =>
          html.includes(`id="${id}"`),
        ),
        `${path}: navigation targets`,
      );
      const cssPath = html.match(/href="([^\"]+\.css[^\"]*)"/)?.[1];
      check(
        cssPath && (await fetch(base + cssPath)).status === 200,
        `${path}: stylesheet available`,
      );
    }
  }
  for (const [path, target] of [
    ["/", "/en"],
    ["/dashboard", "/en/dashboard"],
  ]) {
    const response = await fetch(base + path, { redirect: "manual" });
    check(
      response.status === 307 && response.headers.get("location") === target,
      `${path}: default-language redirect`,
    );
  }
  check((await fetch(base + "/fr")).status === 404, "unsupported locale: 404");
  const asset = await fetch(base + "/brand/ghostops-mascot.png");
  check(
    asset.status === 200 &&
      asset.headers.get("content-type")?.includes("image/png"),
    "mascot is served",
  );
  const localAsset = await readFile("public/brand/ghostops-mascot.png");
  check(
    Buffer.from(await asset.arrayBuffer()).equals(localAsset),
    "mascot bytes match included asset",
  );
  const response = await fetch(base + "/api/agent/run", { method: "POST" });
  check(
    response.status === 503 &&
      (await response.json()).error === "AGENT_RUN_SECRET is not configured",
    "server reports missing configuration",
  );
});
const secret = randomUUID();
await withServer(secret, async (base) => {
  const url = base + "/api/agent/run";
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${secret}`,
  };
  check(
    (await fetch(url, { method: "POST", body: "{}" })).status === 401,
    "server rejects unauthorized analysis",
  );
  check(
    (await fetch(url, { method: "POST", headers, body: "{}" })).status === 400,
    "server rejects invalid snapshot",
  );
  check(
    (await fetch(url, { method: "POST", headers, body: "{" })).status === 400,
    "server rejects malformed JSON",
  );
  const snapshot = {
    workspaceId: "test-business",
    revenueCents: 800000,
    previousRevenueCents: 1000000,
    refundPendingCents: 25000,
    inventoryDays: 3,
    duplicateChargeCandidates: [
      {
        id: "candidate-1",
        amountCents: 12000,
        description: "Candidate supplied by business",
      },
    ],
  };
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(snapshot),
  });
  const result = await response.json();
  check(
    response.status === 200 && result.workspaceId === snapshot.workspaceId,
    "authorized server analysis succeeds",
  );
  check(
    result.insights.length === 4 &&
      result.insights.some(
        (i) => i.kind === "operations" && i.severity === "critical",
      ) &&
      result.insights.filter((i) => i.requiresApproval).length === 1,
    "existing engine retains revenue/refund/duplicate/inventory findings",
  );
  const quiet = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      ...snapshot,
      revenueCents: 1000000,
      refundPendingCents: 0,
      inventoryDays: 30,
      duplicateChargeCandidates: [],
    }),
  });
  check(
    (await quiet.json()).insights.length === 0,
    "healthy snapshot produces no invented findings",
  );
});
console.log(`${checks} production checks passed.`);
