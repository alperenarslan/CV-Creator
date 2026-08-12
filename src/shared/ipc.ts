import type { CVData } from "./cv";
import type {
  AdaptLanguageRequest,
  AdaptLanguageResult,
  AnalyzeJobRequest,
  AnalyzeJobResult,
  CoverLetterTone,
  InterviewBankRequest,
  InterviewBankResult,
  JobAnalysis,
  KeywordRewriteRequest,
  KeywordRewriteResult,
  ShortCvRequest,
  ShortCvResult,
} from "./analysis";
import type { AppPrefs, ImportEngine } from "./prefs";
import type { JobApplication, UpdateApplicationPatch } from "./tracker";
import type { AtsReport } from "./ats";

export const IPC = {
  cvLoad: "cv:load",
  cvSave: "cv:save",
  cvImport: "cv:import",
  exportTxt: "export:txt",
  exportHtml: "export:html",
  exportPdf: "export:pdf",
  analyzeJob: "job:analyze",
  coverLetter: "job:cover-letter",
  keywordRewrite: "job:keyword-rewrite",
  adaptLanguage: "job:adapt-language",
  shortCv: "job:short-cv",
  interviewBank: "job:interview-bank",
  atsCheck: "job:ats-check",
  saveSnapshot: "job:save-snapshot",
  loadSnapshot: "job:load-snapshot",
  exportPackage: "job:export-package",
  exportIcs: "job:export-ics",
  openPath: "shell:open-path",
  hasGeminiKey: "ai:has-key",
  setGeminiKey: "ai:set-key",
  prefsLoad: "prefs:load",
  prefsSave: "prefs:save",
  appsLoad: "apps:load",
  appsUpdate: "apps:update",
  appsDelete: "apps:delete",
  openExternal: "shell:open-external",
  launchLegacy: "legacy:launch",
} as const;

export type ExportFormat = "txt" | "html" | "pdf";

export interface ExportResult {
  ok: boolean;
  filePath?: string;
  error?: string;
  canceled?: boolean;
}

export interface ImportCVResult {
  ok: boolean;
  cv?: CVData;
  error?: string;
  canceled?: boolean;
  sourceName?: string;
  engine?: ImportEngine;
  photoFound?: boolean;
}

export interface LegacyLaunchResult {
  ok: boolean;
  error?: string;
}

export interface CoverLetterRequest {
  cv: CVData;
  analysis: JobAnalysis;
  tone: CoverLetterTone;
  applicationId?: string;
}

export interface CoverLetterApiResult {
  ok: boolean;
  subject?: string;
  body?: string;
  error?: string;
}

export interface SnapshotSaveRequest {
  applicationId: string;
  cv: CVData;
}

export interface SnapshotLoadResult {
  ok: boolean;
  cv?: CVData;
  error?: string;
}

export interface PackageExportApiRequest {
  cv: CVData;
  analysis: JobAnalysis;
  coverLetter?: string;
  coverSubject?: string;
  applicationId?: string;
  includePdf?: boolean;
}

export interface PackageExportApiResult {
  ok: boolean;
  folderPath?: string;
  error?: string;
  canceled?: boolean;
}

export interface AtsCheckRequest {
  cv: CVData;
  missingKeywords?: string[];
}

export interface ExportIcsRequest {
  applicationId: string;
}

export interface ElectronAPI {
  loadCV: () => Promise<CVData>;
  saveCV: (cv: CVData) => Promise<{ ok: boolean }>;
  importCV: (engine: ImportEngine) => Promise<ImportCVResult>;
  exportTxt: (cv: CVData) => Promise<ExportResult>;
  exportHtml: (cv: CVData) => Promise<ExportResult>;
  exportPdf: (cv: CVData) => Promise<ExportResult>;
  analyzeJob: (payload: AnalyzeJobRequest) => Promise<AnalyzeJobResult>;
  generateCoverLetter: (payload: CoverLetterRequest) => Promise<CoverLetterApiResult>;
  rewriteKeywords: (payload: KeywordRewriteRequest) => Promise<KeywordRewriteResult>;
  adaptLanguage: (payload: AdaptLanguageRequest) => Promise<AdaptLanguageResult>;
  shortenCv: (payload: ShortCvRequest) => Promise<ShortCvResult>;
  interviewBank: (payload: InterviewBankRequest) => Promise<InterviewBankResult>;
  runAtsCheck: (payload: AtsCheckRequest) => Promise<AtsReport>;
  saveSnapshot: (payload: SnapshotSaveRequest) => Promise<{ ok: boolean; error?: string }>;
  loadSnapshot: (applicationId: string) => Promise<SnapshotLoadResult>;
  exportPackage: (payload: PackageExportApiRequest) => Promise<PackageExportApiResult>;
  exportIcs: (payload: ExportIcsRequest) => Promise<ExportResult>;
  openPath: (targetPath: string) => Promise<{ ok: boolean; error?: string }>;
  hasGeminiKey: () => Promise<boolean>;
  setGeminiKey: (key: string) => Promise<{ ok: boolean }>;
  loadPrefs: () => Promise<AppPrefs>;
  savePrefs: (prefs: Partial<AppPrefs>) => Promise<AppPrefs>;
  loadApplications: () => Promise<JobApplication[]>;
  updateApplication: (patch: UpdateApplicationPatch) => Promise<JobApplication | null>;
  deleteApplication: (id: string) => Promise<{ ok: boolean }>;
  openExternal: (url: string) => Promise<{ ok: boolean; error?: string }>;
  launchLegacy: () => Promise<LegacyLaunchResult>;
}

declare global {
  interface Window {
    api: ElectronAPI;
  }
}
