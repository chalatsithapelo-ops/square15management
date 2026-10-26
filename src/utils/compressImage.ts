// Client-side image compression using an offscreen canvas.
//
// Problem: modern phones save photos at 3–8 MB. On South African mobile
// networks (typical LTE 1–3 Mbps up, with frequent micro-drops), uploading
// three raw photos takes minutes and any brief drop makes the XHR abort with
// a generic "Network error".
//
// We downscale aggressively to 1280 px longest edge at JPEG q=0.72 — this
// still produces perfectly readable receipts (the primary use case) but cuts
// files to ~120–250 KB (30–50× smaller than the raw camera output). At 1 Mbps
// up that's roughly 1–2 s per photo instead of 30–60 s, so uploads finish
// before typical mobile network micro-drops.
//
// The helper is a no-op for non-image files (returns the file unchanged) and
// falls back to the original file if anything goes wrong (never blocks the
// upload).

export interface CompressImageOptions {
  /** Longest edge in pixels. Photos above this are downscaled. Default 1280. */
  maxDimension?: number;
  /** JPEG quality 0..1. Default 0.72. */
  quality?: number;
  /** If the original is already smaller than this many bytes, skip compression. Default 150 KB. */
  skipBelowBytes?: number;
}

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to decode image"));
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

export async function compressImage(file: File, options: CompressImageOptions = {}): Promise<File> {
  const maxDimension = options.maxDimension ?? 1280;
  const quality = options.quality ?? 0.72;
  const skipBelowBytes = options.skipBelowBytes ?? 150 * 1024;

  if (typeof window === "undefined") return file;
  if (!IMAGE_MIME_TYPES.has(file.type)) return file;
  if (file.size <= skipBelowBytes) return file;

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const { width, height } = img;
    if (width === 0 || height === 0) return file;

    const scale = Math.min(1, maxDimension / Math.max(width, height));
    const targetWidth = Math.round(width * scale);
    const targetHeight = Math.round(height * scale);

    // If no downscale needed and file is already a JPEG under threshold, still recompress
    // to strip metadata and apply quality (usually shrinks 30–50%).
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const blob = await canvasToBlob(canvas, "image/jpeg", quality);
    if (!blob || blob.size >= file.size) return file;

    const newName = file.name.replace(/\.(png|webp|jpe?g)$/i, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
