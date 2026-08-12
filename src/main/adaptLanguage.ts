import { type CVData } from "../shared/cv";
import type { AdaptLocale } from "../shared/analysis";
import { generateGeminiJson } from "./geminiClient";

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Gemini JSON döndürmedi.");
  return JSON.parse(candidate.slice(start, end + 1));
}

export interface AdaptLanguageDraft {
  cv: CVData;
  coverLetter?: string;
  coverSubject?: string;
}

/**
 * Adapt CV narrative fields (+ optional cover letter) to TR or EN.
 * Does not invent facts; translates / localizes existing content.
 */
export async function adaptCvLanguage(opts: {
  cv: CVData;
  targetLocale: AdaptLocale;
  coverLetter?: string;
  coverSubject?: string;
}): Promise<AdaptLanguageDraft> {
  const lang = opts.targetLocale === "tr" ? "Turkish" : "English";
  const prompt = `You adapt a CV (and optional cover letter) into ${lang} for job applications.
Return ONLY valid JSON:
{
  "summary": string,
  "skills": {
    "languages": string,
    "softwareLanguages": string,
    "hobbies": string,
    "computerPrograms": string
  },
  "experience": [ { "id": string, "position": string, "description": string } ],
  "education": [ { "id": string, "degree": string } ],
  "coverSubject": string | null,
  "coverLetter": string | null
}

Rules:
- Target language: ${lang}
- Keep proper nouns (company names, schools, product names, tech brands) as-is when conventional.
- Do NOT invent employers, degrees, dates, or metrics.
- Keep experience/education item ids identical to the input.
- Translate position titles and descriptions into natural ${lang}.
- skills fields: translate prose but keep tech tokens (React, SQL, etc.).
- If coverLetter input is empty, set coverLetter and coverSubject to null.

CANDIDATE_CV_JSON:
${JSON.stringify(opts.cv)}

COVER_SUBJECT:
${opts.coverSubject?.trim() || ""}

COVER_LETTER:
${opts.coverLetter?.trim() || ""}
`;

  const text = await generateGeminiJson([{ text: prompt }], 0.3);
  const raw = extractJson(text) as Record<string, unknown>;
  const next: CVData = structuredClone(opts.cv);

  if (typeof raw.summary === "string" && raw.summary.trim()) {
    next.summary = raw.summary.trim();
  }

  const skills = (raw.skills ?? {}) as Record<string, unknown>;
  for (const key of ["languages", "softwareLanguages", "hobbies", "computerPrograms"] as const) {
    if (typeof skills[key] === "string") {
      next.skills[key] = String(skills[key]);
    }
  }

  if (Array.isArray(raw.experience)) {
    for (const item of raw.experience) {
      const row = (item ?? {}) as Record<string, unknown>;
      const id = String(row.id ?? "");
      const target = next.experience.find((e) => e.id === id);
      if (!target) continue;
      if (typeof row.position === "string" && row.position.trim()) {
        target.position = row.position.trim();
      }
      if (typeof row.description === "string") {
        target.description = row.description;
      }
    }
  }

  if (Array.isArray(raw.education)) {
    for (const item of raw.education) {
      const row = (item ?? {}) as Record<string, unknown>;
      const id = String(row.id ?? "");
      const target = next.education.find((e) => e.id === id);
      if (!target) continue;
      if (typeof row.degree === "string" && row.degree.trim()) {
        target.degree = row.degree.trim();
      }
    }
  }

  const adaptedCover =
    typeof raw.coverLetter === "string" && raw.coverLetter.trim()
      ? raw.coverLetter.trim()
      : undefined;
  const adaptedSubject =
    typeof raw.coverSubject === "string" && raw.coverSubject.trim()
      ? raw.coverSubject.trim()
      : undefined;

  return {
    cv: next,
    coverLetter: adaptedCover ?? (opts.coverLetter?.trim() || undefined),
    coverSubject: adaptedSubject ?? (opts.coverSubject?.trim() || undefined),
  };
}
