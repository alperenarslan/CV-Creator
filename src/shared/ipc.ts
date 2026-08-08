import type { CVData } from "./cv";
import type { AnalyzeJobRequest, AnalyzeJobResult } from "./analysis";
import type { AppPrefs, ImportEngine } from "./prefs";
import type { JobApplication, UpdateApplicationPatch } from "./tracker";

export const IPC = {
  cvLoad: "cv:load",
  cvSave: "cv:save",
  cvImport: "cv:import",
  exportTxt: "export:txt",
  exportHtml: "export:html",
  exportPdf: "export:pdf",
  analyzeJob: "job:analyze",
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

export interface ElectronAPI {
  loadCV: () => Promise<CVData>;
  saveCV: (cv: CVData) => Promise<{ ok: boolean }>;
  importCV: (engine: ImportEngine) => Promise<ImportCVResult>;
  exportTxt: (cv: CVData) => Promise<ExportResult>;
  exportHtml: (cv: CVData) => Promise<ExportResult>;
  exportPdf: (cv: CVData) => Promise<ExportResult>;
  analyzeJob: (payload: AnalyzeJobRequest) => Promise<AnalyzeJobResult>;
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
