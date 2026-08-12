import { type CVData } from "../shared/cv";
import type { InterviewQuestion, JobAnalysis } from "../shared/analysis";
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

/** Compress master CV into a tighter 1-page oriented variant for this job. */
export async function shortenCvForJob(opts: {
  cv: CVData;
  analysis: JobAnalysis;
}): Promise<CVData> {
  const prompt = `You compress a master CV into a shorter job-targeted version (aim for ~1 page of content).
Return ONLY valid JSON:
{
  "summary": string,
  "skills": {
    "languages": string,
    "softwareLanguages": string,
    "hobbies": string,
    "computerPrograms": string
  },
  "experience": [ { "id": string, "description": string, "keep": boolean } ],
  "education": [ { "id": string, "keep": boolean } ]
}

Rules:
- Keep the same language as the CV.
- Do NOT invent employers, degrees, or metrics.
- Shorten experience descriptions; drop or heavily trim least-relevant roles (keep:false).
- Prefer roles matching: ${opts.analysis.jobTitle} / keywords ${opts.analysis.missingKeywords.slice(0, 8).join(", ")}.
- Keep most recent / most relevant education.
- Hobbies may be emptied if space is tight.
- experience/education ids must match the input.

ROLE: ${opts.analysis.jobTitle}
COMPANY: ${opts.analysis.companyGuess}
MUST_HAVES: ${(opts.analysis.mustHaves || []).join("; ")}
CANDIDATE_CV_JSON:
${JSON.stringify(opts.cv)}
`;

  const text = await generateGeminiJson([{ text: prompt }], 0.35);
  const raw = extractJson(text) as Record<string, unknown>;
  const next: CVData = structuredClone(opts.cv);

  if (typeof raw.summary === "string" && raw.summary.trim()) {
    next.summary = raw.summary.trim();
  }

  const skills = (raw.skills ?? {}) as Record<string, unknown>;
  for (const key of ["languages", "softwareLanguages", "hobbies", "computerPrograms"] as const) {
    if (typeof skills[key] === "string") next.skills[key] = String(skills[key]);
  }

  if (Array.isArray(raw.experience)) {
    const kept: typeof next.experience = [];
    for (const item of raw.experience) {
      const row = (item ?? {}) as Record<string, unknown>;
      const id = String(row.id ?? "");
      const src = next.experience.find((e) => e.id === id);
      if (!src) continue;
      if (row.keep === false) continue;
      const copy = { ...src };
      if (typeof row.description === "string") copy.description = row.description;
      kept.push(copy);
    }
    if (kept.length) next.experience = kept;
  }

  if (Array.isArray(raw.education)) {
    const kept: typeof next.education = [];
    for (const item of raw.education) {
      const row = (item ?? {}) as Record<string, unknown>;
      const id = String(row.id ?? "");
      const src = next.education.find((e) => e.id === id);
      if (!src) continue;
      if (row.keep === false) continue;
      kept.push({ ...src });
    }
    if (kept.length) next.education = kept;
  }

  return next;
}

export async function generateInterviewBank(opts: {
  cv: CVData;
  analysis: JobAnalysis;
}): Promise<InterviewQuestion[]> {
  const prompt = `You prepare interview questions for this candidate and role.
Return ONLY valid JSON:
{
  "questions": [
    { "question": string, "answerOutline": string }
  ]
}

Rules:
- Provide exactly 8 questions.
- Mix behavioral, technical/role-specific, and gap-probing questions.
- answerOutline: 2-4 short bullets the candidate can expand from THEIR CV only — no invented facts.
- Same language as the CV (default Turkish if mixed).

ROLE: ${opts.analysis.jobTitle}
COMPANY: ${opts.analysis.companyGuess}
GAPS: ${opts.analysis.missingKeywords.join("; ")}
RISKS: ${(opts.analysis.riskReasons || []).join("; ")}
CANDIDATE_CV_JSON:
${JSON.stringify(opts.cv)}
`;

  const text = await generateGeminiJson([{ text: prompt }], 0.45);
  const raw = extractJson(text) as Record<string, unknown>;
  const list = Array.isArray(raw.questions) ? raw.questions : [];
  return list
    .map((item) => {
      const q = (item ?? {}) as Record<string, unknown>;
      return {
        question: String(q.question ?? "").trim(),
        answerOutline: String(q.answerOutline ?? "").trim(),
      };
    })
    .filter((q) => q.question)
    .slice(0, 8);
}
