"use client";

import { useCallback, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cldUrl } from "@/lib/cloudinary-url";
import type { CarImage } from "@/types/database";

const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB
const MAX_LONG_SIDE_PX = 2000;
const COMPRESSION_QUALITY = 0.85;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export interface ImageUploaderProps {
  value: CarImage[];
  onChange: (images: CarImage[]) => void;
  max?: number;
  /** Called whenever a brand-new image finishes uploading so the parent form can clean it up on cancel. */
  onUploadedPublicId?: (publicId: string) => void;
}

interface UploadItem {
  id: string;
  file: File;
  fileName: string;
  progress: number;
  status: "compressing" | "uploading" | "error" | "cancelled";
  error?: string;
}

interface SignResponse {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  allowedFormats: string;
}

/**
 * Resizes/compresses an image on the client via Canvas to max 2000px on the long side
 * at ~0.85 quality (WebP or JPEG fallback) before uploading to Cloudinary.
 */
async function compressImageOnClient(file: File): Promise<File> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const { naturalWidth: w, naturalHeight: h } = img;
      if (!w || !h) {
        resolve(file);
        return;
      }

      const scale = Math.min(1, MAX_LONG_SIDE_PX / Math.max(w, h));
      const targetW = Math.max(1, Math.round(w * scale));
      const targetH = Math.max(1, Math.round(h * scale));

      // Skip re-encoding if already small and within dimensions
      if (scale === 1 && file.size <= 350 * 1024) {
        resolve(file);
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.drawImage(img, 0, 0, targetW, targetH);

      const targetType =
        file.type === "image/png" ? "image/webp" : "image/jpeg";
      const targetExt = targetType === "image/webp" ? ".webp" : ".jpg";

      canvas.toBlob(
        (blob) => {
          if (!blob || (scale === 1 && blob.size >= file.size)) {
            resolve(file);
            return;
          }
          const baseName = file.name.replace(/\.[^.]+$/, "");
          resolve(
            new File([blob], `${baseName}${targetExt}`, {
              type: blob.type || targetType,
            })
          );
        },
        targetType,
        COMPRESSION_QUALITY
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
}

interface SortablePhotoCardProps {
  image: CarImage;
  index: number;
  total: number;
  confirmDeleteId: string | null;
  onRequestDelete: (publicId: string | null) => void;
  onConfirmDelete: (publicId: string) => void;
  onSetPrimary: (index: number) => void;
  onMove: (from: number, to: number) => void;
}

function SortablePhotoCard({
  image,
  index,
  total,
  confirmDeleteId,
  onRequestDelete,
  onConfirmDelete,
  onSetPrimary,
  onMove,
}: SortablePhotoCardProps) {
  const t = useTranslations("admin.uploader");
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.public_id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isPrimary = index === 0;
  const isConfirming = confirmDeleteId === image.public_id;
  const previewSrc = image.url?.includes("res.cloudinary.com/")
    ? cldUrl(image.url, { width: 480 })
    : image.public_id
      ? cldUrl(image.public_id, { width: 480 })
      : image.url;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative flex flex-col overflow-hidden rounded-xl border bg-navy-950 transition-shadow ${
        isDragging
          ? "z-20 border-brand-red shadow-2xl opacity-90"
          : isPrimary
            ? "border-brand-red/70"
            : "border-navy-700"
      }`}
    >
      {/* Draggable Thumbnail (touch-pan-y so dragging never blocks vertical page scroll) */}
      <div
        {...attributes}
        {...listeners}
        aria-label={t("dragAria", { index: index + 1 })}
        className="relative aspect-[4/3] w-full cursor-grab active:cursor-grabbing overflow-hidden bg-navy-900 touch-pan-y"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewSrc}
          alt={t("photoAlt", { index: index + 1 })}
          className="h-full w-full object-cover select-none pointer-events-none"
          loading="lazy"
        />

        <div className="pointer-events-none absolute inset-x-2 top-2 flex items-center justify-between gap-2">
          {isPrimary ? (
            <span className="rounded-full bg-brand-red px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-ivory shadow">
              {t("primaryBadge")}
            </span>
          ) : (
            <span className="rounded-full border border-navy-700 bg-navy-950/85 px-2.5 py-0.5 text-[11px] font-medium text-silver">
              #{index + 1}
            </span>
          )}
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col gap-2 p-2.5">
        <div className="flex items-center justify-between gap-1.5">
          {/* Semantic Earlier / Later buttons (44px tap targets, RTL-safe) */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onMove(index, index - 1)}
              disabled={index === 0}
              aria-label={t("moveEarlierAria", { index: index + 1 })}
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-navy-700 bg-navy-900 px-3 text-xs font-medium text-ivory transition-colors hover:border-silver/50 disabled:opacity-35"
            >
              {t("moveEarlier")}
            </button>
            <button
              type="button"
              onClick={() => onMove(index, index + 1)}
              disabled={index === total - 1}
              aria-label={t("moveLaterAria", { index: index + 1 })}
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-navy-700 bg-navy-900 px-3 text-xs font-medium text-ivory transition-colors hover:border-silver/50 disabled:opacity-35"
            >
              {t("moveLater")}
            </button>
          </div>

          {!isPrimary && (
            <button
              type="button"
              onClick={() => onSetPrimary(index)}
              className="inline-flex min-h-[40px] flex-1 items-center justify-center rounded-lg border border-navy-700 bg-navy-900 px-2.5 text-xs font-medium text-ivory transition-colors hover:border-silver/50"
            >
              {t("setPrimary")}
            </button>
          )}
        </div>

        {/* Delete with inline confirmation */}
        {isConfirming ? (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onConfirmDelete(image.public_id)}
              className="inline-flex min-h-[40px] flex-1 items-center justify-center rounded-lg bg-brand-red px-2.5 text-xs font-semibold text-ivory hover:opacity-95"
            >
              {t("confirmDelete")}
            </button>
            <button
              type="button"
              onClick={() => onRequestDelete(null)}
              className="inline-flex min-h-[40px] flex-1 items-center justify-center rounded-lg border border-navy-700 bg-navy-900 px-2.5 text-xs font-medium text-silver hover:text-ivory"
            >
              {t("cancel")}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onRequestDelete(image.public_id)}
            className="inline-flex min-h-[40px] w-full items-center justify-center rounded-lg border border-navy-700/80 bg-navy-900/60 px-3 text-xs font-medium text-silver transition-colors hover:border-brand-red/70 hover:text-ivory"
          >
            {t("delete")}
          </button>
        )}
      </div>
    </div>
  );
}

export function ImageUploader({
  value,
  onChange,
  max = 12,
  onUploadedPublicId,
}: ImageUploaderProps) {
  const t = useTranslations("admin.uploader");
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const xhrMapRef = useRef<Map<string, XMLHttpRequest>>(new Map());
  const latestValueRef = useRef<CarImage[]>(value);
  latestValueRef.current = value;

  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const updateUploadItem = useCallback(
    (id: string, patch: Partial<UploadItem>) => {
      setUploads((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
      );
    },
    []
  );

  const removeUploadItem = useCallback((id: string) => {
    setUploads((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const uploadSingleFile = useCallback(
    async (uploadId: string, originalFile: File) => {
      try {
        updateUploadItem(uploadId, {
          status: "compressing",
          progress: 5,
          error: undefined,
        });
        setStatusMessage(t("status.preparing", { name: originalFile.name }));

        const processedFile = await compressImageOnClient(originalFile);

        if (processedFile.size > MAX_FILE_BYTES) {
          updateUploadItem(uploadId, {
            status: "error",
            error: t("errors.tooLargeAfterCompression"),
          });
          return;
        }

        // Fetch a fresh server-signed payload per upload
        const signRes = await fetch("/api/admin/cloudinary/sign", {
          method: "POST",
        });
        if (!signRes.ok) {
          const errJson = await signRes.json().catch(() => null);
          throw new Error(errJson?.error ?? t("errors.signFailed"));
        }
        const signData = (await signRes.json()) as SignResponse;

        updateUploadItem(uploadId, { status: "uploading", progress: 10 });
        setStatusMessage(t("status.uploading", { name: originalFile.name }));

        const uploaded = await new Promise<CarImage>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhrMapRef.current.set(uploadId, xhr);

          xhr.open(
            "POST",
            `https://api.cloudinary.com/v1_1/${signData.cloudName}/image/upload`
          );

          xhr.upload.onprogress = (evt) => {
            if (evt.lengthComputable) {
              const pct = Math.max(
                10,
                Math.min(99, Math.round((evt.loaded / evt.total) * 100))
              );
              updateUploadItem(uploadId, { progress: pct });
            }
          };

          xhr.onload = () => {
            xhrMapRef.current.delete(uploadId);
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const res = JSON.parse(xhr.responseText) as {
                  public_id: string;
                  secure_url: string;
                  width: number;
                  height: number;
                };
                resolve({
                  public_id: res.public_id,
                  url: cldUrl(res.public_id, {
                    width: 1200,
                    cloudName: signData.cloudName,
                  }),
                  width: res.width || 1200,
                  height: res.height || 900,
                });
              } catch {
                reject(new Error(t("errors.invalidResponse")));
              }
            } else {
              reject(new Error(t("errors.uploadFailed")));
            }
          };

          xhr.onerror = () => {
            xhrMapRef.current.delete(uploadId);
            reject(new Error(t("errors.networkError")));
          };

          xhr.onabort = () => {
            xhrMapRef.current.delete(uploadId);
            reject(new Error("__CANCELLED__"));
          };

          const formData = new FormData();
          formData.append("file", processedFile);
          formData.append("api_key", signData.apiKey);
          formData.append("timestamp", String(signData.timestamp));
          formData.append("signature", signData.signature);
          formData.append("folder", signData.folder);
          formData.append("allowed_formats", signData.allowedFormats);

          xhr.send(formData);
        });

        onUploadedPublicId?.(uploaded.public_id);
        const nextList = [...latestValueRef.current, uploaded].slice(0, max);
        latestValueRef.current = nextList;
        onChange(nextList);
        removeUploadItem(uploadId);
        setStatusMessage(t("status.added", { name: originalFile.name }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : t("errors.uploadFailed");
        if (msg === "__CANCELLED__") {
          updateUploadItem(uploadId, {
            status: "cancelled",
            error: t("errors.cancelled"),
          });
          setStatusMessage(t("status.cancelled", { name: originalFile.name }));
          return;
        }
        updateUploadItem(uploadId, { status: "error", error: msg });
        setStatusMessage(
          t("status.error", { name: originalFile.name, message: msg })
        );
      }
    },
    [max, onChange, onUploadedPublicId, removeUploadItem, t, updateUploadItem]
  );

  const handleFilesSelected = useCallback(
    (fileList: FileList | File[]) => {
      setGlobalError(null);
      const files = Array.from(fileList);
      if (files.length === 0) return;

      const remainingSlots =
        max -
        latestValueRef.current.length -
        uploads.filter(
          (u) => u.status === "compressing" || u.status === "uploading"
        ).length;

      if (remainingSlots <= 0) {
        setGlobalError(t("errors.maxFiles", { max }));
        return;
      }

      const accepted: File[] = [];
      const errors: string[] = [];

      for (const file of files) {
        const lowerName = file.name.toLowerCase();
        if (
          file.type === "image/heic" ||
          file.type === "image/heif" ||
          lowerName.endsWith(".heic") ||
          lowerName.endsWith(".heif")
        ) {
          errors.push(t("errors.heicUnsupported", { name: file.name }));
          continue;
        }
        if (!ALLOWED_MIME_TYPES.has(file.type)) {
          errors.push(t("errors.unsupportedFormat", { name: file.name }));
          continue;
        }
        if (file.size > MAX_FILE_BYTES) {
          errors.push(t("errors.tooLarge", { name: file.name }));
          continue;
        }
        accepted.push(file);
      }

      if (accepted.length > remainingSlots) {
        errors.push(
          t("errors.remainingSlots", { count: remainingSlots, max })
        );
      }

      if (errors.length > 0) {
        setGlobalError(errors.join(" "));
      }

      const toUpload = accepted.slice(0, remainingSlots);
      const newItems: UploadItem[] = toUpload.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        fileName: file.name,
        progress: 0,
        status: "compressing",
      }));

      if (newItems.length > 0) {
        setUploads((prev) => [...prev, ...newItems]);
        newItems.forEach((item) => {
          void uploadSingleFile(item.id, item.file);
        });
      }
    },
    [max, t, uploads, uploadSingleFile]
  );

  const handleCancelUpload = (id: string) => {
    const xhr = xhrMapRef.current.get(id);
    if (xhr) {
      xhr.abort();
    } else {
      removeUploadItem(id);
    }
  };

  const handleRetryUpload = (item: UploadItem) => {
    void uploadSingleFile(item.id, item.file);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = value.findIndex((img) => img.public_id === active.id);
    const newIndex = value.findIndex((img) => img.public_id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      onChange(arrayMove(value, oldIndex, newIndex));
      setStatusMessage(t("status.orderUpdated"));
    }
  };

  const handleMove = (from: number, to: number) => {
    if (to < 0 || to >= value.length) return;
    onChange(arrayMove(value, from, to));
    setStatusMessage(t("status.orderUpdated"));
  };

  const handleSetPrimary = (index: number) => {
    if (index <= 0 || index >= value.length) return;
    onChange(arrayMove(value, index, 0));
    setStatusMessage(t("status.primaryUpdated"));
  };

  const handleConfirmDelete = (publicId: string) => {
    onChange(value.filter((img) => img.public_id !== publicId));
    setConfirmDeleteId(null);
    setStatusMessage(t("status.removed"));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={inputId}
          className="text-xs font-semibold uppercase tracking-wider text-silver"
        >
          {t("label", { count: value.length, max })}
        </label>
        <span className="text-xs text-silver/80">{t("hint")}</span>
      </div>

      {/* Accessible status announcements */}
      <div className="sr-only" aria-live="polite" role="status">
        {statusMessage}
      </div>

      {globalError && (
        <div
          role="alert"
          className="rounded-xl border border-brand-red/60 bg-brand-red/15 px-4 py-3 text-sm text-ivory"
        >
          {globalError}
        </div>
      )}

      {/* Drag-and-drop & Mobile Tappable Picker Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          if (e.dataTransfer.files?.length) {
            handleFilesSelected(e.dataTransfer.files);
          }
        }}
        className={`relative flex min-h-[140px] flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
          isDragOver
            ? "border-brand-red bg-brand-red/10"
            : "border-navy-700 bg-navy-950/70 hover:border-silver/50"
        }`}
      >
        <input
          ref={fileInputRef}
          id={inputId}
          type="file"
          accept="image/*"
          multiple
          disabled={value.length >= max}
          onChange={(e) => {
            if (e.target.files) {
              handleFilesSelected(e.target.files);
              e.target.value = "";
            }
          }}
          className="sr-only"
        />

        <p className="text-sm font-medium text-ivory">{t("dropPrompt")}</p>
        <p className="mt-1 text-xs text-silver">{t("dropSubprompt")}</p>

        <button
          type="button"
          disabled={value.length >= max}
          onClick={() => fileInputRef.current?.click()}
          className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-brand-red px-5 py-2.5 text-sm font-semibold text-ivory shadow-sm transition-opacity hover:opacity-95 disabled:opacity-40"
        >
          {t("chooseButton")}
        </button>
      </div>

      {/* Active / Failed Upload Progress List */}
      {uploads.length > 0 && (
        <ul className="space-y-2.5" aria-label={t("uploadsAria")}>
          {uploads.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-navy-700 bg-navy-950 p-3.5"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm font-medium text-ivory">
                  {item.fileName}
                </p>

                <div className="flex items-center gap-2 shrink-0">
                  {(item.status === "compressing" ||
                    item.status === "uploading") && (
                    <>
                      <span className="text-xs font-mono text-silver">
                        {item.progress}%
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCancelUpload(item.id)}
                        className="inline-flex min-h-[36px] items-center rounded-lg border border-navy-700 px-3 text-xs font-medium text-silver hover:border-brand-red hover:text-ivory"
                      >
                        {t("cancel")}
                      </button>
                    </>
                  )}

                  {(item.status === "error" || item.status === "cancelled") && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleRetryUpload(item)}
                        className="inline-flex min-h-[36px] items-center rounded-lg bg-brand-red px-3 text-xs font-semibold text-ivory"
                      >
                        {t("retry")}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeUploadItem(item.id)}
                        className="inline-flex min-h-[36px] items-center rounded-lg border border-navy-700 px-3 text-xs text-silver hover:text-ivory"
                      >
                        {t("close")}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {(item.status === "compressing" ||
                item.status === "uploading") && (
                <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-navy-800">
                  <div
                    className="h-full rounded-full bg-brand-red transition-[width] duration-150"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              )}

              {item.error && (
                <p className="mt-2 text-xs text-brand-red">{item.error}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Sortable Thumbnails Grid */}
      {value.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={value.map((img) => img.public_id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 md:grid-cols-3">
              {value.map((image, index) => (
                <SortablePhotoCard
                  key={image.public_id}
                  image={image}
                  index={index}
                  total={value.length}
                  confirmDeleteId={confirmDeleteId}
                  onRequestDelete={setConfirmDeleteId}
                  onConfirmDelete={handleConfirmDelete}
                  onSetPrimary={handleSetPrimary}
                  onMove={handleMove}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

/**
 * Best-effort cleanup helper for unsaved uploads if the admin leaves/cancels.
 */
export function sendUnsavedCleanupBeacon(publicIds: string[]): void {
  if (typeof window === "undefined" || publicIds.length === 0) return;
  const payload = JSON.stringify({ publicIds });
  if (typeof navigator.sendBeacon === "function") {
    const blob = new Blob([payload], { type: "application/json" });
    navigator.sendBeacon("/api/admin/cloudinary/cleanup", blob);
  } else {
    void fetch("/api/admin/cloudinary/cleanup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    });
  }
}
