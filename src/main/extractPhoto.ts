import { createRequire } from "node:module";
import fs from "node:fs/promises";
import path from "node:path";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

const MAX_DATA_URL_CHARS = 1_800_000;
const MAX_EDGE = 420;

type CanvasModule = {
  createCanvas: (
    width: number,
    height: number,
  ) => {
    getContext: (type: "2d") => {
      drawImage: (...args: number[] | [unknown, ...number[]]) => void;
      getImageData: (
        x: number,
        y: number,
        w: number,
        h: number,
      ) => { data: Uint8ClampedArray };
    };
    toDataURL: (type?: string, quality?: number) => string;
    width: number;
    height: number;
  };
  loadImage: (source: Buffer | string) => Promise<{ width: number; height: number }>;
};

function resolvePackageRoot(): string {
  // dist-electron/main → project root in dev
  return path.resolve(__dirname, "..", "..");
}

function getCanvas(): CanvasModule {
  const require = createRequire(path.join(resolvePackageRoot(), "package.json"));
  return require("@napi-rs/canvas") as CanvasModule;
}

interface PhotoCandidate {
  dataUrl: string;
  width: number;
  height: number;
  page: number;
}

function isValidDataUrl(value: string): boolean {
  return (
    typeof value === "string" &&
    value.startsWith("data:image/") &&
    value.includes(";base64,") &&
    value.length > 64
  );
}

function readJpegSize(buf: Buffer): { w: number; h: number } | undefined {
  let i = 2;
  while (i < buf.length - 9) {
    if (buf[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = buf[i + 1];
    if (marker === 0xd8 || marker === 0xd9) {
      i += 2;
      continue;
    }
    const len = buf.readUInt16BE(i + 2);
    // SOF0 / SOF1 / SOF2
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      const h = buf.readUInt16BE(i + 5);
      const w = buf.readUInt16BE(i + 7);
      if (w > 0 && h > 0) return { w, h };
    }
    i += 2 + len;
  }
  return undefined;
}

function readPngSize(buf: Buffer): { w: number; h: number } | undefined {
  if (buf.length < 24) return undefined;
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  if (w > 0 && h > 0 && w < 20000 && h < 20000) return { w, h };
  return undefined;
}

/** Scan PDF bytes for embedded JPEG/PNG — only keep streams with real dimensions. */
function extractRawImagesFromPdfBuffer(buf: Buffer): PhotoCandidate[] {
  const out: PhotoCandidate[] = [];

  for (let i = 0; i < buf.length - 1; i += 1) {
    if (buf[i] !== 0xff || buf[i + 1] !== 0xd8) continue;
    const maxJ = Math.min(buf.length - 1, i + 4_000_000);
    for (let j = i + 2; j < maxJ; j += 1) {
      if (buf[j] !== 0xff || buf[j + 1] !== 0xd9) continue;
      const slice = buf.subarray(i, j + 2);
      const dims = readJpegSize(slice);
      // Require real SOF header — fake SOI/EOI spans in PDF junk break the UI.
      if (dims && slice.length >= 2500 && slice.length <= 3_500_000) {
        out.push({
          dataUrl: `data:image/jpeg;base64,${Buffer.from(slice).toString("base64")}`,
          width: dims.w,
          height: dims.h,
          page: 1,
        });
      }
      i = j + 1;
      break;
    }
  }

  const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  let from = 0;
  while (from < buf.length) {
    const idx = buf.indexOf(pngSig, from);
    if (idx === -1) break;
    const iend = Buffer.from("IEND");
    let end = buf.indexOf(iend, idx + 8);
    if (end === -1) {
      from = idx + 8;
      continue;
    }
    end += 8;
    const slice = buf.subarray(idx, end);
    const dims = readPngSize(slice);
    if (dims && slice.length >= 800 && slice.length <= 3_500_000) {
      out.push({
        dataUrl: `data:image/png;base64,${Buffer.from(slice).toString("base64")}`,
        width: dims.w,
        height: dims.h,
        page: 1,
      });
    }
    from = end;
  }

  return out;
}

function scoreCandidate(c: PhotoCandidate): number {
  const w = c.width || 1;
  const h = c.height || 1;
  const aspect = w / h;
  const area = w * h;

  // Skip tiny icons / tracking pixels
  if (w < 40 || h < 40) return -1;
  if (area < 2500) return -1;
  // Skip huge full-page scans preferred later only if nothing else
  if (aspect > 3.2 || aspect < 0.28) return -1;

  let portraitBonus = 1;
  if (aspect >= 0.55 && aspect <= 1.4) portraitBonus = 3;
  else if (aspect >= 0.4 && aspect <= 1.85) portraitBonus = 1.6;

  // Prefer typical headshot sizes over tiny logos and giant page dumps
  let sizeBonus = 1;
  if (area >= 15_000 && area <= 900_000) sizeBonus = 2.2;
  else if (area > 900_000) sizeBonus = 0.35;

  return area * portraitBonus * sizeBonus;
}

/**
 * Decode + re-encode so the renderer never gets a broken data URL.
 * Rejects anything canvas/skia cannot load.
 */
/** Reject CV page/text crops mistaken for portraits. */
function looksLikeDocumentText(
  ctx: { getImageData: (x: number, y: number, w: number, h: number) => { data: Uint8ClampedArray } },
  w: number,
  h: number,
): boolean {
  const { data } = ctx.getImageData(0, 0, w, h);
  let n = 0;
  let white = 0;
  let ink = 0;
  let sharp = 0;
  let chroma = 0;

  for (let y = 1; y < h - 1; y += 2) {
    for (let x = 1; x < w - 1; x += 2) {
      const i = (y * w + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const gray = (r + g + b) / 3;
      n += 1;
      chroma += Math.abs(r - g) + Math.abs(g - b);
      if (gray > 235) white += 1;
      if (gray < 90) ink += 1;

      const left = ((y * w + (x - 1)) * 4);
      const grayL = (data[left] + data[left + 1] + data[left + 2]) / 3;
      if (Math.abs(gray - grayL) > 55) sharp += 1;
    }
  }
  if (!n) return true;

  const whiteRatio = white / n;
  const inkRatio = ink / n;
  const sharpRatio = sharp / n;
  const avgChroma = chroma / n;

  // Text blocks: lots of paper white + dark ink + sharp edges, low color
  if (whiteRatio > 0.45 && sharpRatio > 0.06 && avgChroma < 28) return true;
  if (whiteRatio > 0.62 && inkRatio > 0.02) return true;
  if (whiteRatio > 0.5 && inkRatio > 0.04 && sharpRatio > 0.04) return true;
  return false;
}

async function reencodeDecodablePhoto(dataUrl: string): Promise<string | undefined> {
  if (!isValidDataUrl(dataUrl)) return undefined;
  try {
    const { createCanvas, loadImage } = getCanvas();
    const img = await loadImage(dataUrl);
    if (!img.width || !img.height || img.width < 40 || img.height < 40) return undefined;

    const aspect = img.width / img.height;
    // Portraits are roughly square / vertical — skip wide UI strips
    if (aspect > 1.7 || aspect < 0.45) return undefined;

    const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);

    if (looksLikeDocumentText(ctx, w, h)) {
      console.warn("[extractPhoto] skipped text/document crop");
      return undefined;
    }

    let out = canvas.toDataURL("image/jpeg", 0.86);
    if (out.length > MAX_DATA_URL_CHARS) out = canvas.toDataURL("image/jpeg", 0.7);
    if (out.length > MAX_DATA_URL_CHARS) out = canvas.toDataURL("image/jpeg", 0.55);
    if (!isValidDataUrl(out) || out.length > MAX_DATA_URL_CHARS) return undefined;
    return out;
  } catch (err) {
    console.warn("[extractPhoto] undecodable image skipped:", err);
    return undefined;
  }
}

async function pickBestDecodable(candidates: PhotoCandidate[]): Promise<string | undefined> {
  const ranked = [...candidates]
    .filter((c) => isValidDataUrl(c.dataUrl))
    .map((c) => ({ c, score: scoreCandidate(c) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const fallback = [...candidates]
    .filter((c) => isValidDataUrl(c.dataUrl) && c.width >= 48 && c.height >= 48)
    .sort((a, b) => b.width * b.height - a.width * a.height);

  const ordered = [
    ...ranked.map((x) => x.c),
    ...fallback.filter((c) => !ranked.some((r) => r.c.dataUrl === c.dataUrl)),
  ];

  for (const c of ordered.slice(0, 8)) {
    const ok = await reencodeDecodablePhoto(c.dataUrl);
    if (ok) return ok;
  }
  return undefined;
}

function toDataUrl(img: { dataUrl?: string; data?: Uint8Array }): string | undefined {
  if (img.dataUrl && isValidDataUrl(img.dataUrl)) return img.dataUrl;
  if (img.data && img.data.length > 32) {
    return `data:image/png;base64,${Buffer.from(img.data).toString("base64")}`;
  }
  return undefined;
}

async function extractEmbeddedFromPdf(filePath: string): Promise<string | undefined> {
  const buf = await fs.readFile(filePath);
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  try {
    const result = await parser.getImage({
      imageThreshold: 24,
      imageDataUrl: true,
      imageBuffer: true,
      first: 2,
    });
    const candidates: PhotoCandidate[] = [];
    for (const page of result.pages ?? []) {
      for (const img of page.images ?? []) {
        const dataUrl = toDataUrl(img);
        if (!dataUrl) continue;
        candidates.push({
          dataUrl,
          width: img.width || 0,
          height: img.height || 0,
          page: page.pageNumber || 1,
        });
      }
    }
    return pickBestDecodable(candidates);
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

async function extractFromPdf(filePath: string): Promise<string | undefined> {
  const buf = await fs.readFile(filePath);

  // Only real embedded images — never crop the rendered page (that grabs CV text).
  try {
    const embedded = await extractEmbeddedFromPdf(filePath);
    if (embedded) return embedded;
  } catch (err) {
    console.warn("[extractPhoto] getImage failed:", err);
  }

  try {
    const raw = await pickBestDecodable(extractRawImagesFromPdfBuffer(buf));
    if (raw) return raw;
  } catch (err) {
    console.warn("[extractPhoto] raw scan failed:", err);
  }

  return undefined;
}

async function extractFromDocx(filePath: string): Promise<string | undefined> {
  const buf = await fs.readFile(filePath);
  const candidates: PhotoCandidate[] = [];
  let index = 0;

  await mammoth.convertToHtml(
    { buffer: buf },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        const contentType = image.contentType || "image/png";
        const base64 = await image.read("base64");
        const dataUrl = `data:${contentType};base64,${base64}`;
        candidates.push({
          dataUrl,
          width: 280 - index * 8,
          height: 340 - index * 8,
          page: 1,
        });
        index += 1;
        return { src: dataUrl };
      }),
    },
  );

  return pickBestDecodable(candidates);
}

function extractFromHtml(raw: string): PhotoCandidate[] {
  const re = /<img[^>]+src=["'](data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+)["']/gi;
  const candidates: PhotoCandidate[] = [];
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = re.exec(raw)) !== null && i < 12) {
    candidates.push({
      dataUrl: match[1],
      width: 240 - i * 6,
      height: 300 - i * 6,
      page: 1,
    });
    i += 1;
  }
  return candidates;
}

/** Best-effort portrait extraction from PDF / DOCX / HTML. */
export async function extractPhotoFromFile(filePath: string): Promise<string | undefined> {
  try {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === ".pdf") return await extractFromPdf(filePath);
    if (ext === ".docx") return await extractFromDocx(filePath);
    if (ext === ".html" || ext === ".htm") {
      const html = await fs.readFile(filePath, "utf8");
      return pickBestDecodable(extractFromHtml(html));
    }
    return undefined;
  } catch (err) {
    console.warn("[extractPhoto] failed:", err);
    return undefined;
  }
}

export function isPhotoDataUrl(value: unknown): value is string {
  return typeof value === "string" && isValidDataUrl(value) && value.length <= MAX_DATA_URL_CHARS;
}
