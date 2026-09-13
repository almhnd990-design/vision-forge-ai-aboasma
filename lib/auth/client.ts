import { z } from "zod";

/**
 * Authentication input rules and redirect safety.
 *
 * Kept in a pure module (no Supabase import) so the browser, the server and the tests all
 * validate identically, and so redirect safety can be unit-tested without a live project.
 */

export const emailSchema = z
  .string()
  .trim()
  .min(3, "Enter your email address.")
  .max(254)
  .email("Enter a valid email address.");

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(200, "Use at most 200 characters.");

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: z.string().trim().min(1, "Enter your name.").max(120),
  locale: z.enum(["en", "ar"]).default("en"),
  /** Explicit consent is recorded in user metadata; it is not pre-ticked. */
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: "You must accept the terms to create an account." }),
  }),
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password.").max(200),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;

/**
 * Only same-origin, absolute-path redirects are allowed.
 *
 * Blocks `//evil.com`, `https://evil.com`, backslash tricks and control characters that
 * some parsers treat as separators. Returns null when the value is not safe, and the
 * caller falls back to a known-good path.
 */
export function safeRedirectPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = value.trim();
  if (raw.length === 0 || raw.length > 512) return null;
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return null;
  if (raw.includes("\\")) return null;
  if (/[\u0000-\u001f\u007f]/.test(raw)) return null;
  // Reject encoded protocol-relative forms such as /%2F%2Fevil.com.
  if (/^\/%2f/i.test(raw)) return null;
  return raw;
}

/** Build a localized, already-safe redirect target. */
export function localePath(locale: "en" | "ar", path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `/${locale}${clean === "/" ? "" : clean}`;
}

/** Map a Supabase auth error into an operator-facing message we control. */
export function describeAuthError(
  message: string | undefined,
  locale: "en" | "ar",
): string {
  const text = (message ?? "").toLowerCase();
  const ar = locale === "ar";
  if (text.includes("invalid login credentials")) {
    return ar
      ? "البريد الإلكتروني أو كلمة المرور غير صحيحة."
      : "That email and password combination is not correct.";
  }
  if (text.includes("email not confirmed")) {
    return ar
      ? "لم يتم تأكيد بريدك الإلكتروني بعد. تحقق من صندوق الوارد."
      : "Your email address has not been confirmed yet. Check your inbox.";
  }
  if (text.includes("already registered") || text.includes("already been registered")) {
    return ar
      ? "يوجد حساب بهذا البريد بالفعل. جرّب تسجيل الدخول."
      : "An account already exists for that email. Try signing in.";
  }
  if (text.includes("rate limit") || text.includes("too many")) {
    return ar
      ? "محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة."
      : "Too many attempts. Wait a moment and try again.";
  }
  if (text.includes("password")) {
    return ar ? "كلمة المرور لا تحقق الشروط المطلوبة." : "The password does not meet the requirements.";
  }
  return ar
    ? "تعذّر إكمال العملية. أعد المحاولة."
    : "The request could not be completed. Please try again.";
}
