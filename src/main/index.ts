import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import path from "node:path";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import dotenv from "./dotenv";
import {
  IPC,
  type AtsCheckRequest,
  type CoverLetterRequest,
  type ExportIcsRequest,
  type IngestJobProgress,
  type IngestJobUrlItem,
  type IngestJobUrlsRequest,
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
import { analyzeWithGemini, categorizeJobListing, rewriteKeywordsWithGemini } from "./gemini";
import { adaptCvLanguage } from "./adaptLanguage";
import { generateInterviewBank, shortenCvForJob } from "./shortCv";
import { generateCoverLetter } from "./coverLetter";
import { exportApplicationPackage } from "./packageExport";
import { loadCvSnapshot, saveCvSnapshot } from "./snapshotStore";
import { runAtsCheck } from "../shared/ats";
import { launchLegacyApp } from "./legacy";
import { importCVFromFile } from "./cvImport";
import {
  createListingFromUrl,
  deleteApplication,
  loadApplications,
  updateApplication,
  upsertFromAnalysis,
} from "./applicationsStore";
import {
  buildInterviewIcs,
  collectLearnedKeywords,
  parseJobUrls,
  type UpdateApplicationPatch,
} from "../shared/tracker";

dotenv();

let mainWindow: BrowserWindow | null = null;

function resolveAppIcon(): string | undefined {
  const candidates = [
    path.join(process.cwd(), "resources", "icon-256.png"),
    path.join(process.cwd(), "resources", "icon.png"),
    path.join(process.cwd(), "public", "icon.png"),
    path.join(__dirname, "../../resources/icon-256.png"),
    path.join(__dirname, "../../resources/icon.png"),
    path.join(__dirname, "../../public/icon.png"),
  ];
  return candidates.find((p) => fs.existsSync(p));
}

function createWindow() {
  const icon = resolveAppIcon();
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 720,
    minHeight: 640,
    title: "CV Creator",
    ...(icon ? { icon } : {}),
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

      const learned =
        payload.learnedKeywords?.length
          ? payload.learnedKeywords
          : collectLearnedKeywords(loadApplications());
      const analysis = await analyzeWithGemini(payload.cv, jobText, learned);
      const url = payload.url?.trim() || "manual://paste";
      const saved = upsertFromAnalysis({
        url,
        jobTitle: analysis.jobTitle,
        company: analysis.companyGuess,
        matchScore: analysis.matchScore,
        summary: analysis.summary,
        strengths: analysis.strengths,
        missingKeywords: analysis.missingKeywords,
        interviewTips: analysis.interviewTips,
      });
      return { ok: true, analysis, usedFallback, applicationId: saved.id };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  ipcMain.handle(IPC.coverLetter, async (_e, payload: CoverLetterRequest) => {
    try {
      const draft = await generateCoverLetter({
        cv: payload.cv,
        analysis: payload.analysis,
        tone: payload.tone,
        locale: loadPrefs().locale,
      });
      if (payload.applicationId) {
        updateApplication({
          id: payload.applicationId,
          coverLetter: draft.body,
          coverSubject: draft.subject,
        });
      }
      return { ok: true, subject: draft.subject, body: draft.body };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.keywordRewrite, async (_e, payload: KeywordRewriteRequest) => {
    try {
      const suggestions = await rewriteKeywordsWithGemini({
        cv: payload.cv,
        missingKeywords: payload.missingKeywords,
        jobTitle: payload.jobTitle,
        company: payload.company,
      });
      return { ok: true, suggestions };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.adaptLanguage, async (_e, payload: AdaptLanguageRequest) => {
    try {
      const draft = await adaptCvLanguage({
        cv: payload.cv,
        targetLocale: payload.targetLocale,
        coverLetter: payload.coverLetter,
        coverSubject: payload.coverSubject,
      });
      return {
        ok: true,
        cv: draft.cv,
        coverLetter: draft.coverLetter,
        coverSubject: draft.coverSubject,
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.shortCv, async (_e, payload: ShortCvRequest) => {
    try {
      const cv = await shortenCvForJob({ cv: payload.cv, analysis: payload.analysis });
      return { ok: true, cv };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.interviewBank, async (_e, payload: InterviewBankRequest) => {
    try {
      const questions = await generateInterviewBank({
        cv: payload.cv,
        analysis: payload.analysis,
      });
      return { ok: true, questions };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.atsCheck, (_e, payload: AtsCheckRequest) =>
    runAtsCheck({
      cv: payload.cv,
      missingKeywords: payload.missingKeywords,
      locale: loadPrefs().locale,
    }),
  );

  ipcMain.handle(IPC.saveSnapshot, (_e, payload: SnapshotSaveRequest) => {
    try {
      saveCvSnapshot(payload.applicationId, payload.cv);
      updateApplication({ id: payload.applicationId, hasSnapshot: true });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.loadSnapshot, (_e, applicationId: string) => {
    const cv = loadCvSnapshot(applicationId);
    if (!cv) return { ok: false, error: "Snapshot not found" };
    return { ok: true, cv };
  });

  ipcMain.handle(IPC.exportPackage, async (_e, payload: PackageExportApiRequest) => {
    if (!mainWindow) return { ok: false, error: "No window" };
    const result = await exportApplicationPackage(mainWindow, payload);
    if (result.ok && result.folderPath && payload.applicationId) {
      updateApplication({
        id: payload.applicationId,
        packageFolder: result.folderPath,
      });
    }
    return result;
  });

  ipcMain.handle(IPC.appsLoad, () => loadApplications());
  ipcMain.handle(IPC.appsUpdate, (_e, patch: UpdateApplicationPatch) => updateApplication(patch));
  ipcMain.handle(IPC.appsDelete, (_e, id: string) => ({ ok: deleteApplication(id) }));
  ipcMain.handle(IPC.appsIngestUrls, async (event, payload: IngestJobUrlsRequest) => {
    const urls = parseJobUrls(String(payload?.raw ?? ""));
    if (!urls.length) {
      return { ok: false, items: [], error: "No valid http(s) URLs found." };
    }

    const hasKey = Boolean(getGeminiApiKey());
    const items: IngestJobUrlItem[] = [];

    for (let index = 0; index < urls.length; index++) {
      const url = urls[index];
      const existed = loadApplications().some((a) => {
        try {
          return (
            new URL(a.url).href.replace(/\/$/, "").toLowerCase() ===
            new URL(url).href.replace(/\/$/, "").toLowerCase()
          );
        } catch {
          return a.url.trim().toLowerCase() === url.trim().toLowerCase();
        }
      });
      const listing = createListingFromUrl(url);
      const created = !existed;

      updateApplication({ id: listing.id, fetchStatus: "fetching", fetchError: null });
      const progressFetching: IngestJobProgress = {
        index,
        total: urls.length,
        url,
        id: listing.id,
        fetchStatus: "fetching",
      };
      event.sender.send(IPC.appsIngestProgress, progressFetching);

      try {
        const fetched = await fetchJobText(url);
        if (!fetched.ok || !fetched.text) {
          const status = fetched.blocked ? "blocked" : "error";
          const error = fetched.error || "Fetch failed";
          updateApplication({
            id: listing.id,
            fetchStatus: status,
            fetchError: error,
          });
          const item: IngestJobUrlItem = {
            url,
            id: listing.id,
            fetchStatus: status,
            error,
            created,
          };
          items.push(item);
          event.sender.send(IPC.appsIngestProgress, {
            index,
            total: urls.length,
            url,
            id: listing.id,
            fetchStatus: status,
            error,
          } satisfies IngestJobProgress);
          continue;
        }

        if (hasKey) {
          try {
            const meta = await categorizeJobListing(fetched.text);
            updateApplication({
              id: listing.id,
              jobTitle: meta.jobTitle || listing.jobTitle,
              company: meta.company || listing.company,
              summary: meta.summary || fetched.text.slice(0, 280),
              categories: meta.categories.length ? meta.categories : null,
              fetchStatus: "ready",
              fetchError: null,
            });
          } catch (err) {
            updateApplication({
              id: listing.id,
              summary: fetched.text.slice(0, 280),
              fetchStatus: "ready",
              fetchError: err instanceof Error ? err.message : String(err),
            });
          }
        } else {
          updateApplication({
            id: listing.id,
            summary: fetched.text.slice(0, 280),
            fetchStatus: "ready",
            fetchError: "API key missing — listing text saved without categories",
          });
        }

        const item: IngestJobUrlItem = {
          url,
          id: listing.id,
          fetchStatus: "ready",
          created,
        };
        items.push(item);
        event.sender.send(IPC.appsIngestProgress, {
          index,
          total: urls.length,
          url,
          id: listing.id,
          fetchStatus: "ready",
        } satisfies IngestJobProgress);
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        updateApplication({ id: listing.id, fetchStatus: "error", fetchError: error });
        items.push({ url, id: listing.id, fetchStatus: "error", error, created });
        event.sender.send(IPC.appsIngestProgress, {
          index,
          total: urls.length,
          url,
          id: listing.id,
          fetchStatus: "error",
          error,
        } satisfies IngestJobProgress);
      }
    }

    return { ok: true, items };
  });
  ipcMain.handle(IPC.openPath, async (_e, targetPath: string) => {
    try {
      if (!targetPath || !fs.existsSync(targetPath)) {
        return { ok: false, error: "Path not found" };
      }
      const err = await shell.openPath(targetPath);
      return err ? { ok: false, error: err } : { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
  ipcMain.handle(IPC.exportIcs, async (_e, payload: ExportIcsRequest) => {
    if (!mainWindow) return { ok: false, error: "No window" };
    try {
      const appRow = loadApplications().find((a) => a.id === payload.applicationId);
      if (!appRow) return { ok: false, error: "Application not found" };
      const ics = buildInterviewIcs(appRow, loadPrefs().locale);
      if (!ics) return { ok: false, error: "Interview date missing" };
      const pick = await dialog.showSaveDialog(mainWindow, {
        defaultPath: `Interview_${(appRow.company || "Company").replace(/[^\w\-]+/g, "_")}.ics`,
        filters: [{ name: "Calendar", extensions: ["ics"] }],
      });
      if (pick.canceled || !pick.filePath) return { ok: false, canceled: true };
      await fsPromises.writeFile(pick.filePath, ics, "utf8");
      return { ok: true, filePath: pick.filePath };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
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
  if (process.platform === "win32") {
    app.setAppUserModelId("com.alperenarslan.cvcreator");
  }
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
