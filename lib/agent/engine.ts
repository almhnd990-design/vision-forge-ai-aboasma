import { analyzeSnapshot } from "./analyze";
import type { AgentInsight, BusinessSnapshot } from "./types";

/**
 * Server-side view of the deterministic engine.
 *
 * `lib/agent/analyze.ts` is the frozen, auditable rule engine and is intentionally not
 * modified. This wrapper adds the two things the server needs:
 *
 *  1. DETERMINISTIC identifiers. `analyzeSnapshot` mints a random UUID per insight,
 *     which is correct for a browser session but useless for persistence because the
 *     same snapshot would produce different ids on every run. Here an id is derived
 *     from the finding's kind and its position, so re-analysing identical input yields
 *     identical ids.
 *  2. A single import point, so the engine can be swapped or versioned later without
 *     touching every caller.
 */

export const ENGINE_NAME = "ghostops-deterministic";

/** Derive a stable id from the finding kind and order. */
export function stableInsightId(insight: AgentInsight, index: number): string {
  return `${insight.kind}-${index}`;
}

/** Run the deterministic engine and attach stable ids. Pure and side-effect free. */
export function runDeterministicEngine(snapshot: BusinessSnapshot): AgentInsight[] {
  return analyzeSnapshot(snapshot).map((insight, index) => ({
    ...insight,
    id: stableInsightId(insight, index),
  }));
}

/**
 * The engine is deterministic by contract: identical input must produce identical
 * findings. Exposed so a test can assert that property directly.
 */
export function engineSignature(insights: AgentInsight[]): string {
  return insights
    .map((i) => `${i.kind}:${i.severity}:${i.confidence}:${i.evidence.join("|")}`)
    .join(";");
}
