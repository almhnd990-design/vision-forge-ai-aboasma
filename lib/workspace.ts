import { z } from "zod";
import { analyzeSnapshot } from "./agent/analyze";
import type { AgentInsight, BusinessSnapshot } from "./agent/types";
import type { Dictionary, Locale } from "./i18n/dictionaries";
const money = z.number().int().nonnegative().max(100_000_000_000);
export const snapshotSchema = z.object({
  workspaceId: z.string().trim().min(1).max(80),
  revenueCents: money,
  previousRevenueCents: money,
  refundPendingCents: money,
  duplicateChargeCandidates: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(100),
        amountCents: money.refine((v) => v > 0),
        description: z.string().trim().min(1).max(300),
      }),
    )
    .max(50)
    .default([]),
  inventoryDays: z.number().nonnegative().max(10000).optional(),
  conversionRate: z.number().min(0).max(1).optional(),
  previousConversionRate: z.number().min(0).max(1).optional(),
});
export const workspaceSchema = z.object({
  snapshot: snapshotSchema,
  reviewed: z.array(z.string().max(100)).max(100),
  ranAt: z.string().datetime(),
  activity: z
    .array(
      z.object({
        id: z.string().max(100),
        type: z.enum(["analyzed", "reviewEvent", "reopened"]),
        at: z.string().datetime(),
      }),
    )
    .max(100),
});
export type Workspace = z.infer<typeof workspaceSchema>;
export type ActivityType = Workspace["activity"][number]["type"];
export const STORAGE_KEY = "ghostops.workspace.v1";

/**
 * Shared limits. These mirror the validation rules in this file and the server-side
 * schema, and are imported by the API layer so the browser and the server cannot drift.
 */
export const INSIGHT_LIMITS = {
  maxDuplicateCandidates: 50,
  maxImportBytes: 100 * 1024,
  maxEvidenceItems: 12,
} as const;

export function insightsFor(snapshot: BusinessSnapshot): AgentInsight[] {
  return analyzeSnapshot(snapshot).map((insight, index) => ({
    ...insight,
    id: `${insight.kind}-${index}`,
  }));
}
export function moneyFormat(cents: number, locale: Locale) {
  return new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-SA", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
export function displayInsight(
  insight: AgentInsight,
  snapshot: BusinessSnapshot,
  t: Dictionary["dash"],
  locale: Locale,
) {
  const currency = (value: number) => moneyFormat(value, locale);
  if (insight.kind === "growth")
    return {
      title: t.signalRevenue,
      summary: t.summaryRevenue,
      action: t.actionRevenue,
      evidence: [
        `${t.currentRevenue}: ${currency(snapshot.revenueCents)}`,
        `${t.previousRevenue}: ${currency(snapshot.previousRevenueCents)}`,
      ],
    };
  if (insight.kind === "operations")
    return {
      title: t.signalStock,
      summary: t.summaryStock,
      action: t.actionStock,
      evidence: [
        `${t.inventoryDays}: ${new Intl.NumberFormat(locale).format(snapshot.inventoryDays ?? 0)}`,
      ],
    };
  if (insight.requiresApproval)
    return {
      title: t.signalDuplicate,
      summary: insight.summary,
      action: t.actionDuplicate,
      evidence: [
        `${t.candidateAmount}: ${currency(insight.estimatedImpactCents ?? 0)}`,
        `${t.candidateRef}: ${insight.evidence[0]?.replace("Candidate reference: ", "")}`,
      ],
    };
  return {
    title: t.signalRefund,
    summary: t.summaryRefund,
    action: t.actionRefund,
    evidence: [`${t.pendingRefund}: ${currency(snapshot.refundPendingCents)}`],
  };
}
export function downloadJson(value: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
