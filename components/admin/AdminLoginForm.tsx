"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { loginAdminAction, type LoginActionState } from "@/lib/auth/actions";
import { resolveAdminError } from "@/lib/admin-errors";

interface AdminLoginFormProps {
  initialError?: string | null;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useTranslations("admin.login");

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-brand-red px-5 py-3 text-sm font-semibold text-ivory shadow-sm transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? t("submitting") : t("submit")}
    </button>
  );
}

export function AdminLoginForm({ initialError = null }: AdminLoginFormProps) {
  const tAdmin = useTranslations("admin");
  const t = useTranslations("admin.login");
  const initialState: LoginActionState = { error: initialError };
  const [state, formAction] = useFormState(loginAdminAction, initialState);

  const errorMessage = state.error
    ? resolveAdminError(tAdmin, state.error)
    : null;

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {errorMessage && (
        <div
          role="alert"
          className="rounded-xl border border-brand-red/60 bg-brand-red/15 px-4 py-3 text-sm text-ivory"
        >
          {errorMessage}
        </div>
      )}

      <div>
        <label
          htmlFor="admin-email"
          className="block text-xs font-semibold uppercase tracking-wider text-silver"
        >
          {t("emailLabel")}
        </label>
        <input
          id="admin-email"
          name="email"
          type="email"
          dir="ltr"
          autoComplete="email"
          required
          placeholder={t("emailPlaceholder")}
          className="mt-2 min-h-[48px] w-full rounded-xl border border-navy-700 bg-navy-950 px-4 py-3 text-base text-start text-ivory placeholder:text-silver/45 transition-colors focus:border-silver/70 focus:outline-none"
        />
      </div>

      <div>
        <label
          htmlFor="admin-password"
          className="block text-xs font-semibold uppercase tracking-wider text-silver"
        >
          {t("passwordLabel")}
        </label>
        <input
          id="admin-password"
          name="password"
          type="password"
          dir="ltr"
          autoComplete="current-password"
          required
          placeholder="••••••••••••"
          className="mt-2 min-h-[48px] w-full rounded-xl border border-navy-700 bg-navy-950 px-4 py-3 text-base text-start text-ivory placeholder:text-silver/45 transition-colors focus:border-silver/70 focus:outline-none"
        />
      </div>

      <SubmitButton />
    </form>
  );
}
