import type { CVData } from "../shared/cv";
import type { CoverLetterTone, JobAnalysis } from "../shared/analysis";
import type { AppLocale } from "../shared/prefs";
import { generateGeminiJson } from "./geminiClient";

export type { CoverLetterTone };

export interface CoverLetterDraft {
  subject: string;
  body: string;
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Gemini JSON döndürmedi.");
  return JSON.parse(candidate.slice(start, end + 1));
}

function toneRule(tone: CoverLetterTone): string {
  if (tone === "warm") return "Warm, human, still professional — no slang.";
  if (tone === "concise") return "Very concise: 3 short paragraphs max, high signal.";
  return "Professional and confident; clear value proposition.";
}

export async function generateCoverLetter(opts: {
  cv: CVData;
  analysis: JobAnalysis;
  tone: CoverLetterTone;
  locale: AppLocale;
}): Promise<CoverLetterDraft> {
  const lang = opts.locale === "tr" ? "Turkish" : "English";
  const prompt = `You write application cover letters / motivation letters.
Return ONLY valid JSON (no markdown):
{
  "subject": string,
  "body": string
}

Rules:
- Language: ${lang}
- Tone: ${toneRule(opts.tone)}
- 180–320 words for professional/warm; shorter if concise.
- Reference the role and company when known.
- Use only facts present in the CV; do not invent employers, degrees, or metrics.
- Mirror 2–4 missing keywords naturally if they fit real experience.
- Sign with the candidate's real name from the CV.
- body should be plain text with paragraph breaks (\\n\\n).

ROLE: ${opts.analysis.jobTitle}
COMPANY: ${opts.analysis.companyGuess || "(unknown)"}
MATCH_SUMMARY: ${opts.analysis.summary}
STRENGTHS: ${opts.analysis.strengths.join("; ")}
MISSING_KEYWORDS: ${opts.analysis.missingKeywords.join("; ")}

CANDIDATE_CV_JSON:
${JSON.stringify(opts.cv)}
`;

  const text = await generateGeminiJson([{ text: prompt }], 0.55);
  const raw = extractJson(text) as Record<string, unknown>;
  const body = String(raw.body ?? "").trim();
  if (!body) throw new Error(opts.locale === "tr" ? "Mektup boş geldi." : "Empty cover letter.");
  return {
    subject: String(raw.subject ?? "").trim() || opts.analysis.jobTitle,
    body,
  };
}
