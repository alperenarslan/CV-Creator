import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "node:path";
import dotenv from "./dotenv";
import { IPC } from "../shared/ipc";
import type { CVData } from "../shared/cv";
import type { AnalyzeJobRequest } from "../shared/analysis";
import type { AppPrefs, ImportEngine } from "../shared/prefs";
import {
  getGeminiApiKey,
  loadCV,
  loadPrefs,
  saveCV,
  savePrefs,
  setGeminiApiKey,
} from "./store";
import { clearSessionGeminiApiKey } from "./geminiSession";
import { exportHtml, exportPdf, exportTxt } from "./export";
import { fetchJobText } from "./jobFetch";
import { analyzeWithGemini } from "./gemini";
import { launchLegacyApp } from "./legacy";
import { importCVFromFile } from "./cvImport";
import {
  deleteApplication,
  loadApplications,
  updateApplication,
  upsertFromAnalysis,
} from "./applicationsStore";
import type { UpdateApplicationPatch } from "../shared/tracker";

dotenv();

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 720,
    minHeight: 640,
    title: "CV Creator",
    backgroundColor: loadPrefs().theme === "dark" ? "#0f171c" : "#e7eef2",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../../dist/index.html"));
  }
}

function registerIpc() {
  ipcMain.handle(IPC.cvLoad, () => loadCV());
  ipcMain.handle(IPC.cvSave, (_e, cv: CVData) => {
    saveCV(cv);
    return { ok: true };
  });
  ipcMain.handle(IPC.cvImport, async (_e, engine: ImportEngine) => {
    if (!mainWindow) return { ok: false, error: "No window" };
    return importCVFromFile(mainWindow, engine === "gemini" ? "gemini" : "local");
  });

  ipcMain.handle(IPC.exportTxt, async (_e, cv: CVData) => {
    if (!mainWindow) return { ok: false, error: "No window" };
    return exportTxt(mainWindow, cv);
  });
  ipcMain.handle(IPC.exportHtml, async (_e, cv: CVData) => {
    if (!mainWindow) return { ok: false, error: "No window" };
    return exportHtml(mainWindow, cv);
  });
  ipcMain.handle(IPC.exportPdf, async (_e, cv: CVData) => {
    if (!mainWindow) return { ok: false, error: "No window" };
    return exportPdf(mainWindow, cv);
  });

  ipcMain.handle(IPC.hasGeminiKey, () => Boolean(getGeminiApiKey()));
  ipcMain.handle(IPC.setGeminiKey, (_e, key: string) => {
    setGeminiApiKey(key);
    return { ok: true };
  });
  ipcMain.handle(IPC.prefsLoad, () => loadPrefs());
  ipcMain.handle(IPC.prefsSave, (_e, prefs: Partial<AppPrefs>) => savePrefs(prefs));

  ipcMain.handle(IPC.analyzeJob, async (_e, payload: AnalyzeJobRequest) => {
    try {
      let jobText = "";
      let usedFallback = false;

      if (payload.url?.trim()) {
        const fetched = await fetchJobText(payload.url);
        if (fetched.ok && fetched.text) {
          jobText = fetched.text;
        } else if (payload.fallbackText?.trim()) {
          jobText = payload.fallbackText.trim();
          usedFallback = true;
        } else {
          return {
            ok: false,
            error: fetched.error || "Job text could not be fetched.",
            usedFallback: false,
          };
        }
      } else if (payload.fallbackText?.trim()) {
        jobText = payload.fallbackText.trim();
        usedFallback = true;
      } else {
        return { ok: false, error: "Job URL is required." };
      }

      const analysis = await analyzeWithGemini(payload.cv, jobText);
      const url = payload.url?.trim() || "manual://paste";
      const saved = upsertFromAnalysis({
        url,
        jobTitle: analysis.jobTitle,
        company: analysis.companyGuess,
        matchScore: analysis.matchScore,
        summary: analysis.summary,
        strengths: analysis.strengths,
        missingKeywords: analysis.missingKeywords,
      });
      return { ok: true, analysis, usedFallback, applicationId: saved.id };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  ipcMain.handle(IPC.appsLoad, () => loadApplications());
  ipcMain.handle(IPC.appsUpdate, (_e, patch: UpdateApplicationPatch) => updateApplication(patch));
  ipcMain.handle(IPC.appsDelete, (_e, id: string) => ({ ok: deleteApplication(id) }));
  ipcMain.handle(IPC.openExternal, async (_e, url: string) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { ok: false, error: "Only http/https links are allowed." };
      }
      await shell.openExternal(parsed.toString());
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.launchLegacy, () => launchLegacyApp());
}

app.whenReady().then(() => {
  registerIpc();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", () => {
  clearSessionGeminiApiKey();
});

app.on("window-all-closed", () => {
  clearSessionGeminiApiKey();
  if (process.platform !== "darwin") app.quit();
});
