import { createId, type CVData } from "../shared/cv";
import type { EditSuggestion, JobAnalysis } from "../shared/analysis";
import { generateGeminiJson } from "./geminiClient";

function buildPrompt(cv: CVData, jobText: string): string {
  return `You are an expert CV coach. Analyze the job posting against the candidate CV.
Return ONLY valid JSON (no markdown) with this exact shape:
{
  "matchScore": number 0-100,
  "jobTitle": string,
  "companyGuess": string,
  "strengths": string[],
  "missingKeywords": string[],
  "summary": string,
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

CANDIDATE_CV_JSON:
${JSON.stringify(cv)}

JOB_POSTING_TEXT:
${jobText.slice(0, 30000)}
`;
}

function normalizeAnalysis(raw: unknown, jobText: string): JobAnalysis {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const suggestionsRaw = Array.isArray(obj.suggestions) ? obj.suggestions : [];
  const suggestions: EditSuggestion[] = suggestionsRaw.map((item) => {
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

  const score = Number(obj.matchScore);
  return {
    matchScore: Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 0,
    jobTitle: String(obj.jobTitle ?? "İş İlanı"),
    companyGuess: String(obj.companyGuess ?? ""),
    strengths: Array.isArray(obj.strengths) ? obj.strengths.map(String) : [],
    missingKeywords: Array.isArray(obj.missingKeywords)
      ? obj.missingKeywords.map(String)
      : [],
    suggestions,
    summary: String(obj.summary ?? ""),
    rawJobTextPreview: jobText.slice(0, 400),
  };
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

export async function analyzeWithGemini(cv: CVData, jobText: string): Promise<JobAnalysis> {
  const text = await generateGeminiJson([{ text: buildPrompt(cv, jobText) }], 0.4);
  return normalizeAnalysis(extractJson(text), jobText);
}
