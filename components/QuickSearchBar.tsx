"use client";

import { FormEvent, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { FuelType } from "@/lib/car-types";
import { formatCurrencyDZD } from "@/lib/format";
import { FUEL_LABEL_KEY, FUEL_TO_SLUG } from "@/lib/labels";

interface QuickSearchBarProps {
  brands: readonly string[];
  fuels: readonly FuelType[];
}

const BUDGET_VALUES = [
  "",
  "5000000",
  "10000000",
  "15000000",
  "20000000",
  "30000000",
] as const;

export function QuickSearchBar({ brands, fuels }: QuickSearchBarProps) {
  const locale = useLocale();
  const t = useTranslations("home.quickSearch");
  const tEnums = useTranslations("enums");
  const router = useRouter();
  const [marque, setMarque] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [carburant, setCarburant] = useState<FuelType | "">("");

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (marque) params.set("brand", marque);
    if (budgetMax) params.set("budgetMax", budgetMax);
    if (carburant) params.set("fuel", FUEL_TO_SLUG[carburant]);

    const queryString = params.toString();
    router.push(queryString ? `/vehicules?${queryString}` : "/vehicules");
  };

  return (
    <section
      aria-label={t("sectionLabel")}
      className="relative isolate border-b border-navy-700/60 bg-navy-950 py-8 sm:py-10"
    >
      <search className="container-site block">
        <form
          onSubmit={handleSubmit}
          aria-label={t("formLabel")}
          className="rounded-xl border border-navy-700 bg-navy-900 p-4 sm:p-6 shadow-xl"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
            {/* Marque */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="quick-search-marque"
                className="text-xs font-medium uppercase tracking-wider text-silver"
              >
                {t("brand")}
              </label>
              <select
                id="quick-search-marque"
                name="brand"
                value={marque}
                onChange={(e) => setMarque(e.target.value)}
                className="min-h-[44px] w-full rounded-xl border border-navy-700 bg-navy-950 px-3.5 py-2.5 text-sm text-ivory transition-colors hover:border-silver/50"
              >
                <option value="">{t("allBrands")}</option>
                {brands.map((brand) => (
                  <option key={brand} value={brand}>
                    {brand}
                  </option>
                ))}
              </select>
            </div>

            {/* Budget max */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="quick-search-budget"
                className="text-xs font-medium uppercase tracking-wider text-silver"
              >
                {t("maxBudget")}
              </label>
              <select
                id="quick-search-budget"
                name="budgetMax"
                value={budgetMax}
                onChange={(e) => setBudgetMax(e.target.value)}
                className="min-h-[44px] w-full rounded-xl border border-navy-700 bg-navy-950 px-3.5 py-2.5 text-sm text-ivory transition-colors hover:border-silver/50"
              >
                {BUDGET_VALUES.map((val) => (
                  <option key={val || "all"} value={val}>
                    {val
                      ? t("upToBudget", {
                          amount: formatCurrencyDZD(Number(val), locale),
                        })
                      : t("allBudgets")}
                  </option>
                ))}
              </select>
            </div>

            {/* Carburant */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="quick-search-carburant"
                className="text-xs font-medium uppercase tracking-wider text-silver"
              >
                {t("fuel")}
              </label>
              <select
                id="quick-search-carburant"
                name="fuel"
                value={carburant}
                onChange={(e) => setCarburant(e.target.value as FuelType | "")}
                className="min-h-[44px] w-full rounded-xl border border-navy-700 bg-navy-950 px-3.5 py-2.5 text-sm text-ivory transition-colors hover:border-silver/50"
              >
                <option value="">{t("allFuels")}</option>
                {fuels.map((fuel) => (
                  <option key={fuel} value={fuel}>
                    {tEnums(FUEL_LABEL_KEY[fuel])}
                  </option>
                ))}
              </select>
            </div>

            {/* Submit button */}
            <div className="flex flex-col">
              <button
                type="submit"
                className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-brand-red px-6 py-2.5 text-sm font-medium text-ivory shadow-sm transition-colors hover:bg-brand-red/90"
              >
                <svg
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                  />
                </svg>
                <span>{t("search")}</span>
              </button>
            </div>
          </div>
        </form>
      </search>
    </section>
  );
}
