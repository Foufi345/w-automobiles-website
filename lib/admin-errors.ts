import { MAX_MODEL_YEAR } from "@/lib/validation/car";

/**
 * Translates a Zod validation key (`validation.*`), login error key (`login.errors.*`),
 * or server action error key (`serverErrors.*`) using the `admin` translator.
 * Falls back to the raw string for unexpected database/network error messages.
 */
export function resolveAdminError(
  t: (key: string, values?: Record<string, string | number>) => string,
  raw: string | null | undefined,
  params?: Record<string, string | number>
): string {
  if (!raw) return "";
  if (
    raw.startsWith("validation.") ||
    raw.startsWith("serverErrors.") ||
    raw.startsWith("login.errors.")
  ) {
    try {
      return t(raw, { maxYear: MAX_MODEL_YEAR, ...params });
    } catch {
      return raw;
    }
  }
  return raw;
}
