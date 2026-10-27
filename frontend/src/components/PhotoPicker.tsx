"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import { CameraIcon } from "@/components/CitizenIcons";
import type { PhotoUpload } from "@/lib/api";
import { PHOTO_READ_ERROR, compressPhoto, formatPhotoSize, type PreparedPhoto } from "@/lib/photo";

/**
 * State for one optional photo, owned by the component that sends it. The preview URL is revoked
 * when the photo is replaced, cleared, or the owner unmounts; a photo still being prepared when
 * the owner clears it or unmounts is dropped.
 */
export function usePhotoField() {
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const job = useRef(0);

  useEffect(() => {
    if (!photo) return;
    const url = photo.previewUrl;
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  useEffect(
    () => () => {
      job.current += 1;
    },
    [],
  );

  const choose = useCallback(async (file: File) => {
    const mine = (job.current += 1);
    setPreparing(true);
    setError(null);
    try {
      const next = await compressPhoto(file);
      if (mine !== job.current) {
        URL.revokeObjectURL(next.previewUrl);
        return;
      }
      setPhoto(next);
    } catch (e) {
      if (mine === job.current) setError(e instanceof Error ? e.message : PHOTO_READ_ERROR);
    } finally {
      if (mine === job.current) setPreparing(false);
    }
  }, []);

  const clear = useCallback(() => {
    job.current += 1;
    setPhoto(null);
    setPreparing(false);
    setError(null);
  }, []);

  /** The request body part: only the bytes and type leave the browser. */
  const upload: PhotoUpload | undefined = photo ? { data: photo.data, media_type: photo.media_type } : undefined;

  return { photo, preparing, error, choose, clear, upload };
}

export type PhotoField = ReturnType<typeof usePhotoField>;

/**
 * "Add a photo": opens the camera or the gallery (no `capture`, so both are offered), then shows a
 * preview, the upload size and "Remove photo".
 */
export function PhotoPicker({
  field,
  disabled = false,
  hint = "Optional. A photo helps the crew find the problem.",
}: {
  field: PhotoField;
  disabled?: boolean;
  hint?: string;
}) {
  const inputId = useId();
  const hintId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const { photo, preparing, error } = field;

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // choosing the same file again still fires a change
    if (file) void field.choose(file);
  };

  const remove = () => {
    field.clear();
    // Keep keyboard focus in place: the picker comes back where the preview was.
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  return (
    <div className="min-w-0">
      {photo ? (
        <div className="cz-rise flex items-center gap-3 rounded-xl bg-white p-2.5 ring-1 ring-slate-200">
          {/* A local blob: preview of the compressed JPEG; next/image can't optimise blob URLs. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.previewUrl}
            alt="Your photo"
            width={64}
            height={64}
            className="h-16 w-16 shrink-0 rounded-lg bg-slate-100 object-cover ring-1 ring-slate-900/5"
          />
          <p className="min-w-0 flex-1 text-sm">
            <span className="block font-medium text-slate-900">Photo ready, {formatPhotoSize(photo.bytes)}</span>
            <span className="block text-xs text-slate-500">Hidden details like GPS are removed.</span>
          </p>
          <button
            type="button"
            onClick={remove}
            disabled={disabled}
            className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-rose-700 ring-1 ring-rose-200 transition hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 disabled:opacity-50 motion-safe:active:scale-95"
          >
            Remove photo
          </button>
        </div>
      ) : (
        <>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept="image/*"
            onChange={pick}
            disabled={disabled || preparing}
            aria-describedby={hintId}
            className="peer sr-only"
          />
          <label
            htmlFor={inputId}
            className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white text-base font-medium text-slate-800 transition peer-focus-visible:ring-2 peer-focus-visible:ring-slate-900 peer-focus-visible:ring-offset-2 ${
              disabled || preparing ? "cursor-default opacity-60" : "cursor-pointer hover:border-slate-400 hover:bg-slate-50 motion-safe:active:scale-[0.98]"
            }`}
          >
            <CameraIcon className={`h-5 w-5 text-slate-600 ${preparing ? "motion-safe:animate-pulse" : ""}`} />
            {preparing ? "Preparing photo…" : "Add a photo"}
          </label>
          <p id={hintId} className="mt-1 text-xs text-slate-500">
            {hint}
          </p>
        </>
      )}
      <p className="sr-only" role="status" aria-live="polite">
        {preparing ? "Preparing photo…" : photo ? `Photo ready, ${formatPhotoSize(photo.bytes)}` : ""}
      </p>
      {error && (
        <p role="alert" className="cz-rise mt-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-800 ring-1 ring-rose-200">
          {error}
        </p>
      )}
    </div>
  );
}
