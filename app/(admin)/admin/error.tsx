"use client";

import { useTranslations } from "next-intl";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("admin");

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center justify-center px-4 py-20 text-center">
      <div className="w-full rounded-2xl border border-brand-red/50 bg-navy-900 p-8 space-y-4">
        <h1 className="font-serif text-2xl font-semibold text-ivory">
          {t("errorTitle")}
        </h1>
        <p className="text-sm text-silver">
          {error.message || t("errorFallback")}
        </p>
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-brand-red px-5 py-2.5 text-sm font-semibold text-ivory hover:opacity-95"
        >
          {t("retry")}
        </button>
      </div>
    </div>
  );
}
