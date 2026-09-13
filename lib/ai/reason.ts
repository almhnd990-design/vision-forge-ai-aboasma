/**
 * AI reasoning layer.
 *
 * NON-NEGOTIABLE RULES
 * 1. The deterministic engine is the source of truth. This layer only reads the
 *    findings it produced and may never add, change or invent a number, a charge,
 *    a refund, a revenue figure or a provider record.
 * 2. When no provider key is configured, this module returns `available: false`
 *    with the reason. It never fabricates AI output.
 * 3. Model output is re-validated against a strict schema before it is stored, and
 *    every claimed id must reference a real deterministic finding.
 */

import type { AgentInsight } from "@/lib/agent/types";
import type { BusinessSnapshot } from "@/lib/agent/types";

export type AiProviderKey = "openai" | "deepseek";

export type AiReasoning = {
  findingId: string;
  priorityRank: number;
  explanation: string;
  nextSteps: string[];
  missingInformation: string[];
};

export type AiResult =
  | {
      available: false;
      /** Verbatim operator-facing explanation of why reasoning did not run. */
      reason: string;
      requiredEnv: string[];
    }
  | {
      available: true;
      provider: AiProviderKey;
      model: string;
      summary: string;
      reasoning: AiReasoning[];
    };

export type AiProvider = {
  key: AiProviderKey;
  envKey: string;
  defaultModel: string;
  baseUrl: string;
  /** OpenAI-compatible chat completions contract; DeepSeek follows the same shape. */
  headers: (apiKey: string) => Record<string, string>;
};

export const AI_PROVIDERS: Record<AiProviderKey, AiProvider> = {
  openai: {
    key: "openai",
    envKey: "OPENAI_API_KEY",
    defaultModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    baseUrl: "https://api.openai.com/v1/chat/completions",
    headers: (apiKey) => ({
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    }),
  },
  deepseek: {
    key: "deepseek",
    envKey: "DEEPSEEK_API_KEY",
    defaultModel: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
    baseUrl: "https://api.deepseek.com/chat/completions",
    headers: (apiKey) => ({
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    }),
  },
};

/** Resolve the first configured provider. OpenAI wins when both exist, unless forced. */
export function resolveProvider(
  preferred?: AiProviderKey,
): { provider: AiProvider; apiKey: string } | null {
  const order: AiProviderKey[] = preferred
    ? [preferred, ...(Object.keys(AI_PROVIDERS) as AiProviderKey[]).filter((k) => k !== preferred)]
    : ["openai", "deepseek"];
  for (const key of order) {
    const provider = AI_PROVIDERS[key];
    const apiKey = (process.env[provider.envKey] ?? "").trim();
    if (apiKey) return { provider, apiKey };
  }
  return null;
}

export const AI_UNAVAILABLE: AiResult = {
  available: false,
  reason:
    "Advanced AI reasoning is unavailable because no provider key is configured for this deployment. Deterministic analysis is unaffected.",
  requiredEnv: ["OPENAI_API_KEY or DEEPSEEK_API_KEY"],
};

const SYSTEM_PROMPT = `You are the reasoning layer of GhostOps AI, a business operations agent for ecommerce operators.

You will receive a deterministic, already-computed list of findings. That list is the ONLY source of truth.

ABSOLUTE RULES:
1. Never invent transactions, charges, refunds, revenue, inventory figures, customer names or provider data.
2. Never state or imply that any action was executed, sent, refunded, cancelled or synced. You only advise.
3. Only use numbers that appear verbatim in the supplied evidence. Do not compute new totals.
4. If evidence is insufficient to support a conclusion, put that limitation in missingInformation instead of guessing.
5. Address the operator directly and concretely. No generic AI marketing language, no filler.
6. Write in the requested language. Keep titles short.

Return ONLY valid JSON matching this shape:
{
  "summary": string,
  "reasoning": [
    {
      "findingId": string,
      "priorityRank": number,
      "explanation": string,
      "nextSteps": string[],
      "missingInformation": string[]
    }
  ]
}

priorityRank starts at 1 for the finding an operator should look at first. Include exactly one entry per supplied findingId and no others.`;

export function buildUserPrompt(input: {
  locale: "en" | "ar";
  snapshot: BusinessSnapshot;
  findings: AgentInsight[];
}): string {
  const language = input.locale === "ar" ? "Arabic" : "English";
  return JSON.stringify(
    {
      instruction: `Write your response in ${language}.`,
      businessSnapshot: {
        workspaceId: input.snapshot.workspaceId,
        revenueCents: input.snapshot.revenueCents,
        previousRevenueCents: input.snapshot.previousRevenueCents,
        refundPendingCents: input.snapshot.refundPendingCents,
        inventoryDays: input.snapshot.inventoryDays ?? null,
        duplicateChargeCandidateCount:
          input.snapshot.duplicateChargeCandidates.length,
      },
      deterministicFindings: input.findings.map((f) => ({
        findingId: f.id,
        kind: f.kind,
        severity: f.severity,
        confidence: f.confidence,
        title: f.title,
        summary: f.summary,
        evidence: f.evidence,
        recommendedAction: f.recommendedAction,
        requiresApproval: f.requiresApproval,
        estimatedImpactCents: f.estimatedImpactCents ?? null,
      })),
    },
    null,
    2,
  );
}

/**
 * Strict post-validation of model output.
 * Anything that does not reference a real finding is dropped rather than stored.
 */
export function validateAiOutput(
  raw: unknown,
  findings: AgentInsight[],
): { summary: string; reasoning: AiReasoning[] } | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const summary = typeof obj.summary === "string" ? obj.summary.trim() : "";
  const list = Array.isArray(obj.reasoning) ? obj.reasoning : [];
  const known = new Set(findings.map((f) => f.id));
  const seen = new Set<string>();
  const reasoning: AiReasoning[] = [];

  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    const findingId = typeof entry.findingId === "string" ? entry.findingId : "";
    if (!known.has(findingId) || seen.has(findingId)) continue;
    seen.add(findingId);
    const rank = Number(entry.priorityRank);
    reasoning.push({
      findingId,
      priorityRank: Number.isFinite(rank) && rank >= 1 ? Math.floor(rank) : reasoning.length + 1,
      explanation:
        typeof entry.explanation === "string" ? entry.explanation.trim() : "",
      nextSteps: toStringArray(entry.nextSteps),
      missingInformation: toStringArray(entry.missingInformation),
    });
  }

  if (!summary && reasoning.length === 0) return null;
  return { summary, reasoning };
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, 12);
}

/**
 * Run reasoning for a set of deterministic findings.
 * Never throws: a provider failure degrades to an explicit unavailable result.
 */
export async function reasonAboutFindings(input: {
  locale: "en" | "ar";
  snapshot: BusinessSnapshot;
  findings: AgentInsight[];
  preferredProvider?: AiProviderKey;
  timeoutMs?: number;
}): Promise<AiResult> {
  if (input.findings.length === 0) {
    return {
      available: false,
      reason:
        "No deterministic findings were produced, so there is nothing to reason about.",
      requiredEnv: [],
    };
  }

  const resolved = resolveProvider(input.preferredProvider);
  if (!resolved) return AI_UNAVAILABLE;

  const { provider, apiKey } = resolved;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? 30_000);

  try {
    const response = await fetch(provider.baseUrl, {
      method: "POST",
      headers: provider.headers(apiKey),
      signal: controller.signal,
      body: JSON.stringify({
        model: provider.defaultModel,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: buildUserPrompt({
              locale: input.locale,
              snapshot: input.snapshot,
              findings: input.findings,
            }),
          },
        ],
      }),
    });

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300);
      return {
        available: false,
        reason: `The configured AI provider (${provider.key}) rejected the request with HTTP ${response.status}. Deterministic analysis is unaffected.`,
        requiredEnv: [],
        ...(detail ? {} : {}),
      };
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
    };
    const content = payload.choices?.[0]?.message?.content ?? "";
    const parsed = safeJson(content);
    const validated = validateAiOutput(parsed, input.findings);
    if (!validated) {
      return {
        available: false,
        reason:
          "The AI provider returned a response that failed validation, so no reasoning was applied. Deterministic analysis is unaffected.",
        requiredEnv: [],
      };
    }

    return {
      available: true,
      provider: provider.key,
      model: payload.model ?? provider.defaultModel,
      summary: validated.summary,
      reasoning: validated.reasoning,
    };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return {
      available: false,
      reason: aborted
        ? "The AI provider did not respond in time, so no reasoning was applied. Deterministic analysis is unaffected."
        : "The AI provider could not be reached, so no reasoning was applied. Deterministic analysis is unaffected.",
      requiredEnv: [],
    };
  } finally {
    clearTimeout(timeout);
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}
