export interface EditSuggestion {
  id: string;
  section: "summary" | "experience" | "skills" | "education" | "personal";
  targetId?: string;
  field?: string;
  title: string;
  currentText: string;
  suggestedText: string;
  rationale: string;
}

export interface JobAnalysis {
  matchScore: number;
  jobTitle: string;
  companyGuess: string;
  strengths: string[];
  missingKeywords: string[];
  suggestions: EditSuggestion[];
  summary: string;
  rawJobTextPreview: string;
}

export interface AnalyzeJobRequest {
  url: string;
  fallbackText?: string;
  cv: import("./cv").CVData;
}

export interface AnalyzeJobResult {
  ok: boolean;
  analysis?: JobAnalysis;
  error?: string;
  usedFallback?: boolean;
  applicationId?: string;
}
