export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_PHOTO_DIMENSION = 800;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function photoValidation(file: { type: string; size: number }): "type" | "size" | null {
  if (!PHOTO_TYPES.includes(file.type)) return "type";
  return file.size > MAX_PHOTO_BYTES ? "size" : null;
}

export function photoDimensions(width: number, height: number) {
  const ratio = Math.min(1, MAX_PHOTO_DIMENSION / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
}

export function isOtpEnabled(settings?: { otp_enabled?: string }) {
  return settings?.otp_enabled === "true";
}

export async function resizePhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    const dimensions = photoDimensions(bitmap.width, bitmap.height);
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image processing unavailable");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Image processing failed")), "image/webp", 0.85));
  } finally {
    bitmap.close();
  }
}