import { AlertTriangle, PlugZap } from "lucide-react";
import type { Locale } from "@/lib/locale";

/**
 * Explicit configuration state.
 *
 * Used wherever a capability is unavailable because the deployment is missing
 * configuration. It always names the exact environment variables, because "something went
 * wrong" is not an acceptable message for an operator who can fix it.
 */
export function ConfigNotice({
  locale,
  title,
  body,
  missingEnv = [],
  tone = "config",
}: {
  locale: Locale;
  title: string;
  body: string;
  missingEnv?: string[];
  tone?: "config" | "error";
}) {
  const Icon = tone === "error" ? AlertTriangle : PlugZap;
  return (
    <div className="capability-notice" role="status">
      <Icon size={19} aria-hidden="true" />
      <div>
        <h3>{title}</h3>
        <p>{body}</p>
        {missingEnv.length > 0 && (
          <p>
            <strong>{locale === "ar" ? "الإعدادات المطلوبة" : "Required configuration"}:</strong>{" "}
            {missingEnv.map((name) => (
              <code key={name}>{name}</code>
            ))}
          </p>
        )}
      </div>
    </div>
  );
}
