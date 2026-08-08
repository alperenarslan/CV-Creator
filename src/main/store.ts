import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import { createEmptyCV, normalizeCVData, type CVData } from "../shared/cv";
import { defaultPrefs, type AppLocale, type AppPrefs, type ThemeMode } from "../shared/prefs";
import { getSessionGeminiApiKey, setSessionGeminiApiKey } from "./geminiSession";

function dataDir(): string {
  return app.getPath("userData");
}

function cvPath(): string {
  return path.join(dataDir(), "cv-data.json");
}

function settingsPath(): string {
  return path.join(dataDir(), "settings.json");
}

export function loadCV(): CVData {
  try {
    if (!fs.existsSync(cvPath())) return createEmptyCV();
    const raw = fs.readFileSync(cvPath(), "utf8");
    return normalizeCVData(JSON.parse(raw));
  } catch {
    return createEmptyCV();
  }
}

export function saveCV(cv: CVData): void {
  fs.mkdirSync(dataDir(), { recursive: true });
  fs.writeFileSync(cvPath(), JSON.stringify(cv, null, 2), "utf8");
}

export function loadPrefs(): AppPrefs {
  try {
    if (!fs.existsSync(settingsPath())) return { ...defaultPrefs };
    const raw = JSON.parse(fs.readFileSync(settingsPath(), "utf8")) as Partial<AppPrefs> & {
      geminiApiKey?: string;
    };
    // Drop legacy persisted API keys from disk (session-only policy).
    if (raw.geminiApiKey) {
      const { geminiApiKey: _removed, ...rest } = raw;
      fs.writeFileSync(
        settingsPath(),
        JSON.stringify(
          {
            theme: rest.theme === "dark" ? "dark" : "light",
            locale: rest.locale === "en" ? "en" : "tr",
          },
          null,
          2,
        ),
        "utf8",
      );
    }
    return {
      theme: raw.theme === "dark" ? "dark" : "light",
      locale: raw.locale === "en" ? "en" : "tr",
    };
  } catch {
    return { ...defaultPrefs };
  }
}

export function savePrefs(patch: Partial<AppPrefs>): AppPrefs {
  fs.mkdirSync(dataDir(), { recursive: true });
  const current = loadPrefs();
  const next: AppPrefs = {
    theme: patch.theme ?? current.theme,
    locale: patch.locale ?? current.locale,
  };
  fs.writeFileSync(settingsPath(), JSON.stringify(next, null, 2), "utf8");
  return next;
}

/** Session key first, then optional process env for this run. */
export function getGeminiApiKey(): string | undefined {
  const session = getSessionGeminiApiKey()?.trim();
  if (session) return session;
  return process.env.GEMINI_API_KEY?.trim() || undefined;
}

export function setGeminiApiKey(key: string): void {
  setSessionGeminiApiKey(key);
}

export function setTheme(theme: ThemeMode): AppPrefs {
  return savePrefs({ theme });
}

export function setLocale(locale: AppLocale): AppPrefs {
  return savePrefs({ locale });
}
