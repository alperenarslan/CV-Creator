const MAX_EDGE = 420;
const JPEG_QUALITY = 0.86;
const MAX_DATA_URL_CHARS = 1_800_000;

export function isPhotoDataUrl(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.startsWith("data:image/") &&
    value.includes(";base64,") &&
    value.length > 64 &&
    value.length <= MAX_DATA_URL_CHARS
  );
}

/** Resize / recompress a local image file to a compact data URL. */
export async function fileToPhotoDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Not an image");
  }

  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.drawImage(bitmap, 0, 0, w, h);

    let dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    if (dataUrl.length > MAX_DATA_URL_CHARS) {
      dataUrl = canvas.toDataURL("image/jpeg", 0.7);
    }
    if (dataUrl.length > MAX_DATA_URL_CHARS) {
      throw new Error("Image too large");
    }
    return dataUrl;
  } finally {
    bitmap.close();
  }
}
