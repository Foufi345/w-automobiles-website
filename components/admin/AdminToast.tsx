"use client";

import { useTranslations } from "next-intl";

export interface ToastItem {
  id: string;
  type: "success" | "error";
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface AdminToastHostProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export function AdminToastHost({ toasts, onDismiss }: AdminToastHostProps) {
  const t = useTranslations("admin.dashboard.toasts");
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] lg:bottom-[calc(1.25rem+env(safe-area-inset-bottom))] inset-x-4 sm:start-auto sm:end-4 z-50 flex flex-col gap-2.5 sm:w-full sm:max-w-sm pointer-events-none"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.type === "error" ? "alert" : "status"}
          className={`pointer-events-auto flex items-center justify-between gap-2.5 rounded-xl border px-4 py-3 text-sm shadow-xl ${
            toast.type === "error"
              ? "border-brand-red/70 bg-navy-950 text-ivory"
              : "border-emerald-500/50 bg-navy-950 text-ivory"
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              aria-hidden="true"
              className={`h-2 w-2 shrink-0 rounded-full ${
                toast.type === "error" ? "bg-brand-red" : "bg-emerald-400"
              }`}
            />
            <span className="leading-snug">{toast.message}</span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {toast.actionLabel && toast.onAction && (
              <button
                type="button"
                onClick={() => {
                  toast.onAction?.();
                  onDismiss(toast.id);
                }}
                className="inline-flex min-h-[36px] items-center rounded-lg border border-navy-700 bg-navy-900 px-3 text-xs font-semibold text-ivory hover:border-brand-red"
              >
                {toast.actionLabel}
              </button>
            )}

            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label={t("dismissNotification")}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-silver hover:bg-navy-800 hover:text-ivory"
            >
              &times;
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
