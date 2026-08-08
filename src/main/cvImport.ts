import { BrowserWindow, dialog } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { createEmptyCV, createId, normalizeCVData, type CVData } from "../shared/cv";
import type { ImportEngine } from "../shared/prefs";
import { extractPhotoFromFile } from "./extractPhoto";
import { parseResumeText } from "./resumeParse";
import { generateGeminiJson } from "./geminiClient";
import { normalizeUnicodeText } from "./unicode";

export interface ImportCVResult {
  ok: boolean;
  cv?: CVData;
  error?: string;
  canceled?: boolean;
  sourceName?: string;
  engine?: ImportEngine;
  photoFound?: boolean;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function extractText(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  const buf = await fs.readFile(filePath);

  if (ext === ".pdf") {
    const data = new Uint8Array(buf);
    const parser = new PDFParse({ data });
    try {
      const result = await parser.getText();
      return normalizeUnicodeText(result.text || "");
    } finally {
      await parser.destroy().catch(() => undefined);
    }
  }

  if (ext === ".docx") {
    const result = await mammoth.extractRawText({ buffer: buf });
    return normalizeUnicodeText(result.value);
  }

  if (ext === ".doc") {
    throw new Error("Legacy .doc is not supported. Use PDF, DOCX, or TXT.");
  }

  // Prefer UTF-8; fall back to UTF-16 LE BOM / Latin-1 repair via normalizeUnicodeText
  let raw: string;
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    raw = buf.toString("utf16le");
  } else if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    raw = buf.toString("utf8");
  } else {
    raw = buf.toString("utf8");
  }

  if (ext === ".html" || ext === ".htm") {
    return normalizeUnicodeText(stripHtml(raw));
  }

  return normalizeUnicodeText(raw);
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Could not parse CV JSON from Gemini.");
  return JSON.parse(candidate.slice(start, end + 1));
}

const PARSE_PROMPT = `Extract structured CV/resume data from the document text.
Preserve original language and Unicode characters exactly (Turkish ğüşıöç, accented Latin, etc.).
Return ONLY valid JSON:
{
  "personal": {
    "firstName": "", "lastName": "", "email": "", "phone": "", "address": "",
    "birthDate": "YYYY-MM-DD or original date string",
    "nationality": "", "postCode": "", "linkedIn": "", "portfolio": ""
  },
  "summary": "",
  "education": [{ "school": "", "degree": "", "startYear": "", "endYear": "" }],
  "experience": [{ "company": "", "position": "", "startYear": "", "endYear": "", "description": "" }],
  "skills": {
    "languages": "",
    "softwareLanguages": "",
    "hobbies": "",
    "computerPrograms": ""
  }
}
Do not invent facts. Empty string when unknown.`;

async function parseWithGemini(text: string, pdfBase64?: string): Promise<CVData> {
  const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [
    { text: PARSE_PROMPT },
  ];
  if (pdfBase64) {
    parts.push({ inlineData: { data: pdfBase64, mimeType: "application/pdf" } });
  } else {
    parts.push({ text: `CV_DOCUMENT_TEXT:\n${text.slice(0, 50000)}` });
  }

  const responseText = await generateGeminiJson(parts, 0.2);
  return normalizeCVData(extractJson(responseText));
}

function deepNormalizeStrings<T>(value: T): T {
  if (typeof value === "string") return normalizeUnicodeText(value) as T;
  if (Array.isArray(value)) return value.map((item) => deepNormalizeStrings(item)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      // Never run Unicode repair on base64 photo payloads.
      if (k === "photo" && typeof v === "string") {
        out[k] = v;
        continue;
      }
      out[k] = deepNormalizeStrings(v);
    }
    return out as T;
  }
  return value;
}

export async function importCVFromFile(
  window: BrowserWindow,
  engine: ImportEngine,
): Promise<ImportCVResult> {
  try {
    const picked = await dialog.showOpenDialog(window, {
      title: "Import CV",
      properties: ["openFile"],
      filters: [
        { name: "CV files", extensions: ["pdf", "docx", "txt", "html", "htm"] },
        { name: "PDF", extensions: ["pdf"] },
        { name: "Word", extensions: ["docx"] },
        { name: "Text", extensions: ["txt", "html", "htm"] },
      ],
    });

    if (picked.canceled || !picked.filePaths[0]) {
      return { ok: false, canceled: true };
    }

    const filePath = picked.filePaths[0];
    const ext = path.extname(filePath).toLowerCase();
    const text = await extractText(filePath);
    if (!text || text.length < 20) {
      return { ok: false, error: "Could not extract readable text from the file." };
    }

    let cv: CVData;
    if (engine === "gemini") {
      let pdfBase64: string | undefined;
      if (ext === ".pdf") {
        const buf = await fs.readFile(filePath);
        pdfBase64 = buf.toString("base64");
      }
      cv = await parseWithGemini(text, pdfBase64);
    } else {
      cv = parseResumeText(text);
    }

    cv = normalizeCVData(cv);
    cv = deepNormalizeStrings(cv);
    cv.education = cv.education.map((e) => ({ ...e, id: e.id || createId() }));
    cv.experience = cv.experience.map((e) => ({ ...e, id: e.id || createId() }));
    if (!cv.education.length) cv.education = createEmptyCV().education;
    if (!cv.experience.length) cv.experience = createEmptyCV().experience;

    const photo = await extractPhotoFromFile(filePath);
    if (photo) {
      cv.personal = { ...cv.personal, photo };
    } else {
      console.warn("[cvImport] No photo extracted from", filePath);
    }

    const sourceName = path.basename(filePath);
    // After import, prefer "source" style so edits keep a classic CV look
    // instead of jumping to the app's own modern template.
    cv.meta = {
      ...cv.meta,
      templateId: "source",
      wasImported: true,
      importedFrom: sourceName,
      styleAxes: { era: 48, temperature: 45 },
    };

    return {
      ok: true,
      cv,
      sourceName,
      engine,
      photoFound: Boolean(photo),
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      engine,
    };
  }
}
