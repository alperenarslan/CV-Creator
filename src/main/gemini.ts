import { createId, type CVData } from "../shared/cv";
import type { EditSuggestion, JobAnalysis } from "../shared/analysis";
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

function asStringList(value: unknown, max = 10): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(String).map((s) => s.trim()).filter(Boolean).slice(0, max);
}

function buildPrompt(cv: CVData, jobText: string, learnedKeywords: string[] = []): string {
  const learnedBlock =
    learnedKeywords.length > 0
      ? `\nLEARNED_FROM_PAST_REJECTIONS (bias suggestions toward closing these gaps when honest):\n${learnedKeywords.join(", ")}\n`
      : "";

  return `You are an expert CV coach. Analyze the job posting against the candidate CV.
Return ONLY valid JSON (no markdown) with this exact shape:
{
  "matchScore": number 0-100,
  "jobTitle": string,
  "companyGuess": string,
  "location": string,
  "strengths": string[],
  "missingKeywords": string[],
  "mustHaves": string[],
  "niceToHaves": string[],
  "fitReasons": string[],
  "riskReasons": string[],
  "summary": string,
  "interviewTips": string[],
  "suggestions": [
    {
      "section": "summary" | "experience" | "skills" | "education" | "personal",
      "targetId": string | null,
      "field": string | null,
      "title": string,
      "currentText": string,
      "suggestedText": string,
      "rationale": string
    }
  ]
}

Rules:
- Prefer concrete, ATS-friendly rewrites in the same language as the CV (default Turkish if mixed).
- For experience suggestions, set targetId to an existing experience item id when possible.
- Provide 3-7 high-value suggestions.
- Do not invent employers or degrees the candidate never had; rewrite/emphasize existing content.
- interviewTips: 3-5 short interview prep bullets tailored to this role + CV gaps.
- mustHaves: 3-6 hard requirements from the posting.
- niceToHaves: 2-5 preferred skills from the posting.
- fitReasons: 2-4 bullets why this CV fits (honest).
- riskReasons: 2-4 bullets on gaps / interview risks (honest).
- location: city/country/remote if stated, else empty string.
${learnedBlock}
CANDIDATE_CV_JSON:
${JSON.stringify(cv)}

JOB_POSTING_TEXT:
${jobText.slice(0, 30000)}
`;
}

function normalizeSuggestions(raw: unknown): EditSuggestion[] {
  const suggestionsRaw = Array.isArray(raw) ? raw : [];
  return suggestionsRaw.map((item) => {
    const s = (item ?? {}) as Record<string, unknown>;
    const section = String(s.section ?? "summary") as EditSuggestion["section"];
    return {
      id: createId(),
      section: ["summary", "experience", "skills", "education", "personal"].includes(section)
        ? section
        : "summary",
      targetId: s.targetId ? String(s.targetId) : undefined,
      field: s.field ? String(s.field) : undefined,
      title: String(s.title ?? "Öneri"),
      currentText: String(s.currentText ?? ""),
      suggestedText: String(s.suggestedText ?? ""),
      rationale: String(s.rationale ?? ""),
    };
  });
}

function normalizeAnalysis(raw: unknown, jobText: string): JobAnalysis {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const score = Number(obj.matchScore);
  return {
    matchScore: Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 0,
    jobTitle: String(obj.jobTitle ?? "İş İlanı"),
    companyGuess: String(obj.companyGuess ?? ""),
    location: String(obj.location ?? "").trim() || undefined,
    strengths: asStringList(obj.strengths),
    missingKeywords: asStringList(obj.missingKeywords, 16),
    mustHaves: asStringList(obj.mustHaves, 8),
    niceToHaves: asStringList(obj.niceToHaves, 8),
    fitReasons: asStringList(obj.fitReasons, 6),
    riskReasons: asStringList(obj.riskReasons, 6),
    suggestions: normalizeSuggestions(obj.suggestions),
    summary: String(obj.summary ?? ""),
    rawJobTextPreview: jobText.slice(0, 400),
    interviewTips: asStringList(obj.interviewTips, 8),
  };
}

export async function analyzeWithGemini(
  cv: CVData,
  jobText: string,
  learnedKeywords: string[] = [],
): Promise<JobAnalysis> {
  const text = await generateGeminiJson(
    [{ text: buildPrompt(cv, jobText, learnedKeywords) }],
    0.4,
  );
  return normalizeAnalysis(extractJson(text), jobText);
}

/** Weave missing keywords into experience/skills/summary — user still approves before apply. */
export async function rewriteKeywordsWithGemini(opts: {
  cv: CVData;
  missingKeywords: string[];
  jobTitle?: string;
  company?: string;
}): Promise<EditSuggestion[]> {
  const keywords = opts.missingKeywords.map((k) => k.trim()).filter(Boolean).slice(0, 12);
  if (!keywords.length) return [];

  const prompt = `You are an ATS-aware CV editor.
Place the MISSING_KEYWORDS into the candidate's existing experience bullets / skills / summary naturally.
Return ONLY valid JSON:
{
  "suggestions": [
    {
      "section": "summary" | "experience" | "skills",
      "targetId": string | null,
      "field": string | null,
      "title": string,
      "currentText": string,
      "suggestedText": string,
      "rationale": string
    }
  ]
}

Rules:
- Do NOT invent employers, titles, degrees, or metrics the CV does not support.
- Prefer editing experience.description using real experience item ids from the CV.
- For skills, field must be one of: languages, softwareLanguages, computerPrograms, hobbies.
- Keep the same language as the CV content.
- Produce 2-6 suggestions that cover as many keywords as honestly possible.
- Each suggestedText must be ready to replace currentText.

ROLE: ${opts.jobTitle || ""}
COMPANY: ${opts.company || ""}
MISSING_KEYWORDS: ${JSON.stringify(keywords)}
CANDIDATE_CV_JSON:
${JSON.stringify(opts.cv)}
`;

  const text = await generateGeminiJson([{ text: prompt }], 0.35);
  const obj = extractJson(text) as Record<string, unknown>;
  return normalizeSuggestions(obj.suggestions).filter((s) => s.suggestedText.trim());
}
