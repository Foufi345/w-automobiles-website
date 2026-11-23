"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useModalOverlay } from "@/hooks/useModalOverlay";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Mobile bottom-sheet / desktop centered confirmation dialog.
 * Uses shared iOS scroll-lock, focus trap, Esc, and Back-button dismissal.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  pending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const tAdmin = useTranslations("admin");
  const resolvedConfirm = confirmLabel ?? tAdmin("delete");
  const resolvedCancel = cancelLabel ?? tAdmin("cancel");
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  useModalOverlay({
    open,
    containerRef: contentRef,
    onClose: () => {
      if (!pending) onCancel();
    },
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault();
        if (!pending) onCancel();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current && !pending) {
          onCancel();
        }
      }}
      className="m-0 mt-auto w-full max-w-none rounded-t-2xl border-t border-navy-700 bg-navy-900 p-0 text-ivory shadow-2xl backdrop:bg-black/75 sm:m-auto sm:w-[calc(100%-2rem)] sm:max-w-md sm:rounded-2xl sm:border"
    >
      <div ref={contentRef} className="p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-6 space-y-4">
        {/* Bottom-sheet grabber pill on mobile */}
        <div
          aria-hidden="true"
          className="mx-auto mb-2 h-1 w-10 rounded-full bg-navy-700 sm:hidden"
        />

        <h2 className="font-serif text-xl font-semibold text-ivory">{title}</h2>
        <p className="text-sm leading-relaxed text-silver">{message}</p>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-2">
          <button
            type="button"
            disabled={pending}
            onClick={onCancel}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-navy-700 bg-navy-950 px-4 py-2.5 text-sm font-medium text-ivory hover:border-silver/50 disabled:opacity-50"
          >
            {resolvedCancel}
          </button>

          <button
            type="button"
            disabled={pending}
            onClick={onConfirm}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-brand-red px-5 py-2.5 text-sm font-semibold text-ivory hover:opacity-95 disabled:opacity-60"
          >
            {pending ? tAdmin("dashboard.deleteDialog.deleting") : resolvedConfirm}
          </button>
        </div>
      </div>
    </dialog>
  );
}
