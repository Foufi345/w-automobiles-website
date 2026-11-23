"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type {
  BodyType,
  Car,
  CarCondition,
  CarFilterOptions,
  FuelType,
  TransmissionType,
} from "@/lib/car-types";
import { CarCard } from "@/components/CarCard";
import { matchesVehicleSearch } from "@/lib/brands";
import { getWhatsAppUrl, siteConfig } from "@/lib/config";
import { formatCurrencyDZD, formatMileageLocalized } from "@/lib/format";
import {
  BODY_TYPE_LABEL_KEY,
  BODY_TYPE_TO_SLUG,
  CONDITION_LABEL_KEY,
  CONDITION_TO_SLUG,
  FUEL_LABEL_KEY,
  FUEL_TO_SLUG,
  resolveBodyTypeFromParam,
  resolveConditionFromParam,
  resolveFuelFromParam,
  resolveTransmissionFromParam,
  TRANSMISSION_LABEL_KEY,
  TRANSMISSION_TO_SLUG,
} from "@/lib/labels";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { gsap, Flip, ScrollTrigger } from "@/lib/gsap";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useTransitionState } from "@/lib/transition";
import {
  lockBodyScroll as sharedLockBodyScroll,
  unlockBodyScroll as sharedUnlockBodyScroll,
} from "@/lib/mobile/scrollLock";

interface VehiclesCatalogProps {
  cars: Car[];
  filterOptions: CarFilterOptions;
}

type SortOption = "recent" | "price-asc" | "price-desc" | "mileage-asc";

interface FilterState {
  q: string;
  marques: string[];
  carburant: string;
  boite: string;
  carrosserie: string;
  etat: string;
  anneeMin: string;
  anneeMax: string;
  budgetMin: number;
  budgetMax: number;
  kmMax: string;
  tri: SortOption;
}

const PRICE_MIN_BOUND = 0;
const PRICE_MAX_BOUND = 30000000;
const PRICE_STEP = 500000;

const KM_MAX_VALUES = [
  "",
  "0",
  "5000",
  "15000",
  "30000",
  "50000",
  "100000",
] as const;

const SORT_VALUES: { key: "recent" | "priceAsc" | "priceDesc" | "mileageAsc"; value: SortOption }[] = [
  { key: "recent", value: "recent" },
  { key: "priceAsc", value: "price-asc" },
  { key: "priceDesc", value: "price-desc" },
  { key: "mileageAsc", value: "mileage-asc" },
];

const INITIAL_PAGE_SIZE = 12;
const PAGE_INCREMENT = 12;

function parseFiltersFromSearchParams(
  searchParams: { get: (k: string) => string | null; getAll: (k: string) => string[] }
): FilterState {
  const q = searchParams.get("q") ?? "";

  // Support both language-neutral ?brand= and legacy French ?marque=
  const rawMarques = [
    ...searchParams.getAll("brand"),
    ...searchParams.getAll("marque"),
  ];
  const marques = Array.from(
    new Set(
      rawMarques
        .flatMap((m) => m.split(","))
        .map((m) => m.trim())
        .filter(Boolean)
    )
  );

  // Support language-neutral keys (fuel, transmission, body, condition) + legacy French keys
  const carburant = resolveFuelFromParam(
    searchParams.get("fuel") ?? searchParams.get("carburant")
  );
  const boite = resolveTransmissionFromParam(
    searchParams.get("transmission") ?? searchParams.get("boite")
  );
  const carrosserie = resolveBodyTypeFromParam(
    searchParams.get("body") ?? searchParams.get("carrosserie")
  );
  const etat = resolveConditionFromParam(
    searchParams.get("condition") ?? searchParams.get("etat")
  );
  const anneeMin =
    searchParams.get("yearMin") ?? searchParams.get("anneeMin") ?? "";
  const anneeMax =
    searchParams.get("yearMax") ?? searchParams.get("anneeMax") ?? "";

  const rawMin = Number(searchParams.get("budgetMin"));
  const budgetMin =
    !Number.isNaN(rawMin) && rawMin >= PRICE_MIN_BOUND && rawMin <= PRICE_MAX_BOUND
      ? rawMin
      : PRICE_MIN_BOUND;

  const rawMaxParam = searchParams.get("budgetMax");
  const rawMax = rawMaxParam !== null && rawMaxParam !== "" ? Number(rawMaxParam) : PRICE_MAX_BOUND;
  const budgetMax =
    !Number.isNaN(rawMax) && rawMax >= budgetMin && rawMax <= PRICE_MAX_BOUND
      ? rawMax
      : PRICE_MAX_BOUND;

  const kmMax = searchParams.get("kmMax") ?? "";
  const rawTri = (searchParams.get("sort") ?? searchParams.get("tri")) as SortOption | null;
  const tri: SortOption =
    rawTri && SORT_VALUES.some((o) => o.value === rawTri) ? rawTri : "recent";

  return {
    q,
    marques,
    carburant,
    boite,
    carrosserie,
    etat,
    anneeMin,
    anneeMax,
    budgetMin,
    budgetMax,
    kmMax,
    tri,
  };
}

const DEFAULT_FILTERS: FilterState = {
  q: "",
  marques: [],
  carburant: "",
  boite: "",
  carrosserie: "",
  etat: "",
  anneeMin: "",
  anneeMax: "",
  budgetMin: PRICE_MIN_BOUND,
  budgetMax: PRICE_MAX_BOUND,
  kmMax: "",
  tri: "recent",
};

export function VehiclesCatalog({ cars, filterOptions }: VehiclesCatalogProps) {
  const locale = useLocale();
  const t = useTranslations("catalogue");
  const tEnums = useTranslations("enums");
  const tWa = useTranslations("whatsapp");
  const reducedMotion = useReducedMotion();

  const formatKmOptionLabel = (val: string) => {
    if (val === "") return t("kmOptions.all");
    if (val === "0") return t("kmOptions.zero");
    return t("kmOptions.under", {
      km: formatMileageLocalized(Number(val), locale, { compact: true }),
    });
  };
  const { canStartEntrance } = useTransitionState();

  const [filters, setFilters] = useState<FilterState>(() =>
    parseFiltersFromSearchParams(new URLSearchParams())
  );
  const [mobileDraft, setMobileDraft] = useState<FilterState>(filters);
  const [visibleCount, setVisibleCount] = useState(INITIAL_PAGE_SIZE);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const gridRef = useRef<HTMLDivElement | null>(null);
  const flipStateRef = useRef<Flip.FlipState | null>(null);
  const hasEnteredRef = useRef(false);
  const entranceStartedRef = useRef(false);

  const mobileSheetRef = useRef<HTMLDialogElement | null>(null);
  const sheetContainerRef = useRef<HTMLDivElement | null>(null);
  const isInternalUrlSync = useRef(false);
  const prevSearchRef = useRef("");

  const unlockBodyScroll = () => {
    sharedUnlockBodyScroll();
  };

  const lockBodyScroll = () => {
    sharedLockBodyScroll();
  };

  // Capture Flip state strictly BEFORE filter/sort React state updates (never on mount)
  const captureFlipState = () => {
    if (!gridRef.current || reducedMotion) return;
    const cards = gridRef.current.querySelectorAll(".car-card");
    if (cards.length > 0) {
      // Stop any running entrance stagger so entrance and Flip never collide
      gsap.killTweensOf(cards);
      gsap.set(cards, { clearProps: "transform,opacity,visibility,pointerEvents" });
      hasEnteredRef.current = true;
      entranceStartedRef.current = true;
      flipStateRef.current = Flip.getState(cards);
    }
  };

  // Hydrate filters from URL query params on mount and popstate (keeps SSR/SSG HTML full-catalog without Suspense fallback)
  useEffect(() => {
    const syncFromWindow = () => {
      const nextSearch = window.location.search.replace(/^\?/, "");
      if (nextSearch === prevSearchRef.current) {
        return;
      }
      prevSearchRef.current = nextSearch;
      if (isInternalUrlSync.current) {
        isInternalUrlSync.current = false;
        return;
      }
      const parsed = parseFiltersFromSearchParams(new URLSearchParams(nextSearch));
      setFilters(parsed);
      setMobileDraft(parsed);
    };

    syncFromWindow();
    window.addEventListener("popstate", syncFromWindow);
    return () => window.removeEventListener("popstate", syncFromWindow);
  }, []);

  // Push updated filters to URL query params (instant shareable URL)
  const syncFiltersToUrl = (next: FilterState) => {
    captureFlipState();
    setFilters(next);
    setVisibleCount(INITIAL_PAGE_SIZE);

    const params = new URLSearchParams();
    if (next.q.trim()) params.set("q", next.q.trim());
    if (next.marques.length > 0) params.set("brand", next.marques.join(","));
    if (next.carburant) {
      params.set("fuel", FUEL_TO_SLUG[next.carburant as FuelType] ?? next.carburant);
    }
    if (next.boite) {
      params.set(
        "transmission",
        TRANSMISSION_TO_SLUG[next.boite as TransmissionType] ?? next.boite
      );
    }
    if (next.carrosserie) {
      params.set(
        "body",
        BODY_TYPE_TO_SLUG[next.carrosserie as BodyType] ?? next.carrosserie
      );
    }
    if (next.etat) {
      params.set(
        "condition",
        CONDITION_TO_SLUG[next.etat as CarCondition] ?? next.etat
      );
    }
    if (next.anneeMin) params.set("yearMin", next.anneeMin);
    if (next.anneeMax) params.set("yearMax", next.anneeMax);
    if (next.budgetMin > PRICE_MIN_BOUND) {
      params.set("budgetMin", String(next.budgetMin));
    }
    if (next.budgetMax < PRICE_MAX_BOUND) {
      params.set("budgetMax", String(next.budgetMax));
    }
    if (next.kmMax) params.set("kmMax", next.kmMax);
    if (next.tri !== "recent") params.set("sort", next.tri);

    // Update URL synchronously preserving the current localized pathname (/vehicules, /en/vehicules, /ar/vehicules)
    const qs = params.toString();
    prevSearchRef.current = qs;
    if (typeof window !== "undefined") {
      const currentPath = window.location.pathname;
      const nextUrl = qs ? `${currentPath}?${qs}` : currentPath;
      window.history.replaceState(window.history.state, "", nextUrl);
    }
  };

  const resetAllFilters = () => {
    const resetState: FilterState = {
      ...DEFAULT_FILTERS,
      tri: filters.tri,
    };
    setMobileDraft(resetState);
    syncFiltersToUrl(resetState);
  };

  // All available brands from config + data
  const allBrands = useMemo(() => {
    return Array.from(
      new Set([...siteConfig.brands, ...filterOptions.brands])
    ).sort();
  }, [filterOptions.brands]);

  const yearOptions = useMemo(() => {
    const minYear = Math.min(...filterOptions.years, 2020);
    const maxYear = Math.max(...filterOptions.years, 2025);
    const list: number[] = [];
    for (let y = maxYear; y >= minYear; y--) {
      list.push(y);
    }
    return list;
  }, [filterOptions.years]);

  // Filter and sort vehicles
  const filteredCars = useMemo(() => {
    const query = filters.q.trim().toLowerCase();
    const minYear = filters.anneeMin ? Number(filters.anneeMin) : null;
    const maxYear = filters.anneeMax ? Number(filters.anneeMax) : null;
    const maxKm = filters.kmMax !== "" ? Number(filters.kmMax) : null;
    const isPriceFilterActive =
      filters.budgetMin > PRICE_MIN_BOUND || filters.budgetMax < PRICE_MAX_BOUND;

    const matching = cars.filter((car) => {
      if (query && !matchesVehicleSearch(car, filters.q)) {
        return false;
      }

      if (
        filters.marques.length > 0 &&
        !filters.marques.includes(car.brand)
      ) {
        return false;
      }

      if (filters.carburant && car.fuel !== filters.carburant) {
        return false;
      }

      if (filters.boite && car.transmission !== filters.boite) {
        return false;
      }

      if (filters.carrosserie && car.bodyType !== filters.carrosserie) {
        return false;
      }

      if (filters.etat && car.condition !== filters.etat) {
        return false;
      }

      if (minYear !== null && car.year < minYear) {
        return false;
      }

      if (maxYear !== null && car.year > maxYear) {
        return false;
      }

      if (isPriceFilterActive) {
        if (car.price < filters.budgetMin || car.price > filters.budgetMax) {
          return false;
        }
      }

      if (maxKm !== null && car.mileage > maxKm) {
        return false;
      }

      return true;
    });

    return [...matching].sort((a, b) => {
      switch (filters.tri) {
        case "price-asc":
          return a.price - b.price;
        case "price-desc":
          return b.price - a.price;
        case "mileage-asc":
          return a.mileage - b.mileage;
        case "recent":
        default:
          if (b.year !== a.year) return b.year - a.year;
          return a.mileage - b.mileage;
      }
    });
  }, [cars, filters]);

  // Build list of active filter chips
  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];

    if (filters.q.trim()) {
      chips.push({
        key: "q",
        label: t("chips.search", { query: filters.q.trim() }),
        onRemove: () => syncFiltersToUrl({ ...filters, q: "" }),
      });
    }

    filters.marques.forEach((brand) => {
      chips.push({
        key: `marque-${brand}`,
        label: t("chips.brand", { brand }),
        onRemove: () =>
          syncFiltersToUrl({
            ...filters,
            marques: filters.marques.filter((m) => m !== brand),
          }),
      });
    });

    if (filters.carburant) {
      chips.push({
        key: "carburant",
        label: t("chips.fuel", {
          fuel: tEnums(FUEL_LABEL_KEY[filters.carburant as FuelType]),
        }),
        onRemove: () => syncFiltersToUrl({ ...filters, carburant: "" }),
      });
    }

    if (filters.boite) {
      chips.push({
        key: "boite",
        label: t("chips.transmission", {
          transmission: tEnums(
            TRANSMISSION_LABEL_KEY[filters.boite as TransmissionType]
          ),
        }),
        onRemove: () => syncFiltersToUrl({ ...filters, boite: "" }),
      });
    }

    if (filters.carrosserie) {
      chips.push({
        key: "carrosserie",
        label: t("chips.bodyType", {
          bodyType: tEnums(
            BODY_TYPE_LABEL_KEY[filters.carrosserie as BodyType]
          ),
        }),
        onRemove: () => syncFiltersToUrl({ ...filters, carrosserie: "" }),
      });
    }

    if (filters.etat) {
      chips.push({
        key: "etat",
        label: t("chips.condition", {
          condition: tEnums(CONDITION_LABEL_KEY[filters.etat as CarCondition]),
        }),
        onRemove: () => syncFiltersToUrl({ ...filters, etat: "" }),
      });
    }

    if (filters.anneeMin || filters.anneeMax) {
      const label =
        filters.anneeMin && filters.anneeMax
          ? t("chips.yearRange", {
              min: filters.anneeMin,
              max: filters.anneeMax,
            })
          : filters.anneeMin
            ? t("chips.yearFrom", { min: filters.anneeMin })
            : t("chips.yearTo", { max: filters.anneeMax });
      chips.push({
        key: "annee",
        label,
        onRemove: () =>
          syncFiltersToUrl({ ...filters, anneeMin: "", anneeMax: "" }),
      });
    }

    if (
      filters.budgetMin > PRICE_MIN_BOUND ||
      filters.budgetMax < PRICE_MAX_BOUND
    ) {
      chips.push({
        key: "budget",
        label: t("chips.priceRange", {
          min: formatCurrencyDZD(filters.budgetMin, locale),
          max: formatCurrencyDZD(filters.budgetMax, locale),
        }),
        onRemove: () =>
          syncFiltersToUrl({
            ...filters,
            budgetMin: PRICE_MIN_BOUND,
            budgetMax: PRICE_MAX_BOUND,
          }),
      });
    }

    if (filters.kmMax !== "") {
      chips.push({
        key: "kmMax",
        label: KM_MAX_VALUES.includes(
          filters.kmMax as (typeof KM_MAX_VALUES)[number]
        )
          ? formatKmOptionLabel(filters.kmMax)
          : t("chips.kmMax", {
              km: formatMileageLocalized(Number(filters.kmMax), locale, {
                compact: true,
              }),
            }),
        onRemove: () => syncFiltersToUrl({ ...filters, kmMax: "" }),
      });
    }

    return chips;
  }, [filters, locale, t, tEnums]);

  // Mobile bottom-sheet dialog controls with Lenis scroll lock & spring-free ease
  const openMobileSheet = () => {
    setMobileDraft(filters);
    const dialog = mobileSheetRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
      lockBodyScroll();
      if (!reducedMotion && sheetContainerRef.current) {
        gsap.fromTo(
          sheetContainerRef.current,
          { y: "100%", opacity: 0.9 },
          { y: "0%", opacity: 1, duration: 0.45, ease: "power3.out", overwrite: "auto" }
        );
      }
    }
  };

  const closeMobileSheet = () => {
    const dialog = mobileSheetRef.current;
    if (!dialog?.open) {
      unlockBodyScroll();
      return;
    }
    if (reducedMotion || !sheetContainerRef.current) {
      dialog.close();
      unlockBodyScroll();
      return;
    }
    gsap.to(sheetContainerRef.current, {
      y: "100%",
      opacity: 0.9,
      duration: 0.35,
      ease: "power3.in",
      overwrite: "auto",
      onComplete: () => {
        dialog.close();
        unlockBodyScroll();
      },
    });
  };

  // Always restore Lenis scroll on unmount if mobile drawer was open
  useEffect(() => {
    return () => {
      unlockBodyScroll();
    };
  }, []);

  const applyMobileDraft = () => {
    syncFiltersToUrl(mobileDraft);
    closeMobileSheet();
  };

  const resetMobileDraft = () => {
    const resetState: FilterState = {
      ...DEFAULT_FILTERS,
      tri: filters.tri,
    };
    setMobileDraft(resetState);
    syncFiltersToUrl(resetState);
    closeMobileSheet();
  };

  // Shared filter controls renderer (used for desktop sidebar with live sync, and mobile bottom-sheet with draft sync)
  const renderFilterFields = (
    state: FilterState,
    onChange: (next: FilterState) => void,
    idPrefix: string
  ) => {
    const minPercent =
      ((state.budgetMin - PRICE_MIN_BOUND) /
        (PRICE_MAX_BOUND - PRICE_MIN_BOUND)) *
      100;
    const maxPercent =
      ((state.budgetMax - PRICE_MIN_BOUND) /
        (PRICE_MAX_BOUND - PRICE_MIN_BOUND)) *
      100;

    const toggleBrand = (brand: string) => {
      const exists = state.marques.includes(brand);
      const nextMarques = exists
        ? state.marques.filter((b) => b !== brand)
        : [...state.marques, brand];
      onChange({ ...state, marques: nextMarques });
    };

    return (
      <div className="space-y-6">
        {/* 1. Search Text */}
        <div>
          <label
            htmlFor={`${idPrefix}-search`}
            className="block text-xs font-medium uppercase tracking-wider text-silver"
          >
            {t("searchLabel")}
          </label>
          <div className="relative mt-2">
            <input
              id={`${idPrefix}-search`}
              type="search"
              value={state.q}
              onChange={(e) => onChange({ ...state, q: e.target.value })}
              placeholder={t("searchPlaceholder")}
              className="min-h-[44px] w-full rounded-xl border border-navy-700 bg-navy-950 ps-10 pe-3.5 py-2.5 text-base lg:text-sm text-ivory placeholder:text-silver/50 transition-colors hover:border-silver/50"
            />
            <svg
              width="16"
              height="16"
              aria-hidden="true"
              className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-silver"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.75}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
              />
            </svg>
          </div>
        </div>

        {/* 2. Marque (multi-select checkboxes) */}
        <fieldset className="border-t border-navy-700/70 pt-5">
          <legend className="text-xs font-medium uppercase tracking-wider text-silver">
            {t("brandLegend")}
          </legend>
          <div className="mt-3 grid grid-cols-1 gap-2">
            {allBrands.map((brand) => {
              const checked = state.marques.includes(brand);
              return (
                <label
                  key={brand}
                  className={`flex min-h-[40px] cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                    checked
                      ? "border-brand-red bg-navy-950 text-ivory"
                      : "border-navy-700 bg-navy-950/50 text-silver hover:border-silver/40 hover:text-ivory"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleBrand(brand)}
                    className="h-4 w-4 shrink-0 rounded border-navy-700 bg-navy-950"
                  />
                  <span className="whitespace-nowrap">{brand}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {/* 3. Prix (Dual-range slider in DZD) */}
        <div className="border-t border-navy-700/70 pt-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-silver">
              {t("budgetLabel")}
            </span>
          </div>

          <div className="mt-2 flex items-center justify-between text-xs font-medium text-ivory">
            <span>{formatCurrencyDZD(state.budgetMin, locale)}</span>
            <span>{formatCurrencyDZD(state.budgetMax, locale)}</span>
          </div>

          {/* Dual range track & inputs */}
          <div className="relative mt-4 h-7 flex items-center" dir="ltr">
            <div className="absolute inset-x-0 h-1.5 rounded-full bg-navy-700" />
            <div
              className="absolute h-1.5 rounded-full bg-brand-red"
              style={{
                left: `${minPercent}%`,
                right: `${100 - maxPercent}%`,
              }}
            />
            <input
              type="range"
              aria-label={t("budgetMinAria")}
              min={PRICE_MIN_BOUND}
              max={PRICE_MAX_BOUND}
              step={PRICE_STEP}
              value={state.budgetMin}
              onChange={(e) => {
                const val = Math.min(
                  Number(e.target.value),
                  state.budgetMax - PRICE_STEP
                );
                onChange({ ...state, budgetMin: Math.max(PRICE_MIN_BOUND, val) });
              }}
              className="dual-range-input absolute inset-x-0 w-full h-7"
            />
            <input
              type="range"
              aria-label={t("budgetMaxAria")}
              min={PRICE_MIN_BOUND}
              max={PRICE_MAX_BOUND}
              step={PRICE_STEP}
              value={state.budgetMax}
              onChange={(e) => {
                const val = Math.max(
                  Number(e.target.value),
                  state.budgetMin + PRICE_STEP
                );
                onChange({ ...state, budgetMax: Math.min(PRICE_MAX_BOUND, val) });
              }}
              className="dual-range-input absolute inset-x-0 w-full h-7"
            />
          </div>
        </div>

        {/* 4. État (Neuf / Occasion) */}
        <div className="border-t border-navy-700/70 pt-5">
          <label
            htmlFor={`${idPrefix}-etat`}
            className="block text-xs font-medium uppercase tracking-wider text-silver"
          >
            {t("conditionLabel")}
          </label>
          <select
            id={`${idPrefix}-etat`}
            value={state.etat}
            onChange={(e) => onChange({ ...state, etat: e.target.value })}
            className="mt-2 min-h-[44px] w-full rounded-xl border border-navy-700 bg-navy-950 px-3.5 py-2.5 text-sm text-ivory transition-colors hover:border-silver/50"
          >
            <option value="">{t("conditionAll")}</option>
            <option value="Neuf">{tEnums(CONDITION_LABEL_KEY.Neuf)}</option>
            <option value="Occasion">
              {tEnums(CONDITION_LABEL_KEY.Occasion)}
            </option>
          </select>
        </div>

        {/* 5. Carburant */}
        <div className="border-t border-navy-700/70 pt-5">
          <label
            htmlFor={`${idPrefix}-carburant`}
            className="block text-xs font-medium uppercase tracking-wider text-silver"
          >
            {t("fuelLabel")}
          </label>
          <select
            id={`${idPrefix}-carburant`}
            value={state.carburant}
            onChange={(e) => onChange({ ...state, carburant: e.target.value })}
            className="mt-2 min-h-[44px] w-full rounded-xl border border-navy-700 bg-navy-950 px-3.5 py-2.5 text-sm text-ivory transition-colors hover:border-silver/50"
          >
            <option value="">{t("fuelAll")}</option>
            {filterOptions.fuels.map((fuel) => (
              <option key={fuel} value={fuel}>
                {tEnums(FUEL_LABEL_KEY[fuel])}
              </option>
            ))}
          </select>
        </div>

        {/* 6. Boîte de vitesses */}
        <div className="border-t border-navy-700/70 pt-5">
          <label
            htmlFor={`${idPrefix}-boite`}
            className="block text-xs font-medium uppercase tracking-wider text-silver"
          >
            {t("transmissionLabel")}
          </label>
          <select
            id={`${idPrefix}-boite`}
            value={state.boite}
            onChange={(e) => onChange({ ...state, boite: e.target.value })}
            className="mt-2 min-h-[44px] w-full rounded-xl border border-navy-700 bg-navy-950 px-3.5 py-2.5 text-sm text-ivory transition-colors hover:border-silver/50"
          >
            <option value="">{t("transmissionAll")}</option>
            <option value="Automatique">
              {tEnums(TRANSMISSION_LABEL_KEY.Automatique)}
            </option>
            <option value="Manuelle">
              {tEnums(TRANSMISSION_LABEL_KEY.Manuelle)}
            </option>
          </select>
        </div>

        {/* 7. Type de carrosserie */}
        <div className="border-t border-navy-700/70 pt-5">
          <label
            htmlFor={`${idPrefix}-carrosserie`}
            className="block text-xs font-medium uppercase tracking-wider text-silver"
          >
            {t("bodyTypeLabel")}
          </label>
          <select
            id={`${idPrefix}-carrosserie`}
            value={state.carrosserie}
            onChange={(e) =>
              onChange({ ...state, carrosserie: e.target.value })
            }
            className="mt-2 min-h-[44px] w-full rounded-xl border border-navy-700 bg-navy-950 px-3.5 py-2.5 text-sm text-ivory transition-colors hover:border-silver/50"
          >
            <option value="">{t("bodyTypeAll")}</option>
            {(
              [
                "SUV",
                "Berline",
                "Citadine",
                "Coupé",
                "Break",
                "Utilitaire",
              ] as const
            ).map((body) => (
              <option key={body} value={body}>
                {tEnums(BODY_TYPE_LABEL_KEY[body])}
              </option>
            ))}
          </select>
        </div>

        {/* 8. Année (min & max) */}
        <div className="border-t border-navy-700/70 pt-5">
          <span className="block text-xs font-medium uppercase tracking-wider text-silver">
            {t("yearLabel")}
          </span>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${idPrefix}-annee-min`} className="sr-only">
                {t("yearMinAria")}
              </label>
              <select
                id={`${idPrefix}-annee-min`}
                value={state.anneeMin}
                onChange={(e) =>
                  onChange({ ...state, anneeMin: e.target.value })
                }
                className="min-h-[44px] w-full rounded-xl border border-navy-700 bg-navy-950 px-3 py-2 text-sm text-ivory"
              >
                <option value="">{t("min")}</option>
                {[...yearOptions].reverse().map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor={`${idPrefix}-annee-max`} className="sr-only">
                {t("yearMaxAria")}
              </label>
              <select
                id={`${idPrefix}-annee-max`}
                value={state.anneeMax}
                onChange={(e) =>
                  onChange({ ...state, anneeMax: e.target.value })
                }
                className="min-h-[44px] w-full rounded-xl border border-navy-700 bg-navy-950 px-3 py-2 text-sm text-ivory"
              >
                <option value="">{t("max")}</option>
                {yearOptions.map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 9. Kilométrage max */}
        <div className="border-t border-navy-700/70 pt-5">
          <label
            htmlFor={`${idPrefix}-km-max`}
            className="block text-xs font-medium uppercase tracking-wider text-silver"
          >
            {t("kmMaxLabel")}
          </label>
          <select
            id={`${idPrefix}-km-max`}
            value={state.kmMax}
            onChange={(e) => onChange({ ...state, kmMax: e.target.value })}
            className="mt-2 min-h-[44px] w-full rounded-xl border border-navy-700 bg-navy-950 px-3.5 py-2.5 text-sm text-ivory transition-colors hover:border-silver/50"
          >
            {KM_MAX_VALUES.map((val) => (
              <option key={val || "all"} value={val}>
                {formatKmOptionLabel(val)}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  };

  const visibleCars = useMemo(
    () => filteredCars.slice(0, visibleCount),
    [filteredCars, visibleCount]
  );
  const hasMoreCars = filteredCars.length > visibleCount;

  // STEP 2: Single fail-safe entrance animation after route transition completes + 2.5s watchdog
  useEffect(() => {
    if (!gridRef.current) return;
    const cards = gridRef.current.querySelectorAll(".car-card");
    if (!cards.length) return;

    if (reducedMotion) {
      gsap.killTweensOf(cards);
      gsap.set(cards, { clearProps: "transform,opacity,visibility,pointerEvents" });
      hasEnteredRef.current = true;
      return;
    }

    // Wait until route transition is "idle" or "revealing"
    if (!canStartEntrance) return;

    // Run entrance stagger only once per mount
    if (entranceStartedRef.current) return;
    entranceStartedRef.current = true;

    gsap.killTweensOf(cards);
    const entranceTween = gsap.fromTo(
      cards,
      { autoAlpha: 0, y: 24, pointerEvents: "none" },
      {
        autoAlpha: 1,
        y: 0,
        pointerEvents: "auto",
        duration: 0.7,
        stagger: 0.06,
        ease: "power3.out",
        overwrite: "auto",
        clearProps: "transform,opacity,visibility,pointerEvents",
        onComplete: () => {
          hasEnteredRef.current = true;
        },
      }
    );

    // 2.5s Watchdog: guarantee no card can ever remain half-transparent or stuck
    const watchdogTimer = window.setTimeout(() => {
      if (!gridRef.current) return;
      const currentCards = gridRef.current.querySelectorAll(".car-card");
      gsap.killTweensOf(currentCards);
      gsap.set(currentCards, { clearProps: "transform,opacity,visibility,pointerEvents" });
      hasEnteredRef.current = true;
    }, 2500);

    return () => {
      window.clearTimeout(watchdogTimer);
      entranceTween.kill();
      if (gridRef.current) {
        const currentCards = gridRef.current.querySelectorAll(".car-card");
        gsap.killTweensOf(currentCards);
        gsap.set(currentCards, { clearProps: "transform,opacity,visibility,pointerEvents" });
      }
      // Reset so React Strict Mode remount runs cleanly
      entranceStartedRef.current = false;
    };
  }, [canStartEntrance, reducedMotion]);

  // STEP 3: GSAP Flip strictly for filtering & sorting (never on first render)
  useLayoutEffect(() => {
    const state = flipStateRef.current;
    if (!state || !gridRef.current || reducedMotion) {
      flipStateRef.current = null;
      return;
    }
    flipStateRef.current = null;

    const cards = gridRef.current.querySelectorAll(".car-card");
    gsap.killTweensOf(cards);

    const flipTl = Flip.from(state, {
      duration: 0.6,
      ease: "power3.out",
      absolute: true,
      nested: false,
      onEnter: (elements) =>
        gsap.fromTo(
          elements,
          { autoAlpha: 0, scale: 0.96 },
          {
            autoAlpha: 1,
            scale: 1,
            duration: 0.45,
            ease: "power3.out",
            overwrite: "auto",
          }
        ),
      onLeave: (elements) =>
        gsap.to(elements, {
          autoAlpha: 0,
          scale: 0.96,
          duration: 0.25,
          ease: "power3.in",
          overwrite: "auto",
        }),
      onComplete: () => {
        if (gridRef.current) {
          const finalCards = gridRef.current.querySelectorAll(".car-card");
          gsap.set(finalCards, {
            clearProps: "transform,opacity,visibility,pointerEvents",
          });
        }
        ScrollTrigger.refresh();
      },
    });

    return () => {
      flipTl.kill();
    };
  }, [visibleCars, reducedMotion]);

  const resultLabel = t("resultsCount", { count: filteredCars.length });

  const advancedFilterCount =
    (filters.carrosserie ? 1 : 0) +
    (filters.kmMax ? 1 : 0) +
    (filters.anneeMin || filters.anneeMax ? 1 : 0) +
    (filters.budgetMin > PRICE_MIN_BOUND || filters.budgetMax < PRICE_MAX_BOUND ? 1 : 0);

  const toggleTopBrand = (brand: string) => {
    const exists = filters.marques.includes(brand);
    const nextMarques = exists
      ? filters.marques.filter((b) => b !== brand)
      : [...filters.marques, brand];
    syncFiltersToUrl({ ...filters, marques: nextMarques });
  };

  const budgetMinPercent =
    ((filters.budgetMin - PRICE_MIN_BOUND) /
      (PRICE_MAX_BOUND - PRICE_MIN_BOUND)) *
    100;
  const budgetMaxPercent =
    ((filters.budgetMax - PRICE_MIN_BOUND) /
      (PRICE_MAX_BOUND - PRICE_MIN_BOUND)) *
    100;

  const emptyStateWhatsAppUrl = getWhatsAppUrl(tWa("emptyCatalogMessage"));

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      {/* Page Title & Result Counter + Sort Header */}
      <div className="flex flex-col gap-5 border-b border-navy-700/80 pb-7 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-silver">
            {t("eyebrow")}
          </p>
          <h1 className="mt-1.5 font-serif text-3xl sm:text-4xl lg:text-5xl font-semibold text-ivory">
            {t("title")}
          </h1>
          <p
            aria-live="polite"
            className="mt-2 text-sm sm:text-base text-silver"
          >
            {resultLabel}
          </p>
        </div>

        {/* Mobile Filter Trigger + Sort Dropdown */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Mobile "Filtres" Button */}
          <button
            type="button"
            onClick={openMobileSheet}
            aria-controls="mobile-filters-sheet"
            className="lg:hidden inline-flex min-h-[44px] flex-1 sm:flex-initial items-center justify-center gap-2 rounded-xl border border-navy-700 bg-navy-900 px-4 py-2.5 text-sm font-medium text-ivory transition-colors hover:border-silver/50"
          >
            <svg
              width="16"
              height="16"
              aria-hidden="true"
              className="h-4 w-4 text-brand-red"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.75}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75"
              />
            </svg>
            <span>{t("filtersButton")}</span>
            {activeChips.length > 0 && (
              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-red px-1.5 text-[11px] font-semibold text-ivory">
                {activeChips.length}
              </span>
            )}
          </button>

          {/* Sort Select */}
          <div className="flex flex-1 sm:flex-initial items-center gap-2.5">
            <label
              htmlFor="catalog-sort"
              className="hidden sm:inline text-xs font-medium uppercase tracking-wider text-silver whitespace-nowrap"
            >
              {t("sortBy")}
            </label>
            <select
              id="catalog-sort"
              aria-label={t("sortAriaLabel")}
              value={filters.tri}
              onChange={(e) =>
                syncFiltersToUrl({
                  ...filters,
                  tri: e.target.value as SortOption,
                })
              }
              className="min-h-[44px] w-full sm:w-auto rounded-xl border border-navy-700 bg-navy-900 px-3.5 py-2.5 text-base lg:text-sm text-ivory transition-colors hover:border-silver/50"
            >
              {SORT_VALUES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(`sort.${opt.key}`)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Top Horizontal Filter Bar (above car cards) */}
      <section
        aria-label={t("filtersRegionLabel")}
        className="mt-7 rounded-2xl border border-navy-700/80 bg-navy-900/95 p-4 sm:p-5 shadow-lg shadow-black/20"
      >
        {/* Row 1: Quick Brand Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
          <span className="hidden sm:inline-block me-1 text-[11px] font-semibold uppercase tracking-widest text-silver/80">
            {t("brandsLabel")}
          </span>
          <button
            type="button"
            onClick={() => syncFiltersToUrl({ ...filters, marques: [] })}
            aria-pressed={filters.marques.length === 0}
            className={`shrink-0 inline-flex min-h-[38px] items-center rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all ${
              filters.marques.length === 0
                ? "border-brand-red bg-brand-red text-ivory shadow-sm shadow-brand-red/25"
                : "border-navy-700 bg-navy-950/80 text-silver hover:border-silver/40 hover:text-ivory"
            }`}
          >
            {t("allBrandsChip")}
          </button>
          {filterOptions.brands.map((brand) => {
            const active = filters.marques.includes(brand);
            return (
              <button
                key={brand}
                type="button"
                onClick={() => toggleTopBrand(brand)}
                aria-pressed={active}
                className={`shrink-0 inline-flex min-h-[38px] items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all ${
                  active
                    ? "border-brand-red bg-brand-red/15 text-ivory"
                    : "border-navy-700 bg-navy-950/80 text-silver hover:border-silver/40 hover:text-ivory"
                }`}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full bg-brand-red"
                  />
                )}
                <span>{brand}</span>
              </button>
            );
          })}
        </div>

        {/* Row 2: Search + Primary Inline Dropdowns (Desktop) + Advanced Toggle */}
        <div className="mt-4 grid grid-cols-1 gap-3 border-t border-navy-700/60 pt-4 lg:grid-cols-12 lg:items-center">
          {/* Search Input (visible on all breakpoints) */}
          <div className="relative lg:col-span-4">
            <label htmlFor="top-filter-q" className="sr-only">
              {t("searchSrLabel")}
            </label>
            <svg
              width="16"
              height="16"
              aria-hidden="true"
              className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-silver/70"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.75}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
              />
            </svg>
            <input
              id="top-filter-q"
              type="search"
              value={filters.q}
              onChange={(e) =>
                syncFiltersToUrl({ ...filters, q: e.target.value })
              }
              placeholder={t("searchPlaceholderShort")}
              className="min-h-[44px] w-full rounded-xl border border-navy-700 bg-navy-950 ps-10 pe-3.5 py-2.5 text-base lg:text-sm text-ivory placeholder:text-silver/50 transition-colors hover:border-silver/50"
            />
          </div>

          {/* État (Desktop inline) */}
          <div className="hidden lg:block lg:col-span-2">
            <label htmlFor="top-filter-etat" className="sr-only">
              {t("conditionAria")}
            </label>
            <select
              id="top-filter-etat"
              value={filters.etat}
              onChange={(e) =>
                syncFiltersToUrl({ ...filters, etat: e.target.value })
              }
              className="min-h-[44px] w-full rounded-xl border border-navy-700 bg-navy-950 px-3.5 py-2.5 text-sm text-ivory transition-colors hover:border-silver/50"
            >
              <option value="">{t("conditionInlineAll")}</option>
              <option value="Neuf">{tEnums(CONDITION_LABEL_KEY.Neuf)}</option>
              <option value="Occasion">
                {tEnums(CONDITION_LABEL_KEY.Occasion)}
              </option>
            </select>
          </div>

          {/* Carburant (Desktop inline) */}
          <div className="hidden lg:block lg:col-span-2">
            <label htmlFor="top-filter-carburant" className="sr-only">
              {t("fuelLabel")}
            </label>
            <select
              id="top-filter-carburant"
              value={filters.carburant}
              onChange={(e) =>
                syncFiltersToUrl({ ...filters, carburant: e.target.value })
              }
              className="min-h-[44px] w-full rounded-xl border border-navy-700 bg-navy-950 px-3.5 py-2.5 text-sm text-ivory transition-colors hover:border-silver/50"
            >
              <option value="">{t("fuelInlineAll")}</option>
              {filterOptions.fuels.map((fuel) => (
                <option key={fuel} value={fuel}>
                  {tEnums(FUEL_LABEL_KEY[fuel])}
                </option>
              ))}
            </select>
          </div>

          {/* Boîte (Desktop inline) */}
          <div className="hidden lg:block lg:col-span-2">
            <label htmlFor="top-filter-boite" className="sr-only">
              {t("transmissionLabel")}
            </label>
            <select
              id="top-filter-boite"
              value={filters.boite}
              onChange={(e) =>
                syncFiltersToUrl({ ...filters, boite: e.target.value })
              }
              className="min-h-[44px] w-full rounded-xl border border-navy-700 bg-navy-950 px-3.5 py-2.5 text-sm text-ivory transition-colors hover:border-silver/50"
            >
              <option value="">{t("transmissionInlineAll")}</option>
              <option value="Automatique">
                {tEnums(TRANSMISSION_LABEL_KEY.Automatique)}
              </option>
              <option value="Manuelle">
                {tEnums(TRANSMISSION_LABEL_KEY.Manuelle)}
              </option>
            </select>
          </div>

          {/* Plus de filtres toggle (Desktop) */}
          <div className="hidden lg:block lg:col-span-2">
            <button
              type="button"
              onClick={() => setShowAdvancedFilters((prev) => !prev)}
              aria-expanded={showAdvancedFilters}
              aria-controls="desktop-advanced-filters"
              className={`inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-colors ${
                showAdvancedFilters || advancedFilterCount > 0
                  ? "border-brand-red/70 bg-brand-red/10 text-ivory"
                  : "border-navy-700 bg-navy-950 text-ivory hover:border-silver/50"
              }`}
            >
              <svg
                width="16"
                height="16"
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-brand-red"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.75}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75"
                />
              </svg>
              <span className="whitespace-nowrap">{t("moreFilters")}</span>
              {advancedFilterCount > 0 && (
                <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-red px-1.5 text-[11px] font-semibold text-ivory">
                  {advancedFilterCount}
                </span>
              )}
              <svg
                width="14"
                height="14"
                aria-hidden="true"
                className={`h-3.5 w-3.5 shrink-0 text-silver transition-transform duration-200 ${
                  showAdvancedFilters ? "rotate-180" : ""
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
          </div>
        </div>

        {/* Row 3: Collapsible Advanced Filters Panel (Desktop) */}
        {showAdvancedFilters && (
          <div
            id="desktop-advanced-filters"
            className="hidden lg:grid lg:grid-cols-12 gap-5 border-t border-navy-700/60 pt-5 mt-4"
          >
            {/* Carrosserie */}
            <div className="lg:col-span-3">
              <label
                htmlFor="top-filter-carrosserie"
                className="block text-[11px] font-semibold uppercase tracking-wider text-silver"
              >
                {t("bodyTypeShort")}
              </label>
              <select
                id="top-filter-carrosserie"
                value={filters.carrosserie}
                onChange={(e) =>
                  syncFiltersToUrl({ ...filters, carrosserie: e.target.value })
                }
                className="mt-2 min-h-[44px] w-full rounded-xl border border-navy-700 bg-navy-950 px-3.5 py-2.5 text-sm text-ivory transition-colors hover:border-silver/50"
              >
                <option value="">{t("bodyTypeInlineAll")}</option>
                {filterOptions.bodyTypes.map((body) => (
                  <option key={body} value={body}>
                    {tEnums(BODY_TYPE_LABEL_KEY[body])}
                  </option>
                ))}
              </select>
            </div>

            {/* Kilométrage max */}
            <div className="lg:col-span-3">
              <label
                htmlFor="top-filter-kmMax"
                className="block text-[11px] font-semibold uppercase tracking-wider text-silver"
              >
                {t("kmMaxLabel")}
              </label>
              <select
                id="top-filter-kmMax"
                value={filters.kmMax}
                onChange={(e) =>
                  syncFiltersToUrl({ ...filters, kmMax: e.target.value })
                }
                className="mt-2 min-h-[44px] w-full rounded-xl border border-navy-700 bg-navy-950 px-3.5 py-2.5 text-sm text-ivory transition-colors hover:border-silver/50"
              >
                {KM_MAX_VALUES.map((val) => (
                  <option key={val || "all"} value={val}>
                    {formatKmOptionLabel(val)}
                  </option>
                ))}
              </select>
            </div>

            {/* Année Min / Max */}
            <div className="lg:col-span-3">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-silver">
                {t("yearLabel")}
              </span>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="top-filter-anneeMin" className="sr-only">
                    {t("yearMinAria")}
                  </label>
                  <select
                    id="top-filter-anneeMin"
                    value={filters.anneeMin}
                    onChange={(e) =>
                      syncFiltersToUrl({ ...filters, anneeMin: e.target.value })
                    }
                    className="min-h-[44px] w-full rounded-xl border border-navy-700 bg-navy-950 px-3 py-2.5 text-sm text-ivory transition-colors hover:border-silver/50"
                  >
                    <option value="">{t("min")}</option>
                    {filterOptions.years.map((y) => (
                      <option key={y} value={String(y)}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="top-filter-anneeMax" className="sr-only">
                    {t("yearMaxAria")}
                  </label>
                  <select
                    id="top-filter-anneeMax"
                    value={filters.anneeMax}
                    onChange={(e) =>
                      syncFiltersToUrl({ ...filters, anneeMax: e.target.value })
                    }
                    className="min-h-[44px] w-full rounded-xl border border-navy-700 bg-navy-950 px-3 py-2.5 text-sm text-ivory transition-colors hover:border-silver/50"
                  >
                    <option value="">{t("max")}</option>
                    {filterOptions.years.map((y) => (
                      <option key={y} value={String(y)}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Budget (DA) Dual Slider */}
            <div className="lg:col-span-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-silver">
                  {t("budgetShort")}
                </span>
                <span className="text-[11px] font-medium text-ivory">
                  {formatCurrencyDZD(filters.budgetMin, locale)} –{" "}
                  {filters.budgetMax >= PRICE_MAX_BOUND
                    ? "30M+"
                    : formatCurrencyDZD(filters.budgetMax, locale)}
                </span>
              </div>

              <div className="mt-4 relative flex h-8 items-center" dir="ltr">
                <div className="h-1.5 w-full rounded-full bg-navy-700" />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute h-1.5 rounded-full bg-brand-red"
                  style={{
                    left: `${budgetMinPercent}%`,
                    right: `${100 - budgetMaxPercent}%`,
                  }}
                />
                <input
                  id="top-filter-budgetMin"
                  type="range"
                  aria-label={t("budgetMinAria")}
                  min={PRICE_MIN_BOUND}
                  max={PRICE_MAX_BOUND}
                  step={PRICE_STEP}
                  value={filters.budgetMin}
                  onChange={(e) => {
                    const nextMin = Math.min(
                      Number(e.target.value),
                      filters.budgetMax - PRICE_STEP
                    );
                    syncFiltersToUrl({ ...filters, budgetMin: nextMin });
                  }}
                  className="dual-range-input"
                />
                <input
                  id="top-filter-budgetMax"
                  type="range"
                  aria-label={t("budgetMaxAria")}
                  min={PRICE_MIN_BOUND}
                  max={PRICE_MAX_BOUND}
                  step={PRICE_STEP}
                  value={filters.budgetMax}
                  onChange={(e) => {
                    const nextMax = Math.max(
                      Number(e.target.value),
                      filters.budgetMin + PRICE_STEP
                    );
                    syncFiltersToUrl({ ...filters, budgetMax: nextMax });
                  }}
                  className="dual-range-input"
                />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Main Catalog Area: Active Filter Chips + Full-Width 3-Column Grid */}
      <div className="mt-7 min-w-0 min-h-[600px]">
        {/* Removable Active Filter Chips (horizontally scrollable on mobile) */}
        {activeChips.length > 0 && (
          <div
            aria-label={t("activeFiltersLabel")}
            className="mb-6 flex flex-nowrap items-center gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0"
          >
            {activeChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={chip.onRemove}
                aria-label={t("removeFilterAria", { label: chip.label })}
                className="shrink-0 inline-flex min-h-[38px] items-center gap-2 rounded-full border border-navy-700 bg-navy-900 px-3.5 py-1.5 text-xs font-medium text-ivory transition-colors hover:border-brand-red"
              >
                <span>{chip.label}</span>
                <span aria-hidden="true" className="text-silver">
                  &times;
                </span>
              </button>
            ))}

            <button
              type="button"
              onClick={resetAllFilters}
              className="inline-flex min-h-[38px] items-center px-3 py-1.5 text-xs font-medium text-silver underline-offset-4 transition-colors hover:text-ivory hover:underline"
            >
              {t("clearAll")}
            </button>
          </div>
        )}

        {/* Vehicle Grid or Empty State */}
        {visibleCars.length > 0 ? (
          <>
            <h2 className="sr-only">{t("catalogHeadingSr")}</h2>
            <div
              ref={gridRef}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch"
            >
              {visibleCars.map((car, index) => (
                <CarCard key={car.id} car={car} priority={index === 0} />
              ))}
            </div>

              {/* Scalable "Charger plus" button when catalog exceeds page size */}
              {hasMoreCars && (
                <div className="mt-10 flex flex-col items-center gap-2">
                  <p className="text-xs text-silver">
                    {t("showingCount", {
                      visible: visibleCars.length,
                      total: filteredCars.length,
                    })}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setVisibleCount((prev) => prev + PAGE_INCREMENT)
                    }
                    className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-navy-700 bg-navy-900 px-7 py-3 text-sm font-semibold text-ivory transition-colors hover:border-silver/50"
                  >
                    {t("loadMore")}
                  </button>
                </div>
              )}
            </>
          ) : (
            /* Empty state */
            <div className="rounded-xl border border-navy-700 bg-navy-900 p-8 sm:p-12 text-center">
              <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full border border-navy-700 bg-navy-950 text-brand-red">
                <svg
                  aria-hidden="true"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.75}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                  />
                </svg>
              </div>

              <h2 className="mt-4 font-serif text-2xl sm:text-3xl font-semibold text-ivory">
                {t("emptyTitle")}
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-silver leading-relaxed">
                {t("emptyDescription")}
              </p>

              <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3.5">
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="inline-flex min-h-[48px] w-full sm:w-auto items-center justify-center rounded-xl border border-navy-700 bg-navy-950 px-6 py-3 text-sm font-medium text-ivory transition-colors hover:border-silver/50"
                >
                  {t("resetFilters")}
                </button>

                <a
                  href={emptyStateWhatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[48px] w-full sm:w-auto items-center justify-center gap-2.5 rounded-xl bg-whatsapp-green px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-95"
                >
                  <WhatsAppIcon className="h-5 w-5 shrink-0 fill-current" />
                  <span>{t("emptyCta")}</span>
                </a>
              </div>
            </div>
          )}
        </div>

      {/* Mobile Bottom-Sheet Drawer (<dialog>) */}
      <dialog
        ref={mobileSheetRef}
        id="mobile-filters-sheet"
        aria-labelledby="mobile-filters-title"
        className="filter-bottom-sheet lg:hidden"
        onClose={unlockBodyScroll}
        onClick={(e) => {
          if (
            sheetContainerRef.current &&
            !sheetContainerRef.current.contains(e.target as Node)
          ) {
            closeMobileSheet();
          }
        }}
      >
        <div
          ref={sheetContainerRef}
          className="flex max-h-[88svh] w-full flex-col rounded-t-2xl border-t border-navy-700 bg-navy-900 text-ivory shadow-2xl"
        >
          {/* Sheet Header */}
          <div className="flex items-center justify-between border-b border-navy-700/80 px-5 py-4">
            <h2
              id="mobile-filters-title"
              className="font-serif text-xl font-semibold text-ivory"
            >
              {t("sheetTitle")}
            </h2>
            <button
              type="button"
              onClick={closeMobileSheet}
              aria-label={t("closeFilters")}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-navy-700 bg-navy-950 text-silver transition-colors hover:text-ivory"
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
                  d="M6 18 18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Scrollable Filter Body */}
          <div className="flex-1 overflow-y-auto px-5 py-5">
            {renderFilterFields(mobileDraft, setMobileDraft, "mobile")}
          </div>

          {/* Sticky Bottom Bar: Réinitialiser & Appliquer */}
          <div className="flex items-center gap-3 border-t border-navy-700/80 bg-navy-950 px-5 py-4">
            <button
              type="button"
              onClick={resetMobileDraft}
              className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-xl border border-navy-700 bg-navy-900 px-4 py-3 text-sm font-medium text-ivory transition-colors hover:border-silver/50"
            >
              {t("reset")}
            </button>
            <button
              type="button"
              onClick={applyMobileDraft}
              className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-xl bg-brand-red px-4 py-3 text-sm font-semibold text-ivory transition-colors hover:bg-brand-red/90"
            >
              {t("apply")}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
