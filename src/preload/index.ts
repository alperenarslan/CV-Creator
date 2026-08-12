import { contextBridge, ipcRenderer } from "electron";
import {
  IPC,
  type AtsCheckRequest,
  type CoverLetterRequest,
  type ElectronAPI,
  type ExportIcsRequest,
  type PackageExportApiRequest,
  type SnapshotSaveRequest,
} from "../shared/ipc";
import type { CVData } from "../shared/cv";
import type {
  AdaptLanguageRequest,
  AnalyzeJobRequest,
  InterviewBankRequest,
  KeywordRewriteRequest,
  ShortCvRequest,
} from "../shared/analysis";
import type { AppPrefs, ImportEngine } from "../shared/prefs";
import type { UpdateApplicationPatch } from "../shared/tracker";

const api: ElectronAPI = {
  loadCV: () => ipcRenderer.invoke(IPC.cvLoad),
  saveCV: (cv: CVData) => ipcRenderer.invoke(IPC.cvSave, cv),
  importCV: (engine: ImportEngine) => ipcRenderer.invoke(IPC.cvImport, engine),
  exportTxt: (cv) => ipcRenderer.invoke(IPC.exportTxt, cv),
  exportHtml: (cv) => ipcRenderer.invoke(IPC.exportHtml, cv),
  exportPdf: (cv) => ipcRenderer.invoke(IPC.exportPdf, cv),
  analyzeJob: (payload: AnalyzeJobRequest) => ipcRenderer.invoke(IPC.analyzeJob, payload),
  generateCoverLetter: (payload: CoverLetterRequest) =>
    ipcRenderer.invoke(IPC.coverLetter, payload),
  rewriteKeywords: (payload: KeywordRewriteRequest) =>
    ipcRenderer.invoke(IPC.keywordRewrite, payload),
  adaptLanguage: (payload: AdaptLanguageRequest) =>
    ipcRenderer.invoke(IPC.adaptLanguage, payload),
  shortenCv: (payload: ShortCvRequest) => ipcRenderer.invoke(IPC.shortCv, payload),
  interviewBank: (payload: InterviewBankRequest) =>
    ipcRenderer.invoke(IPC.interviewBank, payload),
  runAtsCheck: (payload: AtsCheckRequest) => ipcRenderer.invoke(IPC.atsCheck, payload),
  saveSnapshot: (payload: SnapshotSaveRequest) => ipcRenderer.invoke(IPC.saveSnapshot, payload),
  loadSnapshot: (applicationId: string) => ipcRenderer.invoke(IPC.loadSnapshot, applicationId),
  exportPackage: (payload: PackageExportApiRequest) =>
    ipcRenderer.invoke(IPC.exportPackage, payload),
  exportIcs: (payload: ExportIcsRequest) => ipcRenderer.invoke(IPC.exportIcs, payload),
  openPath: (targetPath: string) => ipcRenderer.invoke(IPC.openPath, targetPath),
  hasGeminiKey: () => ipcRenderer.invoke(IPC.hasGeminiKey),
  setGeminiKey: (key: string) => ipcRenderer.invoke(IPC.setGeminiKey, key),
  loadPrefs: () => ipcRenderer.invoke(IPC.prefsLoad),
  savePrefs: (prefs: Partial<AppPrefs>) => ipcRenderer.invoke(IPC.prefsSave, prefs),
  loadApplications: () => ipcRenderer.invoke(IPC.appsLoad),
  updateApplication: (patch: UpdateApplicationPatch) =>
    ipcRenderer.invoke(IPC.appsUpdate, patch),
  deleteApplication: (id: string) => ipcRenderer.invoke(IPC.appsDelete, id),
  openExternal: (url: string) => ipcRenderer.invoke(IPC.openExternal, url),
  launchLegacy: () => ipcRenderer.invoke(IPC.launchLegacy),
};

contextBridge.exposeInMainWorld("api", api);
