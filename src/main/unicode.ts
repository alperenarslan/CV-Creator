/**
 * Unicode-safe text normalization for multilingual CV content (incl. Turkish).
 * Uses NFC (canonical composition) — the standard form for modern interchange.
 */

const MOJIBAKE_HINT = /Ã.|Ä.|Å.|â€|ï¿½|�/;

function scoreTurkish(text: string): number {
  const hits = text.match(/[ğüşıöçĞÜŞİÖÇ]/gu);
  return hits?.length ?? 0;
}

/** Attempt to repair UTF-8 bytes that were decoded as Latin-1 / Windows-1252. */
function repairMojibake(text: string): string {
  if (!MOJIBAKE_HINT.test(text)) return text;
  try {
    const repaired = Buffer.from(text, "latin1").toString("utf8");
    if (scoreTurkish(repaired) >= scoreTurkish(text) && !repaired.includes("\uFFFD")) {
      return repaired;
    }
  } catch {
    /* keep original */
  }
  return text;
}

/** Strip incompatible controls, normalize to Unicode NFC, repair common PDF mojibake. */
export function normalizeUnicodeText(input: string): string {
  if (!input) return "";
  let text = input.replace(/\u0000/g, "");
  // Drop C0/C1 controls except tab/newline/carriage return
  text = text.replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "");
  text = repairMojibake(text);
  // Unicode Normalization Form C (latest ICU/JS engines use current Unicode)
  text = text.normalize("NFC");
  // Compatibility: map fancy spaces / dashes often seen in PDFs
  text = text
    .replace(/[\u00A0\u202F\u2007]/g, " ")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u2018\u2019\u201A]/g, "'")
    .replace(/[\u201C\u201D\u201E]/g, '"')
    .replace(/\u2026/g, "...");
  return text;
}
