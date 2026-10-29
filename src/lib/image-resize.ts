export const PHOTO_MAX_EDGE = 2000;
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PHOTO_QUALITY = 0.88;

function isHeic(file: File) {
  return /hei[cf]$/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

/** Converts HEIC, resizes to 2000px longest side (keeping phone rotation), returns JPEG/PNG/WebP. Size cap is checked after resizing. */
export async function preparePhoto(file: File): Promise<Blob> {
  let source: Blob = file;
  if (isHeic(file)) {
    const { default: heic2any } = await import("heic2any");
    const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
    source = Array.isArray(out) ? out[0]! : out;
  } else if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("type");
  }
  // createImageBitmap applies EXIF orientation with imageOrientation: "from-image".
  const bmp = await createImageBitmap(source, { imageOrientation: "from-image" });
  const scale = Math.min(1, PHOTO_MAX_EDGE / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const type = source.type === "image/png" ? "image/png" : source.type === "image/webp" ? "image/webp" : "image/jpeg";
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, type, PHOTO_QUALITY));
  if (!blob) throw new Error("encode");
  if (blob.size > PHOTO_MAX_BYTES) throw new Error("size");
  return blob;
}

export function photoExtension(type: string) {
  return type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
}
