"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  checkSlugAvailabilityAction,
  createCarAction,
  deleteCarAction,
  updateCarAction,
} from "@/lib/actions/cars";
import { cleanupUnsavedCloudinaryImagesAction } from "@/lib/actions/cloudinary";
import { resolveAdminError } from "@/lib/admin-errors";
import {
  BODY_TYPE_LABEL_KEY,
  CONDITION_LABEL_KEY,
  FUEL_LABEL_KEY,
  STATUS_LABEL_KEY,
  TRANSMISSION_LABEL_KEY,
} from "@/lib/labels";
import {
  BODY_TYPE_VALUES,
  carSchema,
  CONDITION_VALUES,
  FUEL_VALUES,
  MAX_MODEL_YEAR,
  STATUS_VALUES,
  TRANSMISSION_VALUES,
} from "@/lib/validation/car";
import {
  ImageUploader,
  sendUnsavedCleanupBeacon,
} from "@/components/admin/ImageUploader";
import {
  CarPreviewCard,
  type PreviewLocale,
} from "@/components/admin/CarPreviewCard";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { COLOR_PRESETS } from "@/lib/colors";
import type {
  BodyType,
  CarCondition,
  CarImage,
  CarRow,
  CarStatus,
  FuelType,
  TransmissionType,
} from "@/types/database";

const DEFAULT_BRANDS = [
  "Audi",
  "Volkswagen",
  "Mercedes-Benz",
  "Opel",
  "Geely",
  "MG",
  "Porsche",
  "Livan",
];

const FEATURE_SUGGESTIONS: Record<PreviewLocale, string[]> = {
  fr: [
    "Climatisation automatique",
    "Caméra de recul",
    "Caméra 360°",
    "Toit ouvrant panoramique",
    "Apple CarPlay / Android Auto",
    "Sièges en cuir",
    "Sièges chauffants",
    "Régulateur de vitesse adaptatif",
    "Feux Matrix LED",
    "Capteurs de stationnement",
    "Jantes alliage",
    "Démarrage sans clé",
  ],
  en: [
    "Automatic climate control",
    "Rear-view camera",
    "360° camera",
    "Panoramic sunroof",
    "Apple CarPlay / Android Auto",
    "Leather seats",
    "Heated seats",
    "Adaptive cruise control",
    "Matrix LED headlights",
    "Parking sensors",
    "Alloy wheels",
    "Keyless start",
  ],
  ar: [
    "تكييف أوتوماتيكي",
    "كاميرا خلفية",
    "كاميرا 360 درجة",
    "سقف بانورامي قابل للفتح",
    "Apple CarPlay / Android Auto",
    "مقاعد جلدية",
    "مقاعد مدفأة",
    "مثبت سرعة تكيفي",
    "مصابيح Matrix LED",
    "حساسات ركن",
    "جنوط ألمنيوم",
    "تشغيل بدون مفتاح",
  ],
};

const LANG_TABS: Array<{ id: PreviewLocale; label: string; short: string }> = [
  { id: "fr", label: "Français", short: "FR" },
  { id: "en", label: "English", short: "EN" },
  { id: "ar", label: "العربية", short: "AR" },
];

interface CarFormProps {
  mode: "create" | "edit";
  initialCar?: CarRow;
  existingBrands?: string[];
  currentFeaturedCount: number;
}

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function formatThousands(val: number | null): string {
  if (val === null || Number.isNaN(val)) return "";
  return String(val).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function parseDigits(raw: string): number | null {
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return null;
  const parsed = Number.parseInt(digits, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-ivory/30 border-t-ivory"
    />
  );
}

function CollapsibleSection({
  title,
  badge,
  badgeComplete = false,
  defaultOpen = true,
  children,
}: {
  title: string;
  badge: string;
  badgeComplete?: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-2xl border border-navy-700/80 bg-navy-900"
    >
      <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 sm:px-6 [&::-webkit-details-marker]:hidden">
        <span className="font-serif text-lg sm:text-xl font-semibold text-ivory">
          {title}
        </span>
        <span className="flex shrink-0 items-center gap-2.5">
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${
              badgeComplete
                ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
                : "border-navy-700 bg-navy-950 text-silver"
            }`}
          >
            {badge}
          </span>
          <span
            aria-hidden="true"
            className="inline-block text-silver transition-transform duration-200 group-open:rotate-180"
          >
            &#9662;
          </span>
        </span>
      </summary>
      <div className="border-t border-navy-700/60 px-5 pb-5 pt-4 sm:px-6 sm:pb-6 space-y-4">
        {children}
      </div>
    </details>
  );
}

export function CarForm({
  mode,
  initialCar,
  existingBrands = [],
  currentFeaturedCount,
}: CarFormProps) {
  const router = useRouter();
  const adminLocale = useLocale();
  const tAdmin = useTranslations("admin");
  const t = useTranslations("admin.form");
  const tEnums = useTranslations("enums");
  const isEdit = mode === "edit" && Boolean(initialCar);

  const brandOptions = Array.from(
    new Set([...DEFAULT_BRANDS, ...existingBrands])
  ).sort();

  // Form fields
  const [images, setImages] = useState<CarImage[]>(
    Array.isArray(initialCar?.images) ? (initialCar.images as CarImage[]) : []
  );
  const [brand, setBrand] = useState(initialCar?.brand ?? "");
  const [model, setModel] = useState(initialCar?.model ?? "");
  const [year, setYear] = useState<number>(
    initialCar?.year ?? new Date().getFullYear()
  );
  const [condition, setCondition] = useState<CarCondition>(
    initialCar?.condition ?? "Neuf"
  );
  const [bodyType, setBodyType] = useState<BodyType>(
    initialCar?.body_type ?? "SUV"
  );
  const [price, setPrice] = useState<number | null>(initialCar?.price ?? null);
  const [priceOnRequest, setPriceOnRequest] = useState<boolean>(
    initialCar?.price_on_request ?? false
  );
  const [mileage, setMileage] = useState<number>(initialCar?.mileage ?? 0);
  const [fuel, setFuel] = useState<FuelType>(initialCar?.fuel ?? "Diesel");
  const [transmission, setTransmission] = useState<TransmissionType>(
    initialCar?.transmission ?? "Automatique"
  );
  const [engine, setEngine] = useState(initialCar?.engine ?? "");
  const [power, setPower] = useState(initialCar?.power ?? "");
  const [color, setColor] = useState(initialCar?.color ?? "");
  const [doors, setDoors] = useState<string>(
    initialCar?.doors != null ? String(initialCar.doors) : "5"
  );
  const [seats, setSeats] = useState<string>(
    initialCar?.seats != null ? String(initialCar.seats) : "5"
  );
  const [activeLangTab, setActiveLangTab] = useState<PreviewLocale>("fr");
  const [description, setDescription] = useState(initialCar?.description ?? "");
  const [descriptionEn, setDescriptionEn] = useState(
    initialCar?.description_en ?? ""
  );
  const [descriptionAr, setDescriptionAr] = useState(
    initialCar?.description_ar ?? ""
  );
  const [features, setFeatures] = useState<string[]>(
    Array.isArray(initialCar?.features) ? initialCar.features : []
  );
  const [featuresEn, setFeaturesEn] = useState<string[]>(
    Array.isArray(initialCar?.features_en) ? initialCar.features_en : []
  );
  const [featuresAr, setFeaturesAr] = useState<string[]>(
    Array.isArray(initialCar?.features_ar) ? initialCar.features_ar : []
  );
  const [featureInput, setFeatureInput] = useState("");
  const [status, setStatus] = useState<CarStatus>(
    initialCar?.status ?? "Disponible"
  );
  const [featured, setFeatured] = useState<boolean>(
    initialCar?.featured ?? false
  );
  const [published, setPublished] = useState<boolean>(
    initialCar?.published ?? true
  );
  const [slug, setSlug] = useState(initialCar?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [slugSuggestion, setSlugSuggestion] = useState<string | null>(null);

  // Meta / UI states
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [submittingIntent, setSubmittingIntent] = useState<
    null | "save" | "save-and-view"
  >(null);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const unsavedUploadedIdsRef = useRef<string[]>([]);
  const savedSuccessfullyRef = useRef(false);
  const priceInputRef = useRef<HTMLInputElement>(null);
  const mileageInputRef = useRef<HTMLInputElement>(null);
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  // Track virtual keyboard height via visualViewport so mobile save bar never jumps
  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;
    const vv = window.visualViewport;
    const updateOffset = () => {
      const offset = Math.max(
        0,
        Math.round(window.innerHeight - vv.height - vv.offsetTop)
      );
      setKeyboardOffset(offset);
    };
    updateOffset();
    vv.addEventListener("resize", updateOffset);
    vv.addEventListener("scroll", updateOffset);
    return () => {
      vv.removeEventListener("resize", updateOffset);
      vv.removeEventListener("scroll", updateOffset);
    };
  }, []);

  // Preserve caret position when formatting thousands separators while typing
  const handleFormattedNumericChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    inputRef: React.RefObject<HTMLInputElement | null>,
    onValue: (parsed: number | null) => void
  ) => {
    const raw = e.target.value;
    const selectionStart = e.target.selectionStart ?? raw.length;
    const digitsBeforeCaret = raw
      .slice(0, selectionStart)
      .replace(/[^0-9]/g, "").length;
    const parsed = parseDigits(raw);
    onValue(parsed);

    const formatted = formatThousands(parsed);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el || document.activeElement !== el) return;
      let seenDigits = 0;
      let nextPos = formatted.length;
      for (let i = 0; i < formatted.length; i += 1) {
        if (seenDigits === digitsBeforeCaret) {
          nextPos = i;
          break;
        }
        if (/[0-9]/.test(formatted[i])) {
          seenDigits += 1;
        }
      }
      try {
        el.setSelectionRange(nextPos, nextPos);
      } catch {
        // Ignore on unsupported input types
      }
    });
  };

  // Featured count excluding self when editing
  const otherFeaturedCount =
    isEdit && initialCar?.featured
      ? Math.max(0, currentFeaturedCount - 1)
      : currentFeaturedCount;
  const featuredLimitReached = !featured && otherFeaturedCount >= 6;

  // Auto-generate slug from brand + model + year unless user edited slug manually
  useEffect(() => {
    if (slugTouched) return;
    const generated = slugify(`${brand} ${model} ${year || ""}`);
    setSlug(generated);
  }, [brand, model, year, slugTouched]);

  // Warn on browser tab close / reload when dirty, and send cleanup beacon for unsaved uploads
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty && !savedSuccessfullyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const handlePageHide = () => {
      if (!savedSuccessfullyRef.current && unsavedUploadedIdsRef.current.length > 0) {
        sendUnsavedCleanupBeacon(unsavedUploadedIdsRef.current);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [isDirty]);

  const markDirty = () => {
    if (!isDirty) setIsDirty(true);
  };

  const clearFieldError = (field: string) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const scrollToFirstError = (errors: Record<string, string>) => {
    const firstKey = Object.keys(errors)[0];
    if (!firstKey) return;
    if (firstKey === "description") setActiveLangTab("fr");
    if (firstKey === "description_en") setActiveLangTab("en");
    if (firstKey === "description_ar") setActiveLangTab("ar");
    const domKey =
      firstKey === "description_en" || firstKey === "description_ar"
        ? "description"
        : firstKey;
    const el =
      document.getElementById(`field-${domKey}`) ??
      document.querySelector(`[data-field="${domKey}"]`);
    if (el instanceof HTMLElement) {
      // Ensure any collapsed parent <details> section opens before scrolling
      const parentDetails = el.closest("details");
      if (parentDetails && !parentDetails.open) {
        parentDetails.open = true;
      }
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus?.({ preventScroll: true });
    }
  };

  const handleSlugBlur = async () => {
    const clean = slugify(slug);
    if (clean !== slug) setSlug(clean);
    if (!clean) return;

    const res = await checkSlugAvailabilityAction(clean, initialCar?.id);
    if (!res.available && res.suggestion) {
      setSlugSuggestion(res.suggestion);
      setFieldErrors((prev) => ({
        ...prev,
        slug: resolveAdminError(tAdmin, "serverErrors.slugTaken", {
          suggestion: res.suggestion!,
        }),
      }));
    } else {
      setSlugSuggestion(null);
      clearFieldError("slug");
    }
  };

  const activeDescription =
    activeLangTab === "en"
      ? descriptionEn
      : activeLangTab === "ar"
        ? descriptionAr
        : description;

  const setActiveDescription = (val: string) => {
    if (activeLangTab === "en") {
      setDescriptionEn(val);
      clearFieldError("description_en");
    } else if (activeLangTab === "ar") {
      setDescriptionAr(val);
      clearFieldError("description_ar");
    } else {
      setDescription(val);
      clearFieldError("description");
    }
    markDirty();
  };

  const activeFeatures =
    activeLangTab === "en"
      ? featuresEn
      : activeLangTab === "ar"
        ? featuresAr
        : features;

  const setActiveFeatures = (updater: (prev: string[]) => string[]) => {
    if (activeLangTab === "en") {
      setFeaturesEn(updater);
    } else if (activeLangTab === "ar") {
      setFeaturesAr(updater);
    } else {
      setFeatures(updater);
    }
  };

  const addFeature = (raw: string) => {
    const parts = raw
      .split(/[,،]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    setActiveFeatures((prev) => {
      const next = [...prev];
      for (const clean of parts) {
        if (!next.some((f) => f.toLowerCase() === clean.toLowerCase())) {
          next.push(clean);
        }
      }
      return next;
    });
    markDirty();
    setFeatureInput("");
  };

  const removeFeature = (index: number) => {
    setActiveFeatures((prev) => prev.filter((_, i) => i !== index));
    markDirty();
  };

  const copyFrenchToActiveTab = () => {
    if (activeLangTab === "en") {
      setDescriptionEn(description);
      setFeaturesEn([...features]);
      clearFieldError("description_en");
      markDirty();
    } else if (activeLangTab === "ar") {
      setDescriptionAr(description);
      setFeaturesAr([...features]);
      clearFieldError("description_ar");
      markDirty();
    }
  };

  const buildPayload = () => ({
    slug: slug.trim(),
    brand: brand.trim(),
    model: model.trim(),
    year,
    price: priceOnRequest ? null : price,
    price_on_request: priceOnRequest,
    mileage,
    fuel,
    transmission,
    body_type: bodyType,
    color: color.trim() || null,
    power: power.trim() || null,
    engine: engine.trim() || null,
    doors: doors.trim() ? Number(doors) : null,
    seats: seats.trim() ? Number(seats) : null,
    condition,
    status,
    featured,
    published,
    description: description.trim(),
    description_en: descriptionEn.trim() || null,
    description_ar: descriptionAr.trim() || null,
    features,
    features_en: featuresEn,
    features_ar: featuresAr,
    images,
  });

  const handleSubmit = async (intent: "save" | "save-and-view") => {
    if (submittingIntent !== null) return;
    setFormError(null);

    const payload = buildPayload();
    const clientCheck = carSchema.safeParse(payload);
    if (!clientCheck.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of clientCheck.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!nextErrors[key]) {
          nextErrors[key] = resolveAdminError(tAdmin, issue.message);
        }
      }
      setFieldErrors(nextErrors);
      setFormError(t("errors.fixFields"));
      scrollToFirstError(nextErrors);
      return;
    }

    setFieldErrors({});
    setSubmittingIntent(intent);

    const result =
      isEdit && initialCar
        ? await updateCarAction(
            initialCar.id,
            payload,
            unsavedUploadedIdsRef.current,
            initialCar.updated_at
          )
        : await createCarAction(payload, unsavedUploadedIdsRef.current);

    if (!result.ok || !result.data) {
      setSubmittingIntent(null);
      if (result.fieldErrors) {
        const translatedFields: Record<string, string> = {};
        for (const [field, msgKey] of Object.entries(result.fieldErrors)) {
          translatedFields[field] = resolveAdminError(
            tAdmin,
            msgKey,
            result.errorParams
          );
        }
        if (result.errorParams?.suggestion) {
          setSlugSuggestion(String(result.errorParams.suggestion));
        }
        setFieldErrors(translatedFields);
        scrollToFirstError(translatedFields);
      }
      setFormError(
        resolveAdminError(tAdmin, result.error, result.errorParams) ||
          t("errors.saveFailed")
      );
      return;
    }

    // Success: mark saved so beforeunload & cleanup beacon do NOT fire
    savedSuccessfullyRef.current = true;
    unsavedUploadedIdsRef.current = [];
    setIsDirty(false);

    if (intent === "save-and-view") {
      const publicPrefix = adminLocale === "fr" ? "" : `/${adminLocale}`;
      window.open(
        `${publicPrefix}/vehicules/${result.data.slug}`,
        "_blank",
        "noopener,noreferrer"
      );
    }

    router.push(`/admin?toast=${isEdit ? "updated" : "created"}`);
    router.refresh();
  };

  const executeCancel = async () => {
    setConfirmCancelOpen(false);
    const toCleanup = [...unsavedUploadedIdsRef.current];
    unsavedUploadedIdsRef.current = [];
    savedSuccessfullyRef.current = true;
    if (toCleanup.length > 0) {
      await cleanupUnsavedCloudinaryImagesAction(toCleanup).catch(() => {});
    }
    router.push("/admin");
  };

  const handleCancelClick = () => {
    if (isDirty) {
      setConfirmCancelOpen(true);
    } else {
      void executeCancel();
    }
  };

  const handleDeleteCar = async () => {
    if (!initialCar) return;
    setIsDeleting(true);
    const res = await deleteCarAction(initialCar.id);
    setIsDeleting(false);
    setConfirmDeleteOpen(false);

    if (!res.ok) {
      setFormError(
        resolveAdminError(tAdmin, res.error, res.errorParams) ||
          t("errors.deleteFailed")
      );
      return;
    }

    savedSuccessfullyRef.current = true;
    router.push("/admin?toast=deleted");
    router.refresh();
  };

  const isSubmitting = submittingIntent !== null;
  const slugChangedOnPublished =
    isEdit &&
    Boolean(initialCar?.published) &&
    slug.trim() !== "" &&
    slug.trim() !== initialCar?.slug;

  const inputBase =
    "mt-1.5 min-h-[46px] w-full rounded-xl border bg-navy-950 px-3.5 py-2.5 text-base sm:text-sm text-ivory placeholder:text-silver/45 transition-colors focus:outline-none";

  // Section completion indicators
  const infoComplete = Boolean(brand.trim() && model.trim() && year >= 1990);
  const priceComplete = priceOnRequest || (price !== null && price > 0);
  const slugComplete = Boolean(slug.trim() && !fieldErrors.slug);

  const fieldBorder = (name: string) =>
    fieldErrors[name]
      ? "border-brand-red focus:border-brand-red"
      : "border-navy-700 hover:border-silver/50 focus:border-silver/70";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 pb-28 sm:px-6 sm:py-8 lg:pb-12">
      {/* Page Header */}
      <div className="flex flex-col gap-3 border-b border-navy-700/80 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-silver">
            {isEdit ? t("editEyebrow") : t("createEyebrow")}
          </p>
          <h1 className="mt-1 font-serif text-3xl font-semibold text-ivory">
            {isEdit ? (
              <bdi>
                {initialCar?.brand} {initialCar?.model}
              </bdi>
            ) : (
              t("createTitle")
            )}
          </h1>
        </div>

        {isEdit && initialCar && (
          <a
            href={`${adminLocale === "fr" ? "" : `/${adminLocale}`}/vehicules/${initialCar.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-navy-700 bg-navy-900 px-4 py-2 text-sm font-medium text-ivory hover:border-silver/50"
          >
            <span>{t("viewOnSite")}</span>
            <span aria-hidden="true" className="rtl:-scale-x-100">
              &nearr;
            </span>
          </a>
        )}
      </div>

      {formError && (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-brand-red/70 bg-brand-red/15 px-4 py-3.5 text-sm text-ivory"
        >
          {formError}
        </div>
      )}

      {/* Main Grid: Form (8 cols) + Sticky Preview & Save Bar (4 cols on desktop) */}
      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
        <div className="space-y-6 lg:col-span-8">
          {/* SECTION 1: PHOTOS */}
          <CollapsibleSection
            title={t("sections.photos")}
            badge={t("sections.photosBadge", { count: images.length })}
            badgeComplete={images.length > 0}
          >
            <ImageUploader
              value={images}
              onChange={(next) => {
                setImages(next);
                markDirty();
              }}
              onUploadedPublicId={(pid) => {
                unsavedUploadedIdsRef.current.push(pid);
              }}
            />
          </CollapsibleSection>

          {/* SECTION 2: INFORMATIONS PRINCIPALES */}
          <CollapsibleSection
            title={t("sections.info")}
            badge={infoComplete ? t("sections.infoOk") : t("sections.required")}
            badgeComplete={infoComplete}
          >

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="field-brand"
                  className="block text-xs font-semibold uppercase tracking-wider text-silver"
                >
                  {t("fields.brand")}
                </label>
                <input
                  id="field-brand"
                  list="brand-suggestions"
                  value={brand}
                  onChange={(e) => {
                    setBrand(e.target.value);
                    clearFieldError("brand");
                    markDirty();
                  }}
                  placeholder={t("fields.brandPlaceholder")}
                  className={`${inputBase} ${fieldBorder("brand")}`}
                />
                <datalist id="brand-suggestions">
                  {brandOptions.map((b) => (
                    <option key={b} value={b} />
                  ))}
                </datalist>
                {fieldErrors.brand && (
                  <p className="mt-1.5 text-xs text-brand-red">
                    {fieldErrors.brand}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="field-model"
                  className="block text-xs font-semibold uppercase tracking-wider text-silver"
                >
                  {t("fields.model")}
                </label>
                <input
                  id="field-model"
                  value={model}
                  onChange={(e) => {
                    setModel(e.target.value);
                    clearFieldError("model");
                    markDirty();
                  }}
                  placeholder={t("fields.modelPlaceholder")}
                  className={`${inputBase} ${fieldBorder("model")}`}
                />
                {fieldErrors.model && (
                  <p className="mt-1.5 text-xs text-brand-red">
                    {fieldErrors.model}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="field-year"
                  className="block text-xs font-semibold uppercase tracking-wider text-silver"
                >
                  {t("fields.year")}
                </label>
                <input
                  id="field-year"
                  type="number"
                  dir="ltr"
                  inputMode="numeric"
                  min={1990}
                  max={MAX_MODEL_YEAR}
                  value={year || ""}
                  onChange={(e) => {
                    setYear(Number(e.target.value));
                    clearFieldError("year");
                    markDirty();
                  }}
                  className={`${inputBase} text-start ${fieldBorder("year")}`}
                />
                {fieldErrors.year && (
                  <p className="mt-1.5 text-xs text-brand-red">
                    {fieldErrors.year}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="field-condition"
                  className="block text-xs font-semibold uppercase tracking-wider text-silver"
                >
                  {t("fields.condition")}
                </label>
                <select
                  id="field-condition"
                  value={condition}
                  onChange={(e) => {
                    setCondition(e.target.value as CarCondition);
                    clearFieldError("condition");
                    markDirty();
                  }}
                  className={`${inputBase} ${fieldBorder("condition")}`}
                >
                  {CONDITION_VALUES.map((val) => (
                    <option key={val} value={val}>
                      {tEnums(CONDITION_LABEL_KEY[val])}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="field-body_type"
                  className="block text-xs font-semibold uppercase tracking-wider text-silver"
                >
                  {t("fields.bodyType")}
                </label>
                <select
                  id="field-body_type"
                  value={bodyType}
                  onChange={(e) => {
                    setBodyType(e.target.value as BodyType);
                    clearFieldError("body_type");
                    markDirty();
                  }}
                  className={`${inputBase} ${fieldBorder("body_type")}`}
                >
                  {BODY_TYPE_VALUES.map((val) => (
                    <option key={val} value={val}>
                      {tEnums(BODY_TYPE_LABEL_KEY[val])}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CollapsibleSection>

          {/* SECTION 3: PRIX */}
          <CollapsibleSection
            title={t("sections.price")}
            badge={priceComplete ? t("sections.priceOk") : t("sections.required")}
            badgeComplete={priceComplete}
          >

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-end">
              <div>
                <label
                  htmlFor="field-price"
                  className="block text-xs font-semibold uppercase tracking-wider text-silver"
                >
                  {t("fields.price")} {!priceOnRequest && "*"}
                </label>
                <div className="relative">
                  <input
                    ref={priceInputRef}
                    id="field-price"
                    type="text"
                    dir="ltr"
                    inputMode="numeric"
                    disabled={priceOnRequest}
                    value={priceOnRequest ? "" : formatThousands(price)}
                    onChange={(e) => {
                      handleFormattedNumericChange(e, priceInputRef, (val) => {
                        setPrice(val);
                      });
                      clearFieldError("price");
                      markDirty();
                    }}
                    placeholder={t("fields.pricePlaceholder")}
                    className={`${inputBase} text-start pe-12 ${fieldBorder("price")} disabled:opacity-45 disabled:cursor-not-allowed`}
                  />
                  <span className="pointer-events-none absolute end-3.5 top-1/2 mt-0.5 -translate-y-1/2 text-xs font-semibold text-silver">
                    {t("fields.currencyShort")}
                  </span>
                </div>
                {fieldErrors.price && (
                  <p className="mt-1.5 text-xs text-brand-red">
                    {fieldErrors.price}
                  </p>
                )}
              </div>

              <label className="flex min-h-[46px] cursor-pointer items-center justify-between gap-3 rounded-xl border border-navy-700 bg-navy-950 px-4 py-2.5">
                <span className="text-sm font-medium text-ivory">
                  {t("fields.priceOnRequest")}
                </span>
                <input
                  type="checkbox"
                  checked={priceOnRequest}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setPriceOnRequest(checked);
                    if (checked) {
                      setPrice(null);
                      clearFieldError("price");
                    }
                    markDirty();
                  }}
                  className="h-5 w-5 accent-brand-red"
                />
              </label>
            </div>
          </CollapsibleSection>

          {/* SECTION 4: CARACTÉRISTIQUES */}
          <CollapsibleSection
            title={t("sections.specs")}
            badge={`${tEnums(FUEL_LABEL_KEY[fuel])} · ${tEnums(TRANSMISSION_LABEL_KEY[transmission])}`}
            badgeComplete
          >

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="field-mileage"
                  className="block text-xs font-semibold uppercase tracking-wider text-silver"
                >
                  {t("fields.mileage")}
                </label>
                <input
                  ref={mileageInputRef}
                  id="field-mileage"
                  type="text"
                  dir="ltr"
                  inputMode="numeric"
                  value={formatThousands(mileage)}
                  onChange={(e) => {
                    handleFormattedNumericChange(e, mileageInputRef, (val) => {
                      setMileage(val ?? 0);
                    });
                    clearFieldError("mileage");
                    markDirty();
                  }}
                  placeholder="0"
                  className={`${inputBase} text-start ${fieldBorder("mileage")}`}
                />
                {fieldErrors.mileage && (
                  <p className="mt-1.5 text-xs text-brand-red">
                    {fieldErrors.mileage}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="field-fuel"
                  className="block text-xs font-semibold uppercase tracking-wider text-silver"
                >
                  {t("fields.fuel")}
                </label>
                <select
                  id="field-fuel"
                  value={fuel}
                  onChange={(e) => {
                    setFuel(e.target.value as FuelType);
                    markDirty();
                  }}
                  className={`${inputBase} ${fieldBorder("fuel")}`}
                >
                  {FUEL_VALUES.map((val) => (
                    <option key={val} value={val}>
                      {tEnums(FUEL_LABEL_KEY[val])}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="field-transmission"
                  className="block text-xs font-semibold uppercase tracking-wider text-silver"
                >
                  {t("fields.transmission")}
                </label>
                <select
                  id="field-transmission"
                  value={transmission}
                  onChange={(e) => {
                    setTransmission(e.target.value as TransmissionType);
                    markDirty();
                  }}
                  className={`${inputBase} ${fieldBorder("transmission")}`}
                >
                  {TRANSMISSION_VALUES.map((val) => (
                    <option key={val} value={val}>
                      {tEnums(TRANSMISSION_LABEL_KEY[val])}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="field-engine"
                  className="block text-xs font-semibold uppercase tracking-wider text-silver"
                >
                  {t("fields.engine")}
                </label>
                <input
                  id="field-engine"
                  dir="ltr"
                  value={engine}
                  onChange={(e) => {
                    setEngine(e.target.value);
                    markDirty();
                  }}
                  placeholder={t("fields.enginePlaceholder")}
                  className={`${inputBase} text-start ${fieldBorder("engine")}`}
                />
              </div>

              <div>
                <label
                  htmlFor="field-power"
                  className="block text-xs font-semibold uppercase tracking-wider text-silver"
                >
                  {t("fields.power")}
                </label>
                <input
                  id="field-power"
                  dir="ltr"
                  value={power}
                  onChange={(e) => {
                    setPower(e.target.value);
                    markDirty();
                  }}
                  placeholder={t("fields.powerPlaceholder")}
                  className={`${inputBase} text-start ${fieldBorder("power")}`}
                />
              </div>

              <div>
                <label
                  htmlFor="field-color"
                  className="block text-xs font-semibold uppercase tracking-wider text-silver"
                >
                  {t("fields.color")}
                </label>
                <input
                  id="field-color"
                  list="color-suggestions"
                  value={color}
                  onChange={(e) => {
                    setColor(e.target.value);
                    markDirty();
                  }}
                  placeholder={t("fields.colorPlaceholder")}
                  className={`${inputBase} ${fieldBorder("color")}`}
                />
                <datalist id="color-suggestions">
                  {COLOR_PRESETS.map((preset) => (
                    <option key={preset.fr} value={preset.fr} />
                  ))}
                </datalist>
              </div>

              <div>
                <label
                  htmlFor="field-doors"
                  className="block text-xs font-semibold uppercase tracking-wider text-silver"
                >
                  {t("fields.doors")}
                </label>
                <input
                  id="field-doors"
                  type="number"
                  dir="ltr"
                  inputMode="numeric"
                  min={2}
                  max={6}
                  value={doors}
                  onChange={(e) => {
                    setDoors(e.target.value);
                    clearFieldError("doors");
                    markDirty();
                  }}
                  className={`${inputBase} text-start ${fieldBorder("doors")}`}
                />
                {fieldErrors.doors && (
                  <p className="mt-1.5 text-xs text-brand-red">
                    {fieldErrors.doors}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="field-seats"
                  className="block text-xs font-semibold uppercase tracking-wider text-silver"
                >
                  {t("fields.seats")}
                </label>
                <input
                  id="field-seats"
                  type="number"
                  dir="ltr"
                  inputMode="numeric"
                  min={1}
                  max={9}
                  value={seats}
                  onChange={(e) => {
                    setSeats(e.target.value);
                    clearFieldError("seats");
                    markDirty();
                  }}
                  className={`${inputBase} text-start ${fieldBorder("seats")}`}
                />
                {fieldErrors.seats && (
                  <p className="mt-1.5 text-xs text-brand-red">
                    {fieldErrors.seats}
                  </p>
                )}
              </div>
            </div>
          </CollapsibleSection>

          {/* SECTION 5: DESCRIPTION & ÉQUIPEMENTS */}
          <CollapsibleSection
            title={t("sections.content")}
            badge={`${t("sections.featuresBadge", { count: features.length })} · FR${
              descriptionEn.trim() || featuresEn.length > 0 ? "/EN" : ""
            }${descriptionAr.trim() || featuresAr.length > 0 ? "/AR" : ""}`}
            badgeComplete={description.trim().length > 0}
          >
            {/* Language Tabs (independent from admin UI language) */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div
                role="tablist"
                aria-label={t("langTabs.ariaLabel")}
                className="inline-flex rounded-xl border border-navy-700 bg-navy-950 p-1"
              >
                {LANG_TABS.map((tab) => {
                  const isActive = activeLangTab === tab.id;
                  const hasContent =
                    tab.id === "fr"
                      ? description.trim().length > 0 || features.length > 0
                      : tab.id === "en"
                        ? descriptionEn.trim().length > 0 ||
                          featuresEn.length > 0
                        : descriptionAr.trim().length > 0 ||
                          featuresAr.length > 0;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => {
                        setActiveLangTab(tab.id);
                        setFeatureInput("");
                      }}
                      className={`inline-flex min-h-[40px] items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-brand-red text-ivory shadow-sm"
                          : "text-silver hover:text-ivory"
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span
                        aria-hidden="true"
                        className={`h-1.5 w-1.5 rounded-full ${
                          hasContent
                            ? isActive
                              ? "bg-ivory"
                              : "bg-emerald-400"
                            : "bg-navy-700"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>

              {activeLangTab !== "fr" && (
                <div className="flex flex-wrap items-center gap-2">
                  {activeDescription.trim().length === 0 &&
                    activeFeatures.length === 0 && (
                      <span className="inline-flex items-center rounded-full border border-amber-400/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-200">
                        {t("langTabs.emptyFallback")}
                      </span>
                    )}
                  <button
                    type="button"
                    onClick={copyFrenchToActiveTab}
                    className="inline-flex min-h-[38px] items-center justify-center rounded-xl border border-navy-700 bg-navy-950 px-3 py-1.5 text-xs font-medium text-ivory transition-colors hover:border-silver/50"
                  >
                    {t("langTabs.copyFromFrench")}
                  </button>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="field-description"
                  className="block text-xs font-semibold uppercase tracking-wider text-silver"
                >
                  {activeLangTab === "fr"
                    ? t("fields.descriptionFr")
                    : activeLangTab === "en"
                      ? t("fields.descriptionEn")
                      : t("fields.descriptionAr")}
                </label>
                <span dir="ltr" className="text-xs font-mono text-silver/80">
                  {activeDescription.length} / 2000
                </span>
              </div>
              <textarea
                id="field-description"
                dir={activeLangTab === "ar" ? "rtl" : "ltr"}
                lang={activeLangTab}
                rows={4}
                maxLength={2000}
                value={activeDescription}
                onChange={(e) => setActiveDescription(e.target.value)}
                placeholder={
                  activeLangTab === "en"
                    ? t("fields.descriptionPlaceholderEn")
                    : activeLangTab === "ar"
                      ? t("fields.descriptionPlaceholderAr")
                      : t("fields.descriptionPlaceholderFr")
                }
                className={`mt-1.5 w-full rounded-xl border bg-navy-950 px-3.5 py-3 text-base sm:text-sm text-ivory placeholder:text-silver/45 focus:outline-none ${fieldBorder(
                  activeLangTab === "fr"
                    ? "description"
                    : activeLangTab === "en"
                      ? "description_en"
                      : "description_ar"
                )}`}
              />
              {activeLangTab === "fr" && fieldErrors.description && (
                <p className="mt-1.5 text-xs text-brand-red">
                  {fieldErrors.description}
                </p>
              )}
              {activeLangTab === "en" && fieldErrors.description_en && (
                <p className="mt-1.5 text-xs text-brand-red">
                  {fieldErrors.description_en}
                </p>
              )}
              {activeLangTab === "ar" && fieldErrors.description_ar && (
                <p className="mt-1.5 text-xs text-brand-red">
                  {fieldErrors.description_ar}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="field-features-input"
                className="block text-xs font-semibold uppercase tracking-wider text-silver"
              >
                {t("fields.features", { count: activeFeatures.length })}
              </label>

              <div className="mt-1.5 flex gap-2">
                <input
                  id="field-features-input"
                  dir={activeLangTab === "ar" ? "rtl" : "ltr"}
                  lang={activeLangTab}
                  enterKeyHint="done"
                  value={featureInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val.includes(",") || val.includes("،")) {
                      const chunks = val.split(/[,،]/);
                      const tail = chunks.pop() ?? "";
                      const toAdd = chunks.join(",");
                      if (toAdd.trim()) addFeature(toAdd);
                      setFeatureInput(tail);
                    } else {
                      setFeatureInput(val);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addFeature(featureInput);
                    }
                  }}
                  placeholder={
                    activeLangTab === "en"
                      ? t("fields.featuresPlaceholderEn")
                      : activeLangTab === "ar"
                        ? t("fields.featuresPlaceholderAr")
                        : t("fields.featuresPlaceholderFr")
                  }
                  className="min-h-[46px] min-w-0 flex-1 rounded-xl border border-navy-700 bg-navy-950 px-3.5 py-2.5 text-base sm:text-sm text-ivory placeholder:text-silver/45 focus:border-silver/70 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => addFeature(featureInput)}
                  className="inline-flex min-h-[46px] shrink-0 items-center justify-center rounded-xl border border-navy-700 bg-navy-950 px-4 text-sm font-medium text-ivory hover:border-silver/50"
                >
                  {t("fields.addFeature")}
                </button>
              </div>

              {/* Active Feature Tags */}
              {activeFeatures.length > 0 && (
                <div
                  dir={activeLangTab === "ar" ? "rtl" : "ltr"}
                  className="mt-3 flex flex-wrap gap-2"
                >
                  {activeFeatures.map((feat, idx) => (
                    <span
                      key={`${activeLangTab}-${feat}-${idx}`}
                      className="inline-flex min-h-[36px] items-center gap-2 rounded-full border border-navy-700 bg-navy-950 px-3 py-1 text-xs font-medium text-ivory"
                    >
                      <span>{feat}</span>
                      <button
                        type="button"
                        onClick={() => removeFeature(idx)}
                        aria-label={t("fields.removeFeature", {
                          feature: feat,
                        })}
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-silver hover:bg-brand-red hover:text-ivory"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Quick-add Suggestions */}
              <div className="mt-4">
                <p className="text-[11px] font-medium uppercase tracking-wider text-silver/80 mb-2">
                  {t("fields.quickSuggestions")}
                </p>
                <div
                  dir={activeLangTab === "ar" ? "rtl" : "ltr"}
                  className="flex flex-wrap gap-1.5"
                >
                  {FEATURE_SUGGESTIONS[activeLangTab]
                    .filter(
                      (s) =>
                        !activeFeatures.some(
                          (f) => f.toLowerCase() === s.toLowerCase()
                        )
                    )
                    .map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => addFeature(suggestion)}
                        className="inline-flex min-h-[34px] items-center gap-1 rounded-full border border-navy-700/80 bg-navy-950/60 px-3 py-1 text-xs text-silver transition-colors hover:border-silver/50 hover:text-ivory"
                      >
                        <span aria-hidden="true">+</span>
                        <span>{suggestion}</span>
                      </button>
                    ))}
                </div>
              </div>
            </div>
          </CollapsibleSection>

          {/* SECTION 6: PUBLICATION */}
          <CollapsibleSection
            title={t("sections.publication")}
            badge={`${tEnums(STATUS_LABEL_KEY[status])} · ${
              published ? t("sections.published") : t("sections.hidden")
            }`}
            badgeComplete={published}
          >

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label
                  htmlFor="field-status"
                  className="block text-xs font-semibold uppercase tracking-wider text-silver"
                >
                  {t("fields.status")}
                </label>
                <select
                  id="field-status"
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value as CarStatus);
                    markDirty();
                  }}
                  className={`${inputBase} ${fieldBorder("status")}`}
                >
                  {STATUS_VALUES.map((st) => (
                    <option key={st} value={st}>
                      {tEnums(STATUS_LABEL_KEY[st])}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col justify-end">
                <label
                  data-field="featured"
                  className="flex min-h-[46px] cursor-pointer items-center justify-between gap-3 rounded-xl border border-navy-700 bg-navy-950 px-4 py-2.5"
                >
                  <div>
                    <span className="block text-sm font-medium text-ivory">
                      {t("fields.featured")}
                    </span>
                    <span className="block text-[11px] text-silver">
                      {t("fields.featuredActive", {
                        count: otherFeaturedCount + (featured ? 1 : 0),
                      })}
                    </span>
                  </div>
                  <input
                    id="field-featured"
                    type="checkbox"
                    checked={featured}
                    onChange={(e) => {
                      const next = e.target.checked;
                      if (next && featuredLimitReached) {
                        setFieldErrors((prev) => ({
                          ...prev,
                          featured: resolveAdminError(
                            tAdmin,
                            "serverErrors.featuredLimit"
                          ),
                        }));
                        return;
                      }
                      setFeatured(next);
                      clearFieldError("featured");
                      markDirty();
                    }}
                    className="h-5 w-5 accent-brand-red"
                  />
                </label>
                {fieldErrors.featured && (
                  <p className="mt-1.5 text-xs text-brand-red">
                    {fieldErrors.featured}
                  </p>
                )}
              </div>

              <div className="flex flex-col justify-end">
                <label className="flex min-h-[46px] cursor-pointer items-center justify-between gap-3 rounded-xl border border-navy-700 bg-navy-950 px-4 py-2.5">
                  <div>
                    <span className="block text-sm font-medium text-ivory">
                      {t("fields.published")}
                    </span>
                    <span className="block text-[11px] text-silver">
                      {published
                        ? t("fields.publishedVisible")
                        : t("fields.publishedHidden")}
                    </span>
                  </div>
                  <input
                    id="field-published"
                    type="checkbox"
                    checked={published}
                    onChange={(e) => {
                      setPublished(e.target.checked);
                      markDirty();
                    }}
                    className="h-5 w-5 accent-brand-red"
                  />
                </label>
              </div>
            </div>
          </CollapsibleSection>

          {/* SECTION 7: SLUG */}
          <CollapsibleSection
            title={t("sections.slug")}
            badge={slugComplete ? t("sections.slugOk") : t("sections.required")}
            badgeComplete={slugComplete}
            defaultOpen={isEdit}
          >

            <div>
              <label
                htmlFor="field-slug"
                className="block text-xs font-semibold uppercase tracking-wider text-silver"
              >
                {t("fields.slug")}
              </label>
              <div
                dir="ltr"
                className="mt-1.5 flex items-center rounded-xl border border-navy-700 bg-navy-950 overflow-hidden focus-within:border-silver/70"
              >
                <span className="hidden sm:inline-block border-e border-navy-700/80 bg-navy-900 px-3 py-3 font-mono text-xs text-silver">
                  /vehicules/
                </span>
                <input
                  id="field-slug"
                  dir="ltr"
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(e.target.value);
                    setSlugSuggestion(null);
                    clearFieldError("slug");
                    markDirty();
                  }}
                  onBlur={() => void handleSlugBlur()}
                  placeholder={t("fields.slugPlaceholder")}
                  className="min-h-[46px] w-full bg-transparent px-3.5 py-2.5 font-mono text-base sm:text-sm text-start text-ivory placeholder:text-silver/45 focus:outline-none"
                />
              </div>

              {fieldErrors.slug && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-brand-red">
                  <span>{fieldErrors.slug}</span>
                  {slugSuggestion && (
                    <button
                      type="button"
                      onClick={() => {
                        setSlug(slugSuggestion);
                        setSlugSuggestion(null);
                        clearFieldError("slug");
                      }}
                      className="rounded-lg border border-brand-red/60 px-2.5 py-1 font-mono text-ivory hover:bg-brand-red"
                    >
                      {t("fields.useSuggestion", {
                        suggestion: slugSuggestion,
                      })}
                    </button>
                  )}
                </div>
              )}

              {slugChangedOnPublished && (
                <div
                  role="alert"
                  className="mt-2.5 rounded-xl border border-amber-400/50 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-200"
                >
                  {t("fields.slugPublishedWarning")}
                </div>
              )}
            </div>
          </CollapsibleSection>

          {/* DANGER ZONE (Edit mode only) */}
          {isEdit && initialCar && (
            <section className="rounded-2xl border border-brand-red/50 bg-brand-red/5 p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-serif text-lg font-semibold text-ivory">
                    {t("danger.title")}
                  </h2>
                  <p className="mt-1 text-xs text-silver">
                    {t("danger.description")}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={isSubmitting || isDeleting}
                  onClick={() => setConfirmDeleteOpen(true)}
                  className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-xl border border-brand-red bg-brand-red/15 px-4 py-2.5 text-sm font-semibold text-ivory transition-colors hover:bg-brand-red disabled:opacity-50"
                >
                  {t("danger.deleteButton")}
                </button>
              </div>
            </section>
          )}
        </div>

        {/* RIGHT STICKY COLUMN (Desktop): Live Preview + Save Bar */}
        <aside className="hidden lg:block lg:col-span-4 lg:sticky lg:top-24 space-y-5">
          <div className="rounded-2xl border border-navy-700/80 bg-navy-900 p-5 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-silver">
              {t("actions.title")}
            </h2>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => void handleSubmit("save")}
              className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-brand-red px-5 py-3 text-sm font-semibold text-ivory shadow-sm transition-opacity hover:opacity-95 disabled:opacity-60"
            >
              {submittingIntent === "save" && <Spinner />}
              <span>{t("actions.save")}</span>
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => void handleSubmit("save-and-view")}
              className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl border border-navy-700 bg-navy-950 px-5 py-2.5 text-sm font-medium text-ivory transition-colors hover:border-silver/50 disabled:opacity-60"
            >
              {submittingIntent === "save-and-view" && <Spinner />}
              <span>{t("actions.saveAndView")}</span>
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleCancelClick}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl px-4 py-2 text-sm font-medium text-silver transition-colors hover:text-ivory disabled:opacity-50"
            >
              {t("actions.cancel")}
            </button>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-silver">
                {t("preview.title")}
              </p>
              <span className="rounded-full border border-navy-700 bg-navy-900 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-ivory">
                {activeLangTab.toUpperCase()}
              </span>
            </div>
            <CarPreviewCard
              brand={brand}
              model={model}
              year={year}
              price={price}
              priceOnRequest={priceOnRequest}
              mileage={mileage}
              fuel={fuel}
              transmission={transmission}
              condition={condition}
              status={status}
              published={published}
              images={images}
              previewLocale={activeLangTab}
            />
          </div>
        </aside>
      </div>

      {/* MOBILE STICKY BOTTOM SAVE BAR (visualViewport keyboard-aware) */}
      <div
        style={{ bottom: `${keyboardOffset}px` }}
        className={`fixed inset-x-0 z-40 border-t border-navy-700 bg-navy-950/95 px-4 pt-3 backdrop-blur-md transition-[bottom] duration-150 lg:hidden ${
          keyboardOffset > 0
            ? "pb-3"
            : "pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
        }`}
      >
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleCancelClick}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-navy-700 bg-navy-900 px-3.5 text-xs font-medium text-silver hover:text-ivory disabled:opacity-50"
          >
            {t("actions.cancel")}
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => void handleSubmit("save-and-view")}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-navy-700 bg-navy-900 px-3 text-xs font-medium text-ivory hover:border-silver/50 disabled:opacity-60"
          >
            {submittingIntent === "save-and-view" && <Spinner />}
            <span className="truncate">{t("actions.saveAndViewShort")}</span>
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => void handleSubmit("save")}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-red px-4 text-xs font-semibold text-ivory shadow-sm hover:opacity-95 disabled:opacity-60"
          >
            {submittingIntent === "save" && <Spinner />}
            <span>{t("actions.save")}</span>
          </button>
        </div>
      </div>

      {/* Confirm Cancel Dialog */}
      <ConfirmDialog
        open={confirmCancelOpen}
        title={t("dialogs.cancelTitle")}
        message={t("dialogs.cancelMessage")}
        confirmLabel={t("dialogs.cancelConfirm")}
        cancelLabel={t("dialogs.cancelKeepEditing")}
        onConfirm={() => void executeCancel()}
        onCancel={() => setConfirmCancelOpen(false)}
      />

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={confirmDeleteOpen}
        title={t("dialogs.deleteTitle")}
        message={t("dialogs.deleteMessage")}
        confirmLabel={t("dialogs.deleteConfirm")}
        pending={isDeleting}
        onConfirm={() => void handleDeleteCar()}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </div>
  );
}
