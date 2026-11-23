"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { WEEKLY_OPENING_HOURS } from "@/lib/config";

const WEEKDAY_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

interface AlgiersTimeState {
  dayIndex: number;
  isOpenNow: boolean;
  localTimeStr: string;
}

function computeAlgiersStatus(): AlgiersTimeState {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Algiers",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const weekdayShort =
    parts.find((p) => p.type === "weekday")?.value ?? "Sat";
  const hourStr = parts.find((p) => p.type === "hour")?.value ?? "12";
  const minuteStr = parts.find((p) => p.type === "minute")?.value ?? "00";

  const dayIndex = WEEKDAY_MAP[weekdayShort] ?? 6;
  const hour = Number(hourStr) % 24;
  const minute = Number(minuteStr);
  const totalMinutes = hour * 60 + minute;

  const todaySchedule = WEEKLY_OPENING_HOURS.find(
    (d) => d.dayIndex === dayIndex
  );
  const isOpenNow =
    Boolean(todaySchedule?.isOpenDay) &&
    totalMinutes >= 9 * 60 &&
    totalMinutes < 18 * 60;

  return {
    dayIndex,
    isOpenNow,
    localTimeStr: `${String(hour).padStart(2, "0")}:${String(minute).padStart(
      2,
      "0"
    )}`,
  };
}

export function OpeningHoursStatus() {
  const t = useTranslations("location");
  const [state, setState] = useState<AlgiersTimeState | null>(null);

  useEffect(() => {
    setState(computeAlgiersStatus());
    const interval = setInterval(() => {
      setState(computeAlgiersStatus());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="rounded-xl border border-navy-700 bg-navy-900 p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-navy-700/70 pb-5">
        <div>
          <h2 className="mt-1 font-serif text-2xl sm:text-3xl font-semibold text-ivory">
            {t("hoursHeading")}
          </h2>
        </div>

        {/* Live Open / Closed badge */}
        {state ? (
          <div
            role="status"
            className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold ${state.isOpenNow
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : "border-brand-red/50 bg-brand-red/15 text-ivory"
              }`}
          >
            <span
              aria-hidden="true"
              className={`h-2 w-2 rounded-full ${state.isOpenNow ? "bg-emerald-400" : "bg-brand-red"
                }`}
            />
            <span>{state.isOpenNow ? t("openNow") : t("closedNow")}</span>
            <span className="text-silver font-normal">
              {t("algiersTime", { time: state.localTimeStr })}
            </span>
          </div>
        ) : (
          <div className="h-7 w-40 animate-pulse rounded-full bg-navy-950" />
        )}
      </div>

      {/* Opening hours table with today's row highlighted */}
      <div className="mt-5 overflow-hidden rounded-xl border border-navy-700/80">
        <table className="w-full border-collapse text-start text-sm">
          <thead className="sr-only">
            <tr>
              <th scope="col">{t("tableDay")}</th>
              <th scope="col">{t("tableHours")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-700/60">
            {WEEKLY_OPENING_HOURS.map((row) => {
              const isToday = state?.dayIndex === row.dayIndex;
              const hoursText =
                row.isOpenDay && row.open && row.close
                  ? `${row.open} – ${row.close}`
                  : t("closed");
              return (
                <tr
                  key={row.key}
                  className={
                    isToday
                      ? "bg-brand-red/15 text-ivory font-semibold"
                      : "bg-navy-950/40 text-silver"
                  }
                >
                  <th
                    scope="row"
                    className="px-4 py-3.5 font-medium flex items-center gap-2.5"
                  >
                    <span>{t(`days.${row.key}`)}</span>
                    {isToday && (
                      <span className="rounded-full bg-brand-red px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ivory">
                        {t("today")}
                      </span>
                    )}
                  </th>
                  <td
                    className={`px-4 py-3.5 text-end ${!row.isOpenDay
                        ? "text-silver font-medium"
                        : isToday
                          ? "text-ivory"
                          : "text-ivory/90"
                      }`}
                  >
                    {hoursText}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
