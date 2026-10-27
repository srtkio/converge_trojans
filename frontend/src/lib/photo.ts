// Citizen photos are shrunk in the browser before upload: a phone photo (3-12 MB) becomes a JPEG
// of at most 1 MB, so it sends quickly on mobile data. Re-encoding through a canvas also drops the
// EXIF block, so the phone's GPS position and device details never leave the browser.

/** Upload budget for one photo (the API accepts up to 5 MB). */
export const PHOTO_MAX_BYTES = 1_000_000;
/** Longest side of the uploaded photo, in pixels: plenty for a crew to see the problem. */
const MAX_SIDE = 1600;
/** JPEG qualities tried in order; if none fits, the photo is scaled down and tried again. */
const QUALITIES = [0.82, 0.72, 0.62, 0.52];
const SHRINK = 0.8;
const MAX_ROUNDS = 12;

export const PHOTO_READ_ERROR = "We couldn't read that photo. Try a JPEG or PNG, or take a new photo.";

export interface PreparedPhoto {
  /** JPEG bytes as base64, without the "data:" prefix (the API's `photo.data`). */
  data: string;
  media_type: "image/jpeg";
  bytes: number;
  width: number;
  height: number;
  /** Object URL of the compressed JPEG, for the preview. Whoever holds the photo revokes it. */
  previewUrl: string;
}

type Decoded = { image: CanvasImageSource; width: number; height: number; release: () => void };

/** Decodes the file, upright (phones store rotation in EXIF). Throws if the browser can't read it. */
async function decode(file: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { image: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch {
      // Unsupported format or options in this browser: try an <img> instead.
    }
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("undecodable image"));
      img.src = url;
    });
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
  return { image: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("encode failed"))), "image/jpeg", quality);
  });
}

function base64Of(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      resolve(url.slice(url.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(blob);
  });
}

async function shrink(file: File): Promise<PreparedPhoto> {
  const decoded = await decode(file);
  const canvas = document.createElement("canvas");
  try {
    const { image, width, height } = decoded;
    if (!width || !height) throw new Error("empty image");
    let scale = Math.min(1, MAX_SIDE / Math.max(width, height));
    for (let round = 0; round < MAX_ROUNDS; round += 1) {
      const w = Math.max(1, Math.round(width * scale));
      const h = Math.max(1, Math.round(height * scale));
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no canvas");
      ctx.fillStyle = "#ffffff"; // transparent PNG areas turn white, not black
      ctx.fillRect(0, 0, w, h);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(image, 0, 0, w, h);
      for (const quality of QUALITIES) {
        const blob = await toJpeg(canvas, quality);
        // A browser without a JPEG encoder silently falls back to PNG; the API would reject it.
        if (blob.type !== "image/jpeg") throw new Error("no JPEG encoder");
        if (blob.size <= PHOTO_MAX_BYTES) {
          return {
            data: await base64Of(blob),
            media_type: "image/jpeg",
            bytes: blob.size,
            width: w,
            height: h,
            previewUrl: URL.createObjectURL(blob),
          };
        }
      }
      scale *= SHRINK;
    }
    throw new Error("could not fit the size budget");
  } finally {
    decoded.release();
    // Free the pixels now: Safari limits the total canvas memory per page.
    canvas.width = 0;
    canvas.height = 0;
  }
}

/**
 * Turns a picked or captured photo into an upright JPEG of at most 1 MB and 1600 px on the
 * longest side, without EXIF. Rejects non-images and files this browser can't decode (for
 * example HEIC on desktop Chrome) with a friendly message that can be shown as is.
 */
export async function compressPhoto(file: File): Promise<PreparedPhoto> {
  if (file.size === 0 || (file.type !== "" && !file.type.startsWith("image/"))) {
    throw new Error(PHOTO_READ_ERROR);
  }
  try {
    return await shrink(file);
  } catch {
    throw new Error(PHOTO_READ_ERROR);
  }
}

/** True when the API turned the photo down (too large: 413, unreadable or wrong type: 422). */
export function photoRejected(e: unknown): boolean {
  return e instanceof Error && (e.message.startsWith("413 ") || e.message.startsWith("422 "));
}

/** "380 KB" (the upload is always under 1 MB). */
export function formatPhotoSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
