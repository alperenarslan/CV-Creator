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
  /** Optional interview prep bullets from Gemini */
  interviewTips?: string[];
  location?: string;
  mustHaves?: string[];
  niceToHaves?: string[];
  fitReasons?: string[];
  riskReasons?: string[];
  interviewQuestions?: InterviewQuestion[];
}

export interface InterviewQuestion {
  question: string;
  answerOutline: string;
}

export interface AnalyzeJobRequest {
  url: string;
  fallbackText?: string;
  cv: import("./cv").CVData;
  /** Keywords learned from past rejections to bias suggestions */
  learnedKeywords?: string[];
}

export interface AnalyzeJobResult {
  ok: boolean;
  analysis?: JobAnalysis;
  error?: string;
  usedFallback?: boolean;
  applicationId?: string;
}

export type CoverLetterTone = "professional" | "warm" | "concise";

export type AdaptLocale = "tr" | "en";

export interface KeywordRewriteRequest {
  cv: import("./cv").CVData;
  missingKeywords: string[];
  jobTitle?: string;
  company?: string;
}

export interface KeywordRewriteResult {
  ok: boolean;
  suggestions?: EditSuggestion[];
  error?: string;
}

export interface AdaptLanguageRequest {
  cv: import("./cv").CVData;
  targetLocale: AdaptLocale;
  coverLetter?: string;
  coverSubject?: string;
}

export interface AdaptLanguageResult {
  ok: boolean;
  cv?: import("./cv").CVData;
  coverLetter?: string;
  coverSubject?: string;
  error?: string;
}

export interface ShortCvRequest {
  cv: import("./cv").CVData;
  analysis: JobAnalysis;
}

export interface ShortCvResult {
  ok: boolean;
  cv?: import("./cv").CVData;
  error?: string;
}

export interface InterviewBankRequest {
  cv: import("./cv").CVData;
  analysis: JobAnalysis;
}

export interface InterviewBankResult {
  ok: boolean;
  questions?: InterviewQuestion[];
  error?: string;
}
