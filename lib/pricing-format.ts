import type { Locale } from "./locale";

/**
 * Money formatting helpers for the commercial layer.
 *
 * Amounts are always integer halalas (1 SAR = 100 halalas). Nothing here does currency
 * conversion: if a provider reports another currency, the connector excludes it and says
 * so rather than converting at a guessed rate.
 */

export type PriceLabels = {
  perMonth: string;
  perYear: string;
  unlimited: string;
  none: string;
};

export function formatHalalas(
  amountHalalas: number,
  locale: Locale,
  options: { maximumFractionDigits?: number } = {},
): string {
  const value = amountHalalas / 100;
  return new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-SA", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits:
      options.maximumFractionDigits ?? (Number.isInteger(value) ? 0 : 2),
  }).format(value);
}

export function formatPlanPrice(
  amountHalalas: number,
  locale: Locale,
  labels: PriceLabels,
  interval: "month" | "year" = "month",
): string {
  const suffix = interval === "month" ? labels.perMonth : labels.perYear;
  return `${formatHalalas(amountHalalas, locale)}${suffix}`;
}

export function formatCount(value: number | null, locale: Locale, unlimited: string): string {
  if (value === null) return unlimited;
  return new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-SA").format(value);
}

export function formatDateTime(value: string | null, locale: Locale): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    calendar: "gregory",
  }).format(parsed);
}
