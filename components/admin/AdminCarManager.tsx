"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  deleteCarAction,
  duplicateCarAction,
  toggleFeaturedAction,
  togglePublishedAction,
  updateCarStatusAction,
} from "@/lib/actions/cars";
import { resolveAdminError } from "@/lib/admin-errors";
import { cldUrl, getCarPlaceholderImage } from "@/lib/cloudinary-url";
import { formatCarPrice, formatNumber } from "@/lib/format";
import { STATUS_LABEL_KEY } from "@/lib/labels";
import { AdminToastHost, type ToastItem } from "@/components/admin/AdminToast";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useModalOverlay } from "@/hooks/useModalOverlay";
import type { CarImage, CarRow, CarStatus } from "@/types/database";

interface AdminCarManagerProps {
  initialCars: CarRow[];
  initialError?: string | null;
}

type PublicationFilter = "" | "published" | "hidden";
type FeaturedFilter = "" | "yes" | "no";

interface FilterParams {
  q: string;
  statut: "" | CarStatus;
  publication: PublicationFilter;
  vedette: FeaturedFilter;
}

const STATUS_OPTIONS: CarStatus[] = ["Disponible", "Réservé", "Vendu"];

function getCoverThumb(car: CarRow): string {
  const imgs = Array.isArray(car.images) ? (car.images as CarImage[]) : [];
  const first = imgs[0];
  if (first?.url?.includes("res.cloudinary.com/")) {
    return cldUrl(first.url, { width: 120 });
  }
  if (first?.public_id) {
    return cldUrl(first.public_id, { width: 120 });
  }
  if (first?.url) {
    return first.url;
  }
  return getCarPlaceholderImage(car.slug);
}

function formatUpdatedDate(iso: string, locale: string): string {
  try {
    const date = new Date(iso);
    const intlLocale =
      locale === "ar" ? "ar-DZ" : locale === "en" ? "en-US" : "fr-FR";
    const diffMs = date.getTime() - Date.now();
    const diffMins = Math.round(diffMs / 60000);
    const diffHours = Math.round(diffMs / 3600000);
    const diffDays = Math.round(diffMs / 86400000);

    if (typeof Intl.RelativeTimeFormat === "function") {
      const rtf = new Intl.RelativeTimeFormat(intlLocale, { numeric: "auto" });
      if (Math.abs(diffMins) < 60) {
        return rtf.format(diffMins, "minute");
      }
      if (Math.abs(diffHours) < 24) {
        return rtf.format(diffHours, "hour");
      }
      if (Math.abs(diffDays) <= 7) {
        return rtf.format(diffDays, "day");
      }
    }

    return new Intl.DateTimeFormat(intlLocale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);
  } catch {
    return "—";
  }
}

function statusSelectStyle(status: CarStatus): string {
  switch (status) {
    case "Vendu":
      return "border-brand-red/70 bg-brand-red/15 text-ivory";
    case "Réservé":
      return "border-amber-400/60 bg-amber-500/10 text-amber-200";
    default:
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
  }
}

function ToggleSwitch({
  checked,
  disabled,
  label,
  onToggle,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ivory disabled:opacity-50 ${
        checked
          ? "border-brand-red bg-brand-red"
          : "border-navy-700 bg-navy-950"
      }`}
    >
      <span
        aria-hidden="true"
        className={`inline-block h-5 w-5 rounded-full bg-ivory shadow transition-transform duration-200 ${
          checked
            ? "translate-x-6 rtl:-translate-x-6"
            : "translate-x-1 rtl:-translate-x-1"
        }`}
      />
    </button>
  );
}

export function AdminCarManager({
  initialCars,
  initialError = null,
}: AdminCarManagerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const tAdmin = useTranslations("admin");
  const t = useTranslations("admin.dashboard");
  const tEnums = useTranslations("enums");
  const tCommon = useTranslations("common");

  const [cars, setCars] = useState<CarRow[]>(initialCars);
  const [filters, setFilters] = useState<FilterParams>({
    q: "",
    statut: "",
    publication: "",
    vedette: "",
  });
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<CarRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const filterSheetRef = useRef<HTMLDivElement>(null);

  useModalOverlay({
    open: filterSheetOpen,
    onClose: () => setFilterSheetOpen(false),
    containerRef: filterSheetRef,
  });

  // Sync if server re-renders with fresh data
  useEffect(() => {
    setCars(initialCars);
  }, [initialCars]);

  const pushToast = useCallback(
    (
      type: "success" | "error",
      message: string,
      action?: { actionLabel: string; onAction: () => void }
    ) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [
        ...prev,
        {
          id,
          type,
          message,
          actionLabel: action?.actionLabel,
          onAction: action?.onAction,
        },
      ]);
      window.setTimeout(
        () => {
          setToasts((prev) => prev.filter((item) => item.id !== id));
        },
        action ? 6000 : 4200
      );
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // Hydrate filters + redirect toast from URL params on mount
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const toastParam = sp.get("toast");
    if (toastParam) {
      if (toastParam === "created") {
        pushToast("success", t("toasts.created"));
      } else if (toastParam === "updated") {
        pushToast("success", t("toasts.updated"));
      } else if (toastParam === "deleted") {
        pushToast("success", t("toasts.deleted"));
      }
      sp.delete("toast");
      const cleanQs = sp.toString();
      router.replace(cleanQs ? `${pathname}?${cleanQs}` : pathname, {
        scroll: false,
      });
    }

    const rawStatut = sp.get("statut") ?? "";
    const rawPub = sp.get("publication") ?? "";
    const rawVedette = sp.get("vedette") ?? "";
    setFilters({
      q: sp.get("q") ?? "",
      statut: STATUS_OPTIONS.includes(rawStatut as CarStatus)
        ? (rawStatut as CarStatus)
        : "",
      publication:
        rawPub === "published" || rawPub === "hidden" ? rawPub : "",
      vedette: rawVedette === "yes" || rawVedette === "no" ? rawVedette : "",
    });
  }, [pathname, pushToast, router, t]);

  const updateFilters = (next: FilterParams) => {
    setFilters(next);
    const sp = new URLSearchParams();
    if (next.q.trim()) sp.set("q", next.q.trim());
    if (next.statut) sp.set("statut", next.statut);
    if (next.publication) sp.set("publication", next.publication);
    if (next.vedette) sp.set("vedette", next.vedette);
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const resetFilters = () => {
    updateFilters({ q: "", statut: "", publication: "", vedette: "" });
  };

  const setBusy = (id: string, busy: boolean) => {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  // Counters computed from live optimistic state
  const counters = useMemo(() => {
    let published = 0;
    let drafts = 0;
    let featured = 0;
    let sold = 0;
    for (const c of cars) {
      if (c.published) published += 1;
      else drafts += 1;
      if (c.featured) featured += 1;
      if (c.status === "Vendu") sold += 1;
    }
    return {
      total: cars.length,
      published,
      drafts,
      featured,
      sold,
    };
  }, [cars]);

  const filteredCars = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return cars.filter((car) => {
      if (q) {
        const hay = `${car.brand} ${car.model} ${car.slug}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filters.statut && car.status !== filters.statut) return false;
      if (filters.publication === "published" && !car.published) return false;
      if (filters.publication === "hidden" && car.published) return false;
      if (filters.vedette === "yes" && !car.featured) return false;
      if (filters.vedette === "no" && car.featured) return false;
      return true;
    });
  }, [cars, filters]);

  const hasActiveFilters = Boolean(
    filters.q.trim() || filters.statut || filters.publication || filters.vedette
  );
  const activeSheetFilterCount =
    Number(Boolean(filters.statut)) +
    Number(Boolean(filters.publication)) +
    Number(Boolean(filters.vedette));

  // Optimistic toggle: Featured (max 6) with Undo toast
  const handleToggleFeatured = async (car: CarRow, skipUndo = false) => {
    const prevVal = car.featured;
    const nextVal = !prevVal;
    if (nextVal && counters.featured >= 6) {
      pushToast("error", t("toasts.featuredLimit"));
      return;
    }

    setBusy(car.id, true);
    setCars((prev) =>
      prev.map((c) => (c.id === car.id ? { ...c, featured: nextVal } : c))
    );

    const res = await toggleFeaturedAction(car.id, nextVal);
    setBusy(car.id, false);

    if (!res.ok) {
      setCars((prev) =>
        prev.map((c) => (c.id === car.id ? { ...c, featured: prevVal } : c))
      );
      pushToast(
        "error",
        resolveAdminError(tAdmin, res.error, res.errorParams) ||
          t("toasts.updateError")
      );
      return;
    }

    const carName = `${car.brand} ${car.model}`;
    pushToast(
      "success",
      nextVal
        ? t("toasts.featuredAdded", { car: carName })
        : t("toasts.featuredRemoved", { car: carName }),
      skipUndo
        ? undefined
        : {
            actionLabel: t("toasts.undo"),
            onAction: () => {
              void handleToggleFeatured({ ...car, featured: nextVal }, true);
            },
          }
    );
  };

  // Optimistic toggle: Published / Hidden with Undo toast
  const handleTogglePublished = async (car: CarRow, skipUndo = false) => {
    const prevVal = car.published;
    const nextVal = !prevVal;
    setBusy(car.id, true);
    setCars((prev) =>
      prev.map((c) => (c.id === car.id ? { ...c, published: nextVal } : c))
    );

    const res = await togglePublishedAction(car.id, nextVal);
    setBusy(car.id, false);

    if (!res.ok) {
      setCars((prev) =>
        prev.map((c) => (c.id === car.id ? { ...c, published: prevVal } : c))
      );
      pushToast(
        "error",
        resolveAdminError(tAdmin, res.error, res.errorParams) ||
          t("toasts.updateError")
      );
      return;
    }

    const carName = `${car.brand} ${car.model}`;
    pushToast(
      "success",
      nextVal
        ? t("toasts.publishedOn", { car: carName })
        : t("toasts.publishedOff", { car: carName }),
      skipUndo
        ? undefined
        : {
            actionLabel: t("toasts.undo"),
            onAction: () => {
              void handleTogglePublished({ ...car, published: nextVal }, true);
            },
          }
    );
  };

  // Optimistic status change
  const handleStatusChange = async (car: CarRow, nextStatus: CarStatus) => {
    if (nextStatus === car.status) return;
    const prevStatus = car.status;

    setBusy(car.id, true);
    setCars((prev) =>
      prev.map((c) => (c.id === car.id ? { ...c, status: nextStatus } : c))
    );

    const res = await updateCarStatusAction(car.id, nextStatus);
    setBusy(car.id, false);

    if (!res.ok) {
      setCars((prev) =>
        prev.map((c) => (c.id === car.id ? { ...c, status: prevStatus } : c))
      );
      pushToast(
        "error",
        resolveAdminError(tAdmin, res.error, res.errorParams) ||
          t("toasts.statusError")
      );
      return;
    }

    pushToast(
      "success",
      t("toasts.statusUpdated", {
        status: tEnums(STATUS_LABEL_KEY[nextStatus]),
      })
    );
  };

  // Duplicate
  const handleDuplicate = async (car: CarRow) => {
    setBusy(car.id, true);
    const res = await duplicateCarAction(car.id);
    setBusy(car.id, false);

    if (!res.ok || !res.data?.car) {
      pushToast(
        "error",
        resolveAdminError(tAdmin, res.error, res.errorParams) ||
          t("toasts.duplicateError")
      );
      return;
    }

    setCars((prev) => [res.data!.car, ...prev]);
    pushToast("success", t("toasts.duplicated", { slug: res.data.car.slug }));
  };

  // Delete confirmed
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setIsDeleting(true);

    const res = await deleteCarAction(target.id);
    setIsDeleting(false);
    setDeleteTarget(null);

    if (!res.ok) {
      pushToast(
        "error",
        resolveAdminError(tAdmin, res.error, res.errorParams) ||
          t("toasts.deleteError")
      );
      return;
    }

    setCars((prev) => prev.filter((c) => c.id !== target.id));
    pushToast(
      "success",
      t("toasts.deletedCar", { car: `${target.brand} ${target.model}` })
    );
  };

  const renderPrice = (car: CarRow) =>
    formatCarPrice(
      { price: car.price ?? 0, priceOnRequest: car.price_on_request },
      locale,
      tCommon("priceOnRequest")
    );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 pb-24 sm:px-6 sm:py-8 lg:pb-8 space-y-6">
      {/* Header Row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-navy-700/80 pb-6">
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-ivory">
            {t("title")}
          </h1>
          <p className="mt-1 text-sm text-silver">{t("subtitle")}</p>
        </div>

        <Link
          href="/admin/cars/new"
          className="hidden lg:inline-flex min-h-[46px] items-center justify-center rounded-xl bg-brand-red px-5 py-2.5 text-sm font-semibold text-ivory shadow-sm transition-opacity hover:opacity-95"
        >
          {t("addVehicle")}
        </Link>
      </div>

      {/* KPI Counters */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: t("kpi.total"), value: formatNumber(counters.total, locale) },
          {
            label: t("kpi.published"),
            value: formatNumber(counters.published, locale),
          },
          {
            label: t("kpi.drafts"),
            value: formatNumber(counters.drafts, locale),
          },
          {
            label: t("kpi.featured"),
            value: `${formatNumber(counters.featured, locale)}/6`,
          },
          { label: t("kpi.sold"), value: formatNumber(counters.sold, locale) },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-navy-700/80 bg-navy-900 p-4"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider text-silver">
              {stat.label}
            </p>
            <p className="mt-1 font-serif text-2xl font-semibold text-ivory">
              <bdi>{stat.value}</bdi>
            </p>
          </div>
        ))}
      </div>

      {/* Error State with Retry */}
      {initialError && (
        <div
          role="alert"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-brand-red/60 bg-brand-red/10 p-5"
        >
          <div>
            <p className="text-sm font-semibold text-ivory">{t("loadError")}</p>
            <p className="mt-0.5 text-xs text-silver">{initialError}</p>
          </div>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-xl bg-brand-red px-4 py-2 text-sm font-semibold text-ivory hover:opacity-95"
          >
            {tAdmin("retry")}
          </button>
        </div>
      )}

      {/* MOBILE STICKY SEARCH + FILTER SHEET TRIGGER (< lg) */}
      <div className="sticky top-16 z-20 -mx-4 border-y border-navy-700/80 bg-navy-950/95 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <label htmlFor="admin-search-mobile" className="sr-only">
              {t("searchAria")}
            </label>
            <input
              id="admin-search-mobile"
              type="search"
              enterKeyHint="search"
              value={filters.q}
              onChange={(e) => updateFilters({ ...filters, q: e.target.value })}
              placeholder={t("searchMobilePlaceholder")}
              className="min-h-[44px] w-full rounded-xl border border-navy-700 bg-navy-900 px-3.5 py-2.5 text-base text-ivory placeholder:text-silver/50 focus:border-silver/60 focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() => setFilterSheetOpen(true)}
            aria-expanded={filterSheetOpen}
            aria-controls="admin-filter-sheet"
            className={`inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl border px-3.5 text-sm font-medium transition-colors ${
              activeSheetFilterCount > 0
                ? "border-brand-red/70 bg-brand-red/15 text-ivory"
                : "border-navy-700 bg-navy-900 text-ivory hover:border-silver/50"
            }`}
          >
            <span>{t("filters")}</span>
            {activeSheetFilterCount > 0 && (
              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-red px-1.5 text-[11px] font-bold text-ivory">
                {activeSheetFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* DESKTOP SEARCH & FILTER BAR (lg+, URL synced) */}
      <section
        aria-label={t("filtersAria")}
        className="hidden lg:block rounded-2xl border border-navy-700/80 bg-navy-900 p-4"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
          <div className="sm:col-span-2 lg:col-span-4">
            <label htmlFor="admin-search" className="sr-only">
              {t("searchAria")}
            </label>
            <input
              id="admin-search"
              type="search"
              value={filters.q}
              onChange={(e) => updateFilters({ ...filters, q: e.target.value })}
              placeholder={t("searchPlaceholder")}
              className="min-h-[44px] w-full rounded-xl border border-navy-700 bg-navy-950 px-3.5 py-2.5 text-sm text-ivory placeholder:text-silver/50 focus:border-silver/60 focus:outline-none"
            />
          </div>

          <div className="lg:col-span-3">
            <label htmlFor="admin-filter-statut" className="sr-only">
              {t("filter.statusAria")}
            </label>
            <select
              id="admin-filter-statut"
              value={filters.statut}
              onChange={(e) =>
                updateFilters({
                  ...filters,
                  statut: e.target.value as "" | CarStatus,
                })
              }
              className="min-h-[44px] w-full rounded-xl border border-navy-700 bg-navy-950 px-3.5 py-2.5 text-sm text-ivory"
            >
              <option value="">{t("filter.statusAll")}</option>
              {STATUS_OPTIONS.map((st) => (
                <option key={st} value={st}>
                  {tEnums(STATUS_LABEL_KEY[st])}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <label htmlFor="admin-filter-publication" className="sr-only">
              {t("filter.visibilityAria")}
            </label>
            <select
              id="admin-filter-publication"
              value={filters.publication}
              onChange={(e) =>
                updateFilters({
                  ...filters,
                  publication: e.target.value as PublicationFilter,
                })
              }
              className="min-h-[44px] w-full rounded-xl border border-navy-700 bg-navy-950 px-3.5 py-2.5 text-sm text-ivory"
            >
              <option value="">{t("filter.visibilityAll")}</option>
              <option value="published">{t("filter.published")}</option>
              <option value="hidden">{t("filter.hidden")}</option>
            </select>
          </div>

          <div className="lg:col-span-2">
            <label htmlFor="admin-filter-vedette" className="sr-only">
              {t("filter.featuredAria")}
            </label>
            <select
              id="admin-filter-vedette"
              value={filters.vedette}
              onChange={(e) =>
                updateFilters({
                  ...filters,
                  vedette: e.target.value as FeaturedFilter,
                })
              }
              className="min-h-[44px] w-full rounded-xl border border-navy-700 bg-navy-950 px-3.5 py-2.5 text-sm text-ivory"
            >
              <option value="">{t("filter.featuredAll")}</option>
              <option value="yes">{t("filter.featured")}</option>
              <option value="no">{t("filter.standard")}</option>
            </select>
          </div>

          <div className="lg:col-span-1 flex items-center">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-navy-700 bg-navy-950 px-3 text-xs font-medium text-silver hover:border-silver/50 hover:text-ivory"
              >
                {t("clear")}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Empty States */}
      {!initialError && cars.length === 0 ? (
        <div className="rounded-2xl border border-navy-700 bg-navy-900 p-10 text-center space-y-4">
          <p className="font-serif text-xl font-semibold text-ivory">
            {t("emptyCatalog")}
          </p>
          <Link
            href="/admin/cars/new"
            className="inline-flex min-h-[46px] items-center justify-center rounded-xl bg-brand-red px-5 py-2.5 text-sm font-semibold text-ivory hover:opacity-95"
          >
            {t("addVehicle")}
          </Link>
        </div>
      ) : !initialError && filteredCars.length === 0 ? (
        <div className="rounded-2xl border border-navy-700 bg-navy-900 p-10 text-center space-y-4">
          <p className="text-base font-medium text-ivory">
            {t("emptyFiltered")}
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-navy-700 bg-navy-950 px-5 py-2.5 text-sm font-medium text-ivory hover:border-silver/50"
          >
            {t("resetFilters")}
          </button>
        </div>
      ) : (
        <>
          {/* DESKTOP TABLE (lg+) */}
          <div className="hidden lg:block overflow-hidden rounded-2xl border border-navy-700/80 bg-navy-900">
            <table className="w-full border-collapse text-start text-sm">
              <thead>
                <tr className="border-b border-navy-700/80 bg-navy-950/60 text-[11px] font-semibold uppercase tracking-wider text-silver">
                  <th className="py-3.5 ps-4 pe-3">{t("table.photo")}</th>
                  <th className="px-3 py-3.5">{t("table.vehicle")}</th>
                  <th className="px-3 py-3.5">{t("table.price")}</th>
                  <th className="px-3 py-3.5">{t("table.status")}</th>
                  <th className="px-3 py-3.5 text-center">
                    {t("table.featured")}
                  </th>
                  <th className="px-3 py-3.5 text-center">
                    {t("table.published")}
                  </th>
                  <th className="px-3 py-3.5">{t("table.updatedAt")}</th>
                  <th className="py-3.5 ps-3 pe-4 text-end">
                    {t("table.actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-700/60">
                {filteredCars.map((car) => {
                  const isBusy = busyIds.has(car.id);
                  const thumb = getCoverThumb(car);
                  const carName = `${car.brand} ${car.model}`;
                  return (
                    <tr
                      key={car.id}
                      className="transition-colors hover:bg-navy-950/40"
                    >
                      <td className="py-3 ps-4 pe-3">
                        <div className="h-12 w-16 overflow-hidden rounded-lg border border-navy-700 bg-navy-950">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={thumb}
                            alt={carName}
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src =
                                "/images/showroom-hero.jpg";
                            }}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        <p className="font-medium text-ivory">
                          <bdi>{carName}</bdi>{" "}
                          <span className="text-silver font-normal">
                            ({car.year})
                          </span>
                        </p>
                        <p
                          dir="ltr"
                          className="mt-0.5 font-mono text-xs text-start text-silver/80"
                        >
                          {car.slug}
                        </p>
                      </td>

                      <td className="px-3 py-3 whitespace-nowrap font-medium text-ivory">
                        <bdi>{renderPrice(car)}</bdi>
                      </td>

                      <td className="px-3 py-3">
                        <select
                          aria-label={t("card.statusAria", { car: carName })}
                          disabled={isBusy}
                          value={car.status}
                          onChange={(e) =>
                            void handleStatusChange(
                              car,
                              e.target.value as CarStatus
                            )
                          }
                          className={`min-h-[38px] rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${statusSelectStyle(
                            car.status
                          )}`}
                        >
                          {STATUS_OPTIONS.map((st) => (
                            <option
                              key={st}
                              value={st}
                              className="bg-navy-950 text-ivory"
                            >
                              {tEnums(STATUS_LABEL_KEY[st])}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="px-3 py-3 text-center">
                        <ToggleSwitch
                          checked={car.featured}
                          disabled={isBusy}
                          label={t("card.featuredAria", { car: carName })}
                          onToggle={() => void handleToggleFeatured(car)}
                        />
                      </td>

                      <td className="px-3 py-3 text-center">
                        <ToggleSwitch
                          checked={car.published}
                          disabled={isBusy}
                          label={t("card.publishedAria", { car: carName })}
                          onToggle={() => void handleTogglePublished(car)}
                        />
                      </td>

                      <td className="px-3 py-3 whitespace-nowrap text-xs text-silver">
                        {formatUpdatedDate(car.updated_at, locale)}
                      </td>

                      <td className="py-3 ps-3 pe-4 text-end">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <Link
                            href={`/admin/cars/${car.id}/edit`}
                            className="inline-flex min-h-[38px] items-center rounded-lg border border-navy-700 bg-navy-950 px-3 text-xs font-medium text-ivory hover:border-silver/50"
                          >
                            {t("card.edit")}
                          </Link>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleDuplicate(car)}
                            className="inline-flex min-h-[38px] items-center rounded-lg border border-navy-700 bg-navy-950 px-3 text-xs font-medium text-silver hover:border-silver/50 hover:text-ivory disabled:opacity-50"
                          >
                            {t("card.duplicate")}
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => setDeleteTarget(car)}
                            className="inline-flex min-h-[38px] items-center rounded-lg border border-brand-red/50 bg-brand-red/10 px-3 text-xs font-medium text-ivory hover:bg-brand-red disabled:opacity-50"
                          >
                            {t("card.delete")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* MOBILE & TABLET STACKED CARDS (< lg, zero horizontal scroll) */}
          <div className="grid grid-cols-1 gap-4 lg:hidden">
            {filteredCars.map((car) => {
              const isBusy = busyIds.has(car.id);
              const thumb = getCoverThumb(car);
              const carName = `${car.brand} ${car.model}`;
              return (
                <article
                  key={car.id}
                  data-car-slug={car.slug}
                  className="rounded-2xl border border-navy-700 bg-navy-900 p-4 space-y-4"
                >
                  {/* Top: Thumb + Title + Price */}
                  <div className="flex items-start gap-3.5">
                    <div className="h-16 w-20 shrink-0 overflow-hidden rounded-xl border border-navy-700 bg-navy-950">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={thumb}
                        alt={carName}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src =
                            "/images/showroom-hero.jpg";
                        }}
                        className="h-16 w-20 object-cover"
                        loading="lazy"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="font-serif text-lg font-semibold leading-snug text-ivory">
                        <bdi>{carName}</bdi> ({car.year})
                      </p>
                      <p
                        dir="ltr"
                        className="mt-0.5 truncate font-mono text-xs text-start text-silver/80"
                      >
                        {car.slug}
                      </p>
                      <p className="mt-1.5 text-sm font-semibold text-ivory">
                        <bdi>{renderPrice(car)}</bdi>
                      </p>
                    </div>
                  </div>

                  {/* Middle: Status + Toggles */}
                  <div className="grid grid-cols-1 gap-3 border-y border-navy-700/60 py-3.5 sm:grid-cols-3 sm:items-center">
                    <div>
                      <label
                        htmlFor={`mobile-status-${car.id}`}
                        className="block text-[11px] font-semibold uppercase tracking-wider text-silver mb-1"
                      >
                        {t("filter.statusLabel")}
                      </label>
                      <select
                        id={`mobile-status-${car.id}`}
                        disabled={isBusy}
                        value={car.status}
                        onChange={(e) =>
                          void handleStatusChange(
                            car,
                            e.target.value as CarStatus
                          )
                        }
                        className={`min-h-[44px] w-full rounded-xl border px-3 py-2 text-base font-semibold ${statusSelectStyle(
                          car.status
                        )}`}
                      >
                        {STATUS_OPTIONS.map((st) => (
                          <option
                            key={st}
                            value={st}
                            className="bg-navy-950 text-ivory"
                          >
                            {tEnums(STATUS_LABEL_KEY[st])}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center justify-between sm:justify-start sm:gap-3 rounded-xl border border-navy-700/60 bg-navy-950/60 px-3.5 py-2.5">
                      <span className="text-xs font-medium text-ivory">
                        {t("table.featured")}
                      </span>
                      <ToggleSwitch
                        checked={car.featured}
                        disabled={isBusy}
                        label={t("card.featuredAria", { car: carName })}
                        onToggle={() => void handleToggleFeatured(car)}
                      />
                    </div>

                    <div className="flex items-center justify-between sm:justify-start sm:gap-3 rounded-xl border border-navy-700/60 bg-navy-950/60 px-3.5 py-2.5">
                      <span className="text-xs font-medium text-ivory">
                        {car.published
                          ? t("filter.published")
                          : t("filter.hidden")}
                      </span>
                      <ToggleSwitch
                        checked={car.published}
                        disabled={isBusy}
                        label={t("card.publishedAria", { car: carName })}
                        onToggle={() => void handleTogglePublished(car)}
                      />
                    </div>
                  </div>

                  {/* Bottom: Updated date + Large Action Buttons */}
                  <div className="space-y-3">
                    <p className="text-xs text-silver">
                      {t("card.updatedOn", {
                        date: formatUpdatedDate(car.updated_at, locale),
                      })}
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <Link
                        href={`/admin/cars/${car.id}/edit`}
                        className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-navy-700 bg-navy-950 px-3 text-xs font-semibold text-ivory hover:border-silver/50"
                      >
                        {t("card.edit")}
                      </Link>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleDuplicate(car)}
                        className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-navy-700 bg-navy-950 px-3 text-xs font-medium text-silver hover:border-silver/50 hover:text-ivory disabled:opacity-50"
                      >
                        {t("card.duplicate")}
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => setDeleteTarget(car)}
                        className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-brand-red/60 bg-brand-red/10 px-3 text-xs font-semibold text-ivory hover:bg-brand-red disabled:opacity-50"
                      >
                        {t("card.delete")}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      {/* MOBILE FLOATING "+ Ajouter" BUTTON (above safe area, inline-end) */}
      <Link
        href="/admin/cars/new"
        className="lg:hidden fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] end-4 z-30 inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-brand-red px-5 text-sm font-semibold text-ivory shadow-xl shadow-black/50 transition-opacity hover:opacity-95"
      >
        <span aria-hidden="true" className="text-lg leading-none">
          +
        </span>
        <span>{t("addShort")}</span>
      </Link>

      {/* MOBILE BOTTOM-SHEET FILTER DRAWER */}
      {filterSheetOpen && (
        <div
          id="admin-filter-sheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-filter-sheet-title"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) setFilterSheetOpen(false);
          }}
        >
          <div
            ref={filterSheetRef}
            className="w-full max-h-[85svh] overflow-y-auto rounded-t-2xl border-t border-navy-700 bg-navy-900 px-5 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl space-y-5"
          >
            <div className="mx-auto h-1.5 w-12 rounded-full bg-navy-700" />

            <div className="flex items-center justify-between gap-3">
              <h2
                id="admin-filter-sheet-title"
                className="font-serif text-xl font-semibold text-ivory"
              >
                {t("filtersHeading")}
              </h2>
              <button
                type="button"
                onClick={() => setFilterSheetOpen(false)}
                aria-label={t("closeFilters")}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-navy-700 bg-navy-950 text-lg text-silver hover:text-ivory"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="sheet-filter-statut"
                  className="block text-xs font-semibold uppercase tracking-wider text-silver mb-1.5"
                >
                  {t("filter.statusLabel")}
                </label>
                <select
                  id="sheet-filter-statut"
                  value={filters.statut}
                  onChange={(e) =>
                    updateFilters({
                      ...filters,
                      statut: e.target.value as "" | CarStatus,
                    })
                  }
                  className="min-h-[46px] w-full rounded-xl border border-navy-700 bg-navy-950 px-3.5 py-2.5 text-base text-ivory"
                >
                  <option value="">{t("filter.statusAllMobile")}</option>
                  {STATUS_OPTIONS.map((st) => (
                    <option key={st} value={st}>
                      {tEnums(STATUS_LABEL_KEY[st])}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="sheet-filter-publication"
                  className="block text-xs font-semibold uppercase tracking-wider text-silver mb-1.5"
                >
                  {t("filter.visibilityLabel")}
                </label>
                <select
                  id="sheet-filter-publication"
                  value={filters.publication}
                  onChange={(e) =>
                    updateFilters({
                      ...filters,
                      publication: e.target.value as PublicationFilter,
                    })
                  }
                  className="min-h-[46px] w-full rounded-xl border border-navy-700 bg-navy-950 px-3.5 py-2.5 text-base text-ivory"
                >
                  <option value="">{t("filter.visibilityAllMobile")}</option>
                  <option value="published">{t("filter.published")}</option>
                  <option value="hidden">{t("filter.hiddenDraft")}</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="sheet-filter-vedette"
                  className="block text-xs font-semibold uppercase tracking-wider text-silver mb-1.5"
                >
                  {t("filter.featuredLabel")}
                </label>
                <select
                  id="sheet-filter-vedette"
                  value={filters.vedette}
                  onChange={(e) =>
                    updateFilters({
                      ...filters,
                      vedette: e.target.value as FeaturedFilter,
                    })
                  }
                  className="min-h-[46px] w-full rounded-xl border border-navy-700 bg-navy-950 px-3.5 py-2.5 text-base text-ivory"
                >
                  <option value="">{t("filter.featuredAllMobile")}</option>
                  <option value="yes">{t("filter.featured")}</option>
                  <option value="no">{t("filter.standard")}</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => {
                    resetFilters();
                    setFilterSheetOpen(false);
                  }}
                  className="inline-flex min-h-[46px] items-center justify-center rounded-xl border border-navy-700 bg-navy-950 px-4 text-sm font-medium text-silver hover:text-ivory"
                >
                  {t("clear")}
                </button>
              )}
              <button
                type="button"
                onClick={() => setFilterSheetOpen(false)}
                className="inline-flex min-h-[46px] flex-1 items-center justify-center rounded-xl bg-brand-red px-5 text-sm font-semibold text-ivory shadow-sm hover:opacity-95"
              >
                {t("viewResults", { count: filteredCars.length })}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={t("deleteDialog.title")}
        message={
          deleteTarget
            ? t("deleteDialog.message", {
                car: `${deleteTarget.brand} ${deleteTarget.model}`,
              })
            : t("deleteDialog.messageGeneric")
        }
        confirmLabel={t("deleteDialog.confirm")}
        pending={isDeleting}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Toast Notifications */}
      <AdminToastHost toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
