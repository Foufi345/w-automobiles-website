"use client";

import { FormEvent, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { getWhatsAppUrl } from "@/lib/config";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";

interface VehicleOption {
  slug: string;
  label: string;
}

interface ContactFormProps {
  vehicles: readonly VehicleOption[];
}

interface FormValues {
  nom: string;
  telephone: string;
  vehicule: string;
  message: string;
}

interface FormErrors {
  nom?: string;
  telephone?: string;
  message?: string;
}

export function ContactForm({ vehicles }: ContactFormProps) {
  const t = useTranslations("contact.form");
  const tWa = useTranslations("whatsapp");

  const [values, setValues] = useState<FormValues>({
    nom: "",
    telephone: "",
    vehicule: "",
    message: "",
  });

  const [touched, setTouched] = useState<Record<keyof FormValues, boolean>>({
    nom: false,
    telephone: false,
    vehicule: false,
    message: false,
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState<"idle" | "error" | "success">("idle");
  const [submittedWaUrl, setSubmittedWaUrl] = useState("");

  const nomRef = useRef<HTMLInputElement | null>(null);
  const telRef = useRef<HTMLInputElement | null>(null);
  const msgRef = useRef<HTMLTextAreaElement | null>(null);

  const validateField = (
    field: keyof FormValues,
    val: string
  ): string | undefined => {
    const trimmed = val.trim();
    if (field === "nom") {
      if (!trimmed) return t("validation.nameRequired");
      if (trimmed.length < 2) return t("validation.nameMin");
    }
    if (field === "telephone") {
      if (!trimmed) return t("validation.phoneRequired");
      const digitsOnly = trimmed.replace(/[^0-9+]/g, "");
      if (digitsOnly.length < 8) {
        return t("validation.phoneInvalid");
      }
    }
    if (field === "message") {
      if (!trimmed) return t("validation.messageRequired");
      if (trimmed.length < 10) return t("validation.messageMin");
    }
    return undefined;
  };

  const handleBlur = (field: keyof FormValues) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const err = validateField(field, values[field]);
    setErrors((prev) => ({ ...prev, [field]: err }));
  };

  const handleChange = (field: keyof FormValues, newValue: string) => {
    setValues((prev) => ({ ...prev, [field]: newValue }));
    if (status === "error") setStatus("idle");

    if (touched[field] || errors[field as keyof FormErrors]) {
      const err = validateField(field, newValue);
      if (!err) {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const nomError = validateField("nom", values.nom);
    const telephoneError = validateField("telephone", values.telephone);
    const messageError = validateField("message", values.message);

    const nextErrors: FormErrors = {
      nom: nomError,
      telephone: telephoneError,
      message: messageError,
    };

    setTouched({
      nom: true,
      telephone: true,
      vehicule: true,
      message: true,
    });
    setErrors(nextErrors);

    if (nomError || telephoneError || messageError) {
      setStatus("error");
      if (nomError) nomRef.current?.focus();
      else if (telephoneError) telRef.current?.focus();
      else if (messageError) msgRef.current?.focus();
      return;
    }

    const vehicleLine = values.vehicule
      ? tWa("contactFormVehicleLine", { vehicle: values.vehicule })
      : "";
    const messageText = tWa("contactFormTemplate", {
      name: values.nom.trim(),
      phone: values.telephone.trim(),
      vehicleLine,
      message: values.message.trim(),
    });

    const whatsappUrl = getWhatsAppUrl(messageText);
    setSubmittedWaUrl(whatsappUrl);
    setStatus("success");

    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-labelledby="contact-form-heading"
      className="rounded-xl border border-navy-700 bg-navy-900 p-6 sm:p-8 space-y-6"
    >
      <div>
        <h2
          id="contact-form-heading"
          className="font-serif text-2xl sm:text-3xl font-semibold text-ivory"
        >
          {t("title")}
        </h2>
        <p className="mt-1.5 text-sm text-silver">{t("subtitle")}</p>
      </div>

      {/* Global Error / Success Banner */}
      <div aria-live="polite">
        {status === "error" && (
          <div
            role="alert"
            className="rounded-xl border border-brand-red bg-brand-red/15 p-4 text-sm text-ivory"
          >
            <p className="font-semibold">{t("errorBanner")}</p>
          </div>
        )}

        {status === "success" && (
          <div
            role="status"
            className="rounded-xl border border-emerald-500/50 bg-emerald-500/10 p-4 text-sm text-ivory space-y-2"
          >
            <p className="font-semibold text-emerald-300">
              {t("successTitle")}
            </p>
            <p className="text-xs text-silver">
              {t("successBodyPrefix")}{" "}
              <a
                href={submittedWaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-ivory underline underline-offset-4 hover:text-whatsapp-green"
              >
                {t("successLink")}
              </a>
              .
            </p>
          </div>
        )}
      </div>

      {/* Field 1: Nom */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="contact-nom"
          className="text-xs font-medium uppercase tracking-wider text-silver"
        >
          {t("nameLabel")}{" "}
          <span aria-hidden="true" className="text-brand-red">
            *
          </span>
        </label>
        <input
          ref={nomRef}
          id="contact-nom"
          name="nom"
          type="text"
          dir="auto"
          required
          autoComplete="name"
          enterKeyHint="next"
          value={values.nom}
          onChange={(e) => handleChange("nom", e.target.value)}
          onBlur={() => handleBlur("nom")}
          aria-invalid={errors.nom ? "true" : "false"}
          aria-describedby={errors.nom ? "contact-nom-error" : undefined}
          placeholder={t("namePlaceholder")}
          className={`min-h-[48px] w-full rounded-xl border bg-navy-950 px-4 py-3 text-base text-ivory placeholder:text-silver/45 transition-colors ${
            errors.nom
              ? "border-brand-red"
              : "border-navy-700 hover:border-silver/50"
          }`}
        />
        {errors.nom && (
          <p
            id="contact-nom-error"
            className="mt-0.5 flex items-center gap-1.5 text-xs text-ivory font-medium"
          >
            <span
              aria-hidden="true"
              className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-red text-[10px] font-bold text-ivory"
            >
              !
            </span>
            <span>{errors.nom}</span>
          </p>
        )}
      </div>

      {/* Field 2: Téléphone */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="contact-telephone"
          className="text-xs font-medium uppercase tracking-wider text-silver"
        >
          {t("phoneLabel")}{" "}
          <span aria-hidden="true" className="text-brand-red">
            *
          </span>
        </label>
        <input
          ref={telRef}
          id="contact-telephone"
          name="telephone"
          type="tel"
          dir="ltr"
          inputMode="tel"
          required
          autoComplete="tel"
          enterKeyHint="next"
          value={values.telephone}
          onChange={(e) => handleChange("telephone", e.target.value)}
          onBlur={() => handleBlur("telephone")}
          aria-invalid={errors.telephone ? "true" : "false"}
          aria-describedby={
            errors.telephone ? "contact-telephone-error" : undefined
          }
          placeholder={t("phonePlaceholder")}
          className={`min-h-[48px] w-full rounded-xl border bg-navy-950 px-4 py-3 text-base text-start text-ivory placeholder:text-silver/45 transition-colors ${
            errors.telephone
              ? "border-brand-red"
              : "border-navy-700 hover:border-silver/50"
          }`}
        />
        {errors.telephone && (
          <p
            id="contact-telephone-error"
            className="mt-0.5 flex items-center gap-1.5 text-xs text-ivory font-medium"
          >
            <span
              aria-hidden="true"
              className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-red text-[10px] font-bold text-ivory"
            >
              !
            </span>
            <span>{errors.telephone}</span>
          </p>
        )}
      </div>

      {/* Field 3: Véhicule d'intérêt (optional) */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="contact-vehicule"
          className="text-xs font-medium uppercase tracking-wider text-silver"
        >
          {t("vehicleLabel")}{" "}
          <span className="text-silver/60 normal-case">{t("optional")}</span>
        </label>
        <select
          id="contact-vehicule"
          name="vehicule"
          value={values.vehicule}
          onChange={(e) => handleChange("vehicule", e.target.value)}
          aria-invalid="false"
          className="min-h-[48px] w-full rounded-xl border border-navy-700 bg-navy-950 px-4 py-3 text-base text-ivory transition-colors hover:border-silver/50"
        >
          <option value="">{t("vehiclePlaceholder")}</option>
          <option value={t("vehicleOptionTradeIn")}>
            {t("vehicleOptionTradeIn")}
          </option>
          <option value={t("vehicleOptionCustom")}>
            {t("vehicleOptionCustom")}
          </option>
          {vehicles.map((v) => (
            <option key={v.slug} value={v.label}>
              {v.label}
            </option>
          ))}
        </select>
      </div>

      {/* Field 4: Message */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="contact-message"
          className="text-xs font-medium uppercase tracking-wider text-silver"
        >
          {t("messageLabel")}{" "}
          <span aria-hidden="true" className="text-brand-red">
            *
          </span>
        </label>
        <textarea
          ref={msgRef}
          id="contact-message"
          name="message"
          dir="auto"
          rows={4}
          required
          value={values.message}
          onChange={(e) => handleChange("message", e.target.value)}
          onBlur={() => handleBlur("message")}
          aria-invalid={errors.message ? "true" : "false"}
          aria-describedby={
            errors.message ? "contact-message-error" : undefined
          }
          placeholder={t("messagePlaceholder")}
          className={`w-full rounded-xl border bg-navy-950 px-4 py-3 text-base text-ivory placeholder:text-silver/45 transition-colors ${
            errors.message
              ? "border-brand-red"
              : "border-navy-700 hover:border-silver/50"
          }`}
        />
        {errors.message && (
          <p
            id="contact-message-error"
            className="mt-0.5 flex items-center gap-1.5 text-xs text-ivory font-medium"
          >
            <span
              aria-hidden="true"
              className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-red text-[10px] font-bold text-ivory"
            >
              !
            </span>
            <span>{errors.message}</span>
          </p>
        )}
      </div>

      <button
        type="submit"
        className="flex min-h-[50px] w-full items-center justify-center gap-2.5 rounded-xl bg-whatsapp-green px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95"
      >
        <WhatsAppIcon className="h-5 w-5 shrink-0 fill-current" />
        <span>{t("submit")}</span>
      </button>
    </form>
  );
}
