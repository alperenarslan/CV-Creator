import { createEmptyCV, normalizeCVData, type CVData } from "../shared/cv";
import { runAtsCheck } from "../shared/ats";
import type { ElectronAPI } from "../shared/ipc";
import { defaultPrefs, type AppPrefs } from "../shared/prefs";
import type { JobApplication, UpdateApplicationPatch } from "../shared/tracker";

const PREFS_KEY = "cvcreator.browser.prefs";
const CV_KEY = "cvcreator.browser.cv";
const APPS_KEY = "cvcreator.browser.apps";

const DESKTOP_ONLY = "Bu işlem yalnızca masaüstü uygulamasında çalışır";

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

/** Browser / Design Mode preview when Electron preload is absent. */
export function installBrowserApiIfNeeded() {
  if (typeof window === "undefined" || window.api) return;

  const api: ElectronAPI = {
    loadCV: async () => {
      const raw = readJson<unknown | null>(CV_KEY, null);
      return raw ? normalizeCVData(raw) : createEmptyCV();
    },
    saveCV: async (cv: CVData) => {
      writeJson(CV_KEY, cv);
      return { ok: true };
    },
    importCV: async () => ({ ok: false, canceled: true, error: DESKTOP_ONLY }),
    exportTxt: async () => ({ ok: false, canceled: true, error: DESKTOP_ONLY }),
    exportHtml: async () => ({ ok: false, canceled: true, error: DESKTOP_ONLY }),
    exportPdf: async () => ({ ok: false, canceled: true, error: DESKTOP_ONLY }),
    analyzeJob: async () => ({ ok: false, error: DESKTOP_ONLY }),
    generateCoverLetter: async () => ({ ok: false, error: DESKTOP_ONLY }),
    rewriteKeywords: async () => ({ ok: false, error: DESKTOP_ONLY }),
    adaptLanguage: async () => ({ ok: false, error: DESKTOP_ONLY }),
    shortenCv: async () => ({ ok: false, error: DESKTOP_ONLY }),
    interviewBank: async () => ({ ok: false, error: DESKTOP_ONLY }),
    runAtsCheck: async (payload) =>
      runAtsCheck({ cv: payload.cv, missingKeywords: payload.missingKeywords }),
    saveSnapshot: async () => ({ ok: false, error: DESKTOP_ONLY }),
    loadSnapshot: async () => ({ ok: false, error: DESKTOP_ONLY }),
    exportPackage: async () => ({ ok: false, canceled: true, error: DESKTOP_ONLY }),
    exportIcs: async () => ({ ok: false, canceled: true, error: DESKTOP_ONLY }),
    openPath: async () => ({ ok: false, error: DESKTOP_ONLY }),
    hasGeminiKey: async () => false,
    setGeminiKey: async () => ({ ok: true }),
    loadPrefs: async () => ({ ...defaultPrefs, ...readJson<Partial<AppPrefs>>(PREFS_KEY, {}) }),
    savePrefs: async (prefs) => {
      const next = { ...defaultPrefs, ...readJson<Partial<AppPrefs>>(PREFS_KEY, {}), ...prefs };
      writeJson(PREFS_KEY, next);
      return next;
    },
    loadApplications: async () => readJson<JobApplication[]>(APPS_KEY, []),
    updateApplication: async (patch: UpdateApplicationPatch) => {
      const apps = readJson<JobApplication[]>(APPS_KEY, []);
      const idx = apps.findIndex((a) => a.id === patch.id);
      if (idx < 0) return null;
      const updated: JobApplication = {
        ...apps[idx],
        ...Object.fromEntries(
          Object.entries(patch).filter(([k, v]) => k !== "id" && v !== undefined),
        ),
        updatedAt: new Date().toISOString(),
      };
      apps[idx] = updated;
      writeJson(APPS_KEY, apps);
      return updated;
    },
    deleteApplication: async (id) => {
      writeJson(
        APPS_KEY,
        readJson<JobApplication[]>(APPS_KEY, []).filter((a) => a.id !== id),
      );
      return { ok: true };
    },
    ingestJobUrls: async () => ({ ok: false, items: [], error: DESKTOP_ONLY }),
    onIngestProgress: () => () => undefined,
    openExternal: async (url) => {
      window.open(url, "_blank", "noopener,noreferrer");
      return { ok: true };
    },
    launchLegacy: async () => ({ ok: false, error: DESKTOP_ONLY }),
  };

  window.api = api;
}
