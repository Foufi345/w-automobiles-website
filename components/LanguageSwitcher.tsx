"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { useModalOverlay } from "@/hooks/useModalOverlay";

interface LocaleOption {
  code: AppLocale;
  shortLabel: string;
  nativeLabel: string;
  dir: "ltr" | "rtl";
}

const LOCALE_OPTIONS: readonly LocaleOption[] = [
  { code: "fr", shortLabel: "FR", nativeLabel: "Français", dir: "ltr" },
  { code: "en", shortLabel: "EN", nativeLabel: "English", dir: "ltr" },
  { code: "ar", shortLabel: "ع", nativeLabel: "العربية", dir: "rtl" },
] as const;

const SCROLL_STORAGE_KEY = "__w_locale_switch_scroll";

function setLocaleCookie(locale: AppLocale) {
  if (typeof document === "undefined") return;
  document.cookie = `NEXT_LOCALE=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

function saveScrollForLocaleSwitch() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      SCROLL_STORAGE_KEY,
      JSON.stringify({ y: window.scrollY, ts: Date.now() })
    );
  } catch {
    // Ignore storage errors
  }
}

function GlobeIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.75}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418"
      />
    </svg>
  );
}

interface LanguageSwitcherProps {
  variant: "desktop" | "mobile-header" | "mobile-menu" | "footer";
  onOpenChange?: (open: boolean) => void;
  onSelectLocale?: () => void;
}

export function LanguageSwitcher({
  variant,
  onOpenChange,
  onSelectLocale,
}: LanguageSwitcherProps) {
  const locale = useLocale() as AppLocale;
  const tCommon = useTranslations("common");
  const pathname = usePathname();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [searchAndHash, setSearchAndHash] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  const currentOption =
    LOCALE_OPTIONS.find((opt) => opt.code === locale) ?? LOCALE_OPTIONS[0];

  const syncLocationSuffix = useCallback(() => {
    if (typeof window === "undefined") return;
    setSearchAndHash(`${window.location.search}${window.location.hash}`);
  }, []);

  useEffect(() => {
    syncLocationSuffix();
    window.addEventListener("popstate", syncLocationSuffix);
    window.addEventListener("hashchange", syncLocationSuffix);
    return () => {
      window.removeEventListener("popstate", syncLocationSuffix);
      window.removeEventListener("hashchange", syncLocationSuffix);
    };
  }, [pathname, syncLocationSuffix]);

  // Restore scroll position cleanly after a same-page locale switch
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = sessionStorage.getItem(SCROLL_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { y?: number; ts?: number };
      sessionStorage.removeItem(SCROLL_STORAGE_KEY);
      if (
        typeof parsed.y === "number" &&
        typeof parsed.ts === "number" &&
        Date.now() - parsed.ts < 3000
      ) {
        const y = parsed.y;
        requestAnimationFrame(() => {
          window.scrollTo({ top: y, left: 0, behavior: "instant" });
        });
      }
    } catch {
      // Ignore
    }
  }, [locale]);

  const setOpenState = useCallback(
    (next: boolean) => {
      if (next) syncLocationSuffix();
      setOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange, syncLocationSuffix]
  );

  // Close desktop dropdown on outside click or Escape
  useEffect(() => {
    if (!open || variant !== "desktop") return;

    const handlePointerDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpenState(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpenState(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, variant, setOpenState]);

  // Mobile bottom-sheet overlay management (scroll lock, focus trap, Esc, Back)
  useModalOverlay({
    open: open && variant === "mobile-header",
    containerRef: sheetRef,
    onClose: () => {
      setOpenState(false);
      triggerRef.current?.focus();
    },
  });

  // Focus first/current item when dropdown opens via keyboard
  useEffect(() => {
    if (!open || variant !== "desktop") return;
    const activeIdx = LOCALE_OPTIONS.findIndex((o) => o.code === locale);
    const target = itemRefs.current[activeIdx >= 0 ? activeIdx : 0];
    requestAnimationFrame(() => target?.focus());
  }, [open, variant, locale]);

  const handleMenuKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      itemRefs.current[(idx + 1) % LOCALE_OPTIONS.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      itemRefs.current[
        (idx - 1 + LOCALE_OPTIONS.length) % LOCALE_OPTIONS.length
      ]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      itemRefs.current[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      itemRefs.current[LOCALE_OPTIONS.length - 1]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpenState(false);
      triggerRef.current?.focus();
    }
  };

  const buildHref = () => {
    const suffix =
      typeof window !== "undefined"
        ? `${window.location.search}${window.location.hash}`
        : searchAndHash;
    return `${pathname}${suffix}`;
  };

  const handleLocaleClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    targetLocale: AppLocale
  ) => {
    // Allow modifier clicks (open in new tab) to behave natively
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }
    e.preventDefault();
    setLocaleCookie(targetLocale);
    setOpenState(false);
    onSelectLocale?.();

    if (targetLocale === locale) {
      return;
    }

    saveScrollForLocaleSwitch();
    const dest = buildHref();
    router.replace(dest, { locale: targetLocale, scroll: false });
  };

  const linkHref = `${pathname}${searchAndHash}`;

  // 1. DESKTOP HEADER DROPDOWN
  if (variant === "desktop") {
    return (
      <div ref={containerRef} className="relative">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpenState(!open)}
          aria-label={tCommon("languageSwitcher")}
          aria-haspopup="menu"
          aria-expanded={open}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-navy-700 bg-navy-900/80 px-3 py-2 text-xs font-semibold text-ivory transition-colors hover:border-silver/50"
        >
          <GlobeIcon className="h-4 w-4 shrink-0 text-silver" />
          <span>{currentOption.shortLabel}</span>
          <svg
            aria-hidden="true"
            className={`h-3.5 w-3.5 text-silver transition-transform duration-150 ${
              open ? "rotate-180" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m19.5 8.25-7.5 7.5-7.5-7.5"
            />
          </svg>
        </button>

        {open && (
          <div
            role="menu"
            aria-label={tCommon("selectLanguage")}
            className="absolute end-0 top-full mt-2 z-50 w-44 max-w-[calc(100vw-2rem)] rounded-xl border border-navy-700 bg-navy-900 p-1.5 shadow-2xl"
          >
            {LOCALE_OPTIONS.map((opt, idx) => {
              const isCurrent = opt.code === locale;
              return (
                <Link
                  key={opt.code}
                  ref={(el) => {
                    itemRefs.current[idx] = el;
                  }}
                  href={linkHref}
                  locale={opt.code}
                  hrefLang={opt.code}
                  lang={opt.code}
                  dir={opt.dir}
                  scroll={false}
                  role="menuitem"
                  data-locale-switch="true"
                  aria-current={isCurrent ? "true" : undefined}
                  onClick={(e) => handleLocaleClick(e, opt.code)}
                  onKeyDown={(e) => handleMenuKeyDown(e, idx)}
                  className={`flex min-h-[44px] w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                    isCurrent
                      ? "bg-brand-red/15 font-semibold text-ivory"
                      : "text-silver hover:bg-navy-950/70 hover:text-ivory"
                  }`}
                >
                  <span>{opt.nativeLabel}</span>
                  <span className="text-[11px] font-semibold text-silver/80">
                    {opt.shortLabel}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // 2. MOBILE HEADER COMPACT 44px GLOBE BUTTON + BOTTOM SHEET
  if (variant === "mobile-header") {
    return (
      <>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpenState(true)}
          aria-label={tCommon("languageSwitcher")}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="inline-flex h-11 min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-xl border border-navy-700 bg-navy-900 px-2 text-xs font-semibold text-ivory transition-colors hover:border-silver/40"
        >
          <GlobeIcon className="h-4 w-4 shrink-0 text-silver" />
          <span>{currentOption.shortLabel}</span>
        </button>

        {open && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={tCommon("selectLanguage")}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm lg:hidden"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setOpenState(false);
                triggerRef.current?.focus();
              }
            }}
          >
            <div
              ref={sheetRef}
              className="w-full max-w-md rounded-t-2xl border-t border-navy-700 bg-navy-900 px-5 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl space-y-4"
            >
              <div className="mx-auto h-1.5 w-12 rounded-full bg-navy-700" />
              <div className="flex items-center justify-between gap-3">
                <p className="font-serif text-lg font-semibold text-ivory">
                  {tCommon("selectLanguage")}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setOpenState(false);
                    triggerRef.current?.focus();
                  }}
                  aria-label={tCommon("close")}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-navy-700 bg-navy-950 text-lg text-silver hover:text-ivory"
                >
                  &times;
                </button>
              </div>

              <div className="space-y-2">
                {LOCALE_OPTIONS.map((opt) => {
                  const isCurrent = opt.code === locale;
                  return (
                    <Link
                      key={opt.code}
                      href={linkHref}
                      locale={opt.code}
                      hrefLang={opt.code}
                      lang={opt.code}
                      dir={opt.dir}
                      scroll={false}
                      data-locale-switch="true"
                      aria-current={isCurrent ? "true" : undefined}
                      onClick={(e) => handleLocaleClick(e, opt.code)}
                      className={`flex min-h-[48px] w-full items-center justify-between rounded-xl border px-4 py-3 text-base transition-colors ${
                        isCurrent
                          ? "border-brand-red bg-brand-red/15 font-semibold text-ivory"
                          : "border-navy-700 bg-navy-950/60 text-silver hover:border-silver/40 hover:text-ivory"
                      }`}
                    >
                      <span>{opt.nativeLabel}</span>
                      <span className="text-xs font-semibold text-silver">
                        {opt.shortLabel}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // 3. MOBILE FULL-SCREEN MENU SEGMENTED CONTROL
  if (variant === "mobile-menu") {
    return (
      <div
        role="group"
        aria-label={tCommon("selectLanguage")}
        className="grid grid-cols-3 gap-2 rounded-xl border border-navy-700 bg-navy-900 p-1.5"
      >
        {LOCALE_OPTIONS.map((opt) => {
          const isCurrent = opt.code === locale;
          return (
            <Link
              key={opt.code}
              href={linkHref}
              locale={opt.code}
              hrefLang={opt.code}
              lang={opt.code}
              dir={opt.dir}
              scroll={false}
              data-locale-switch="true"
              aria-current={isCurrent ? "true" : undefined}
              onClick={(e) => handleLocaleClick(e, opt.code)}
              className={`flex min-h-[48px] items-center justify-center rounded-lg px-2 py-2.5 text-sm font-medium transition-colors ${
                isCurrent
                  ? "bg-brand-red font-semibold text-ivory shadow-sm"
                  : "text-silver hover:bg-navy-950/60 hover:text-ivory"
              }`}
            >
              {opt.nativeLabel}
            </Link>
          );
        })}
      </div>
    );
  }

  // 4. FOOTER SIMPLE TEXT-LINK VERSION
  return (
    <nav
      aria-label={tCommon("selectLanguage")}
      className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
    >
      {LOCALE_OPTIONS.map((opt, idx) => {
        const isCurrent = opt.code === locale;
        return (
          <span key={opt.code} className="inline-flex items-center gap-3">
            {idx > 0 && (
              <span aria-hidden="true" className="text-navy-700">
                &middot;
              </span>
            )}
            <Link
              href={linkHref}
              locale={opt.code}
              hrefLang={opt.code}
              lang={opt.code}
              dir={opt.dir}
              scroll={false}
              data-locale-switch="true"
              aria-current={isCurrent ? "true" : undefined}
              onClick={(e) => handleLocaleClick(e, opt.code)}
              className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center px-1.5 underline-offset-4 transition-colors ${
                isCurrent
                  ? "font-semibold text-ivory underline decoration-brand-red"
                  : "text-silver hover:text-ivory hover:underline"
              }`}
            >
              {opt.nativeLabel}
            </Link>
          </span>
        );
      })}
    </nav>
  );
}
