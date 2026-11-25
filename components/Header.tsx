"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { getLocalizedSiteConfig, getWhatsAppUrl, NAV_ITEMS } from "@/lib/config";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { gsap } from "@/lib/gsap";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useModalOverlay } from "@/hooks/useModalOverlay";
import { useTransitionState } from "@/lib/transition";
import { triggerHeroReplayFromHomeNav } from "@/lib/hero3d/session-state";

export function Header() {
  const locale = useLocale();
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const tWa = useTranslations("whatsapp");
  const config = getLocalizedSiteConfig(locale);
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const isLangMenuOpenRef = useRef(false);
  isLangMenuOpenRef.current = isLangMenuOpen;
  const reducedMotion = useReducedMotion();
  const { state: transitionPhase } = useTransitionState();
  const transitionPhaseRef = useRef(transitionPhase);
  transitionPhaseRef.current = transitionPhase;

  const lastScrollY = useRef(0);
  const hamburgerBtnRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const sheetRef = useRef<HTMLElement | null>(null);

  // Header scroll detection: frozen while cover/reveal is active, always visible at scrollY = 0
  useEffect(() => {
    const handleScroll = () => {
      // Freeze header hide/show while route transition or language dropdown is active
      if (transitionPhaseRef.current !== "idle" || isLangMenuOpenRef.current) {
        setIsHeaderVisible(true);
        return;
      }

      const currentY = window.scrollY;
      setIsScrolled(currentY > 12);

      if (currentY <= 12) {
        setIsHeaderVisible(true);
      } else if (currentY > 90) {
        if (currentY > lastScrollY.current + 6) {
          setIsHeaderVisible(false);
        } else if (currentY < lastScrollY.current - 6) {
          setIsHeaderVisible(true);
        }
      } else {
        setIsHeaderVisible(true);
      }

      lastScrollY.current = currentY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Reset header to visible on route change and whenever transition settles at top
  useEffect(() => {
    const y = typeof window !== "undefined" ? window.scrollY : 0;
    lastScrollY.current = y;
    setIsScrolled(y > 12);
    if (
      transitionPhase === "waiting" ||
      transitionPhase === "revealing" ||
      y <= 90
    ) {
      setIsHeaderVisible(true);
    }
  }, [pathname, transitionPhase]);

  const openDrawer = () => {
    const drawer = dialogRef.current;
    const sheet = sheetRef.current;
    if (!drawer || !sheet) return;

    if (!drawer.open) {
      drawer.showModal();
    }
    setIsOpen(true);

    if (reducedMotion) return;

    const rect = hamburgerBtnRef.current?.getBoundingClientRect();
    const fallbackX =
      document.documentElement.dir === "rtl" ? 36 : window.innerWidth - 36;
    const ox = rect ? rect.left + rect.width / 2 : fallbackX;
    const oy = rect ? rect.top + rect.height / 2 : 40;

    const tl = gsap.timeline();
    // Background clip-path expanding from hamburger button position
    tl.fromTo(
      sheet,
      { clipPath: `circle(0px at ${ox}px ${oy}px)` },
      {
        clipPath: `circle(150% at ${ox}px ${oy}px)`,
        duration: 0.55,
        ease: "power3.out",
      }
    );

    // Links stagger in from the bottom
    const items = sheet.querySelectorAll(".mobile-nav-item");
    if (items.length > 0) {
      tl.fromTo(
        items,
        { y: 35, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.055,
          duration: 0.45,
          ease: "power3.out",
        },
        "-=0.35"
      );
    }
  };

  const closeDrawer = () => {
    const drawer = dialogRef.current;
    const sheet = sheetRef.current;
    if (!drawer || !sheet || !drawer.open) return;

    if (reducedMotion) {
      drawer.close();
      setIsOpen(false);
      return;
    }

    const rect = hamburgerBtnRef.current?.getBoundingClientRect();
    const fallbackX =
      document.documentElement.dir === "rtl" ? 36 : window.innerWidth - 36;
    const ox = rect ? rect.left + rect.width / 2 : fallbackX;
    const oy = rect ? rect.top + rect.height / 2 : 40;

    gsap.to(sheet, {
      clipPath: `circle(0px at ${ox}px ${oy}px)`,
      duration: 0.38,
      ease: "power3.in",
      onComplete: () => {
        drawer.close();
        setIsOpen(false);
        gsap.set(sheet, { clearProps: "clipPath" });
      },
    });
  };

  // Shared iOS scroll-lock, focus trap, Esc & Back-button dismissal for mobile drawer
  useModalOverlay({
    open: isOpen,
    containerRef: sheetRef,
    onClose: closeDrawer,
  });

  // Close drawer when route changes
  useEffect(() => {
    const drawer = dialogRef.current;
    if (drawer?.open) {
      drawer.close();
      setIsOpen(false);
    }
  }, [pathname]);

  const isLinkActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const handleNavbarHomeClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey
    ) {
      return;
    }
    if (pathname === "/") {
      const lenis = (
        window as unknown as {
          __lenis?: {
            scrollTo?: (
              y: number,
              opts?: { immediate?: boolean; force?: boolean }
            ) => void;
          };
        }
      ).__lenis;
      lenis?.scrollTo?.(0, { immediate: true, force: true });
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
    triggerHeroReplayFromHomeNav();
  };

  return (
    <>
      <header
        className={`sticky top-0 z-40 w-full safe-pt transition-all duration-300 ${isHeaderVisible ? "translate-y-0" : "-translate-y-full"
          } ${isScrolled
            ? "bg-navy-950/90 backdrop-blur-md border-b border-navy-700/80 shadow-sm"
            : pathname === "/"
              ? "bg-transparent border-b border-transparent"
              : "bg-navy-950 border-b border-navy-700/40"
          }`}
      >
        <div className="container-site flex h-16 lg:h-20 items-center justify-between gap-3">
          {/* Left: Text Logo + Subtitle (tagline hidden below 380px) */}
          <Link
            href="/"
            onClick={handleNavbarHomeClick}
            className="group inline-flex min-w-0 flex-col justify-center py-1 min-h-[44px]"
          >
            <span
              dir="ltr"
              className="wordmark text-base min-[380px]:text-lg sm:text-xl font-semibold text-ivory transition-colors group-hover:text-ivory/90 truncate"
            >
              {config.name}
            </span>
            <span className="hidden min-[380px]:block mt-0.5 text-[11px] sm:text-xs tracking-wide text-silver truncate">
              {tCommon("subtitleShort")}
            </span>
          </Link>

          {/* Center: Desktop Navigation with Left-to-Right Draw & Exit Underline */}
          <nav
            aria-label={tNav("mainNavLabel")}
            className="hidden lg:flex items-center gap-7 xl:gap-9"
          >
            {NAV_ITEMS.map((item) => {
              const active = isLinkActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={
                    item.href === "/" ? handleNavbarHomeClick : undefined
                  }
                  aria-current={active ? "page" : undefined}
                  className={`nav-link-underline whitespace-nowrap inline-flex items-center min-h-[44px] py-2 text-sm font-medium tracking-wide transition-colors ${active ? "active-link text-ivory" : "text-silver hover:text-ivory"
                    }`}
                >
                  {tNav(item.key)}
                </Link>
              );
            })}
          </nav>

          {/* Right (Desktop): Language Switcher + "Nous contacter" CTA Button */}
          <div className="hidden lg:flex items-center gap-3">
            <LanguageSwitcher
              variant="desktop"
              onOpenChange={setIsLangMenuOpen}
            />
            <Link
              href="/contact"
              className="btn-wipe whitespace-nowrap inline-flex min-h-[44px] items-center justify-center rounded-xl border border-brand-red bg-navy-950 px-5 py-2.5 text-sm font-medium text-ivory shadow-sm transition-all duration-200"
            >
              {tNav("contactUs")}
            </Link>
          </div>

          {/* Right (Mobile & Tablet): Compact 44px Globe Switcher + 44px Hamburger */}
          <div className="lg:hidden flex items-center gap-2 shrink-0">
            <div data-lang-slot className="flex items-center">
              <LanguageSwitcher
                variant="mobile-header"
                onOpenChange={setIsLangMenuOpen}
              />
            </div>
            <button
              ref={hamburgerBtnRef}
              type="button"
              onClick={openDrawer}
              aria-label={tNav("openMenu")}
              aria-expanded={isOpen}
              aria-controls="mobile-navigation-drawer"
              className="inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-navy-700 bg-navy-900 text-ivory transition-colors hover:border-silver/40"
            >
              <svg
                aria-hidden="true"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.75}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Full-Screen Navigation Drawer (<dialog>) */}
      <dialog
        ref={dialogRef}
        id="mobile-navigation-drawer"
        aria-label={tNav("menuLabel")}
        className="fixed inset-0 m-0 h-full max-h-none w-full max-w-none bg-navy-950/95 p-0 text-ivory backdrop:bg-navy-950/90 lg:hidden"
        onClick={(e) => {
          if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
            closeDrawer();
          }
        }}
        onCancel={(e) => {
          if (e.cancelable) {
            e.preventDefault();
            closeDrawer();
          }
        }}
      >
        <nav
          ref={sheetRef}
          aria-label={tNav("mobileMenuLabel")}
          className="flex h-full w-full flex-col justify-between bg-navy-950 text-ivory px-6 py-6 safe-pt safe-pb overflow-y-auto overscroll-contain"
        >
          {/* Top bar inside mobile drawer */}
          <div className="mobile-nav-item flex items-center justify-between border-b border-navy-700/70 pb-5">
            <div className="flex flex-col">
              <span
                dir="ltr"
                className="wordmark text-lg font-semibold text-ivory"
              >
                {config.name}
              </span>
              <span className="mt-0.5 text-xs text-silver">
                {tCommon("subtitleShort")}
              </span>
            </div>

            <button
              type="button"
              onClick={closeDrawer}
              aria-label={tNav("closeMenu")}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-navy-700 bg-navy-900 text-ivory transition-colors hover:border-silver/40"
            >
              <svg
                aria-hidden="true"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.75}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Large navigation links with stagger */}
          <ul className="my-auto flex flex-col gap-3 py-8">
            {NAV_ITEMS.map((item) => {
              const active = isLinkActive(item.href);
              return (
                <li key={item.href} className="mobile-nav-item">
                  <Link
                    href={item.href}
                    onClick={(e) => {
                      if (item.href === "/") {
                        handleNavbarHomeClick(e);
                      }
                      closeDrawer();
                    }}
                    aria-current={active ? "page" : undefined}
                    className={`group flex min-h-[52px] items-center justify-between rounded-xl px-3 py-3 font-serif text-2xl sm:text-3xl transition-colors ${active
                      ? "text-ivory font-semibold"
                      : "text-silver hover:text-ivory"
                      }`}
                  >
                    <span className="relative">
                      {tNav(item.key)}
                      {active && (
                        <span
                          aria-hidden="true"
                          className="absolute -bottom-1.5 start-0 h-[2px] w-10 bg-brand-red"
                        />
                      )}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`text-base transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1 ${active ? "text-brand-red" : "text-navy-700"
                        }`}
                    >
                      &rarr;
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Bottom Language Segmented Control + WhatsApp + Call CTAs pinned above safe area */}
          <div className="mobile-nav-item border-t border-navy-700/70 pt-5 space-y-4 shrink-0">
            <LanguageSwitcher
              variant="mobile-menu"
              onSelectLocale={closeDrawer}
            />

            <div className="text-xs text-silver space-y-1">
              <p className="text-ivory font-medium">{config.address.full}</p>
              <p>{config.hours.full}</p>
            </div>

            <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-2.5">
              <a
                href={getWhatsAppUrl(tWa("genericMessage"))}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-whatsapp-green px-4 py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95"
              >
                <WhatsAppIcon className="h-5 w-5 shrink-0 fill-current text-white" />
                <span>{tCommon("whatsapp")}</span>
              </a>

              <a
                href={`tel:${config.contact.phone.replace(/[^0-9+]/g, "")}`}
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-navy-700 bg-navy-900 px-4 py-3 text-sm font-semibold text-ivory transition-colors hover:border-silver/50"
              >
                <span>{tCommon("call")}</span>
              </a>
            </div>
          </div>
        </nav>
      </dialog>
    </>
  );
}
