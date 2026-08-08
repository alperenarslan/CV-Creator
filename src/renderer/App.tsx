import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { createEmptyCV, type CVData } from "../shared/cv";
import type { JobAnalysis } from "../shared/analysis";
import type { AppLocale, ImportEngine, ThemeMode } from "../shared/prefs";
import { AIMatchPanel } from "./components/AIMatchPanel";
import { CVPreview } from "./components/CVPreview";
import { EditorPanels, type StepId } from "./components/EditorPanels";
import { ApplicationsPanel } from "./components/ApplicationsPanel";
import { ImportModal } from "./components/ImportModal";
import { TemplatePicker } from "./components/TemplatePicker";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { LocaleProvider, useLocale } from "./i18n/LocaleContext";
import { applySuggestions } from "./lib/applySuggestions";

type MobilePane = "edit" | "preview";

export default function App() {
  const [locale, setLocaleState] = useState<AppLocale>("tr");
  const [theme, setThemeState] = useState<ThemeMode>("light");
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const prefs = await window.api.loadPrefs();
      if (cancelled) return;
      setLocaleState(prefs.locale);
      setThemeState(prefs.theme);
      document.documentElement.dataset.theme = prefs.theme;
      document.documentElement.lang = prefs.locale;
      setBootstrapped(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function setLocale(next: AppLocale) {
    setLocaleState(next);
    document.documentElement.lang = next;
    await window.api.savePrefs({ locale: next });
  }

  async function setTheme(next: ThemeMode) {
    setThemeState(next);
    document.documentElement.dataset.theme = next;
    await window.api.savePrefs({ theme: next });
  }

  if (!bootstrapped) {
    return (
      <div className="grid h-full place-items-center text-lg text-[var(--ink-soft)]">…</div>
    );
  }

  return (
    <LocaleProvider locale={locale} setLocale={setLocale}>
      <AppShell theme={theme} setTheme={setTheme} />
    </LocaleProvider>
  );
}

function AppShell({
  theme,
  setTheme,
}: {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
}) {
  const { t, locale, setLocale } = useLocale();
  const [cv, setCv] = useState<CVData>(createEmptyCV());
  const [step, setStep] = useState<StepId>("personal");
  const [ready, setReady] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [analysis, setAnalysis] = useState<JobAnalysis | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [legacyOpen, setLegacyOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [trackerOpen, setTrackerOpen] = useState(false);
  const [appsRefresh, setAppsRefresh] = useState(0);
  const [mobilePane, setMobilePane] = useState<MobilePane>("edit");
  const logoClicks = useRef(0);
  const logoTimer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [loaded, key] = await Promise.all([window.api.loadCV(), window.api.hasGeminiKey()]);
      if (cancelled) return;
      setCv(loaded);
      setHasKey(key);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useEffectEvent(async (next: CVData) => {
    await window.api.saveCV(next);
  });

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => {
      void persist(cv);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [cv, ready]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        setLegacyOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 2800);
  }

  function onLogoClick() {
    logoClicks.current += 1;
    if (logoTimer.current) window.clearTimeout(logoTimer.current);
    logoTimer.current = window.setTimeout(() => {
      logoClicks.current = 0;
    }, 1200);
    if (logoClicks.current >= 5) {
      logoClicks.current = 0;
      setLegacyOpen(true);
    }
  }

  async function handleExport(kind: "txt" | "html" | "pdf") {
    const fn =
      kind === "txt"
        ? window.api.exportTxt
        : kind === "html"
          ? window.api.exportHtml
          : window.api.exportPdf;
    const result = await fn(cv);
    if (result.canceled) return;
    if (!result.ok) {
      showToast(result.error || "Export failed");
      return;
    }
    showToast(result.filePath || "OK");
  }

  async function runImport(engine: ImportEngine) {
    setImportOpen(false);
    setImporting(true);
    try {
      const result = await window.api.importCV(engine);
      if (result.canceled) return;
      if (!result.ok || !result.cv) {
        showToast(result.error || "Import failed");
        return;
      }
      setCv(result.cv);
      setAnalysis(null);
      setSelected(new Set());
      setStep("personal");
      setMobilePane("preview");
      const photoNote = result.photoFound ? t("photoImported") : t("photoNotImported");
      showToast(
        result.sourceName
          ? `${result.sourceName} ${t("imported")} · ${photoNote}`
          : `${t("imported")} · ${photoNote}`,
      );
    } finally {
      setImporting(false);
    }
  }

  function clearAll() {
    setClearConfirmOpen(true);
  }

  function performClear() {
    setClearConfirmOpen(false);
    setCv(createEmptyCV());
    setAnalysis(null);
    setSelected(new Set());
    showToast(t("cleared"));
  }

  function toggleSuggestion(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function applySelected() {
    if (!analysis) return;
    const picked = analysis.suggestions.filter((s) => selected.has(s.id));
    if (!picked.length) return;
    setCv((prev) => applySuggestions(prev, picked));
    showToast(`${picked.length}`);
    setAiOpen(false);
  }

  if (!ready) {
    return (
      <div className="grid h-full place-items-center text-lg text-[var(--ink-soft)]">
        {t("loading")}
      </div>
    );
  }

  return (
    <div className="app-shell relative">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <button
          type="button"
          onClick={onLogoClick}
          className="border-0 bg-transparent p-0 text-left cursor-pointer shrink-0"
          title="CV Creator"
        >
          <h1 className="display m-0 text-[1.85rem] font-semibold sm:text-[2.1rem]">CV Creator</h1>
          <p className="slogan m-0 mt-1">{t("slogan")}</p>
        </button>

        <div className="prefs-bar justify-end">
          <button
            type="button"
            className="prefs-chip"
            onClick={() => {
              setAiOpen(false);
              setTrackerOpen((v) => !v);
            }}
          >
            {t("tracker")}
          </button>
          <span
            className={`prefs-chip api-session ${hasKey ? "is-on" : "is-off"}`}
            title={hasKey ? t("apiBadgeTitleOn") : t("apiBadgeTitleOff")}
            aria-label={hasKey ? t("apiBadgeOn") : t("apiBadgeOff")}
          >
            <span className="api-session-icon" aria-hidden="true">
              <KeyIcon />
            </span>
            {hasKey ? t("apiBadgeOn") : t("apiBadgeOff")}
          </span>
          <div
            className={`theme-switch ${theme === "dark" ? "is-dark" : "is-light"}`}
            role="group"
            aria-label={t("themeToggle")}
          >
            <span className="theme-switch-thumb" aria-hidden="true" />
            <button
              type="button"
              aria-pressed={theme === "light"}
              title={t("themeLight")}
              onClick={() => void setTheme("light")}
            >
              <SunIcon />
            </button>
            <button
              type="button"
              aria-pressed={theme === "dark"}
              title={t("themeDark")}
              onClick={() => void setTheme("dark")}
            >
              <MoonIcon />
            </button>
          </div>

          <div className="lang-switch" role="group" aria-label={t("langToggle")}>
            <span className="lang-label" title={t("language")} aria-hidden="true">
              <GlobeIcon />
            </span>
            <button
              type="button"
              aria-pressed={locale === "tr"}
              onClick={() => void setLocale("tr")}
            >
              TR
            </button>
            <button
              type="button"
              aria-pressed={locale === "en"}
              onClick={() => void setLocale("en")}
            >
              EN
            </button>
          </div>
        </div>
      </header>

      <div className="flex gap-2 lg:hidden">
        <button
          type="button"
          className={`btn flex-1 ${mobilePane === "edit" ? "btn-primary" : "btn-ghost"}`}
          onClick={() => setMobilePane("edit")}
        >
          {t("edit")}
        </button>
        <button
          type="button"
          className={`btn flex-1 ${mobilePane === "preview" ? "btn-primary" : "btn-ghost"}`}
          onClick={() => setMobilePane("preview")}
        >
          {t("preview")}
        </button>
      </div>

      <main className="workspace">
        <section
          className={`editor-pane flex h-full min-h-[420px] flex-col gap-3 ${
            mobilePane !== "edit" ? "is-hidden-mobile" : ""
          }`}
        >
          <div className="flex flex-col items-stretch gap-2">
            <div className="flex flex-wrap items-center justify-start gap-2">
              <button
                type="button"
                className={`btn btn-primary ${importing ? "is-busy" : ""}`}
                disabled={importing}
                aria-busy={importing}
                onClick={() => setImportOpen(true)}
              >
                {importing ? <ImportingLabel /> : t("importCv")}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={importing}
                onClick={clearAll}
              >
                {t("clear")}
              </button>
            </div>
            <AnimatePresence>
              {importing && (
                <motion.div
                  className="import-status"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -2 }}
                  transition={{ duration: 0.18 }}
                >
                  <div className="import-progress" aria-hidden="true">
                    <span className="import-progress-bar" />
                  </div>
                  <p className="import-status-hint m-0">{t("importingHint")}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="min-h-0 flex-1">
            <EditorPanels step={step} onStepChange={setStep} cv={cv} onChange={setCv} />
          </div>
        </section>

        <section
          className={`preview-pane surface flex h-full min-h-[420px] flex-col overflow-hidden rounded-[var(--radius)] p-3 sm:p-4 ${
            mobilePane === "preview" ? "is-visible" : ""
          }`}
        >
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-baseline gap-2">
              <h2 className="display m-0 text-base font-semibold sm:text-lg">{t("preview")}</h2>
              <span className="text-xs text-[var(--ink-soft)]">{t("autoSave")}</span>
            </div>
            <div className="export-switch" role="group" aria-label={t("export")}>
              <span className="export-switch-label">{t("export")}</span>
              <button type="button" onClick={() => void handleExport("txt")}>
                TXT
              </button>
              <button type="button" onClick={() => void handleExport("html")}>
                HTML
              </button>
              <button type="button" onClick={() => void handleExport("pdf")}>
                PDF
              </button>
            </div>
          </div>
          <TemplatePicker cv={cv} onChange={setCv} />
          <div className="min-h-0 flex-1 overflow-hidden">
            <CVPreview cv={cv} />
          </div>
        </section>
      </main>

      <div className="pointer-events-none absolute inset-x-0 bottom-4 z-30 flex justify-center sm:bottom-5">
        <button
          type="button"
          className="analyze-launch"
          onClick={() => {
            setTrackerOpen(false);
            setAiOpen((v) => !v);
          }}
          aria-label={t("analyzeJob")}
          title={`${t("analyzeJob")} — ${t("analyzeJobHint")}`}
        >
          <span className="analyze-launch-orb" aria-hidden="true">
            <AnalyzeIcon />
          </span>
          <span className="analyze-launch-label">{t("analyzeJob")}</span>
        </button>
      </div>

      <AnimatePresence>
        {aiOpen && (
          <AIMatchPanel
            open={aiOpen}
            onClose={() => setAiOpen(false)}
            cv={cv}
            hasKey={hasKey}
            onSaveKey={async (key) => {
              await window.api.setGeminiKey(key);
              setHasKey(true);
              showToast(t("keySaved"));
            }}
            analysis={analysis}
            onAnalyzed={(a) => {
              setAnalysis(a);
              setSelected(new Set(a.suggestions.map((s) => s.id)));
              setAppsRefresh((n) => n + 1);
              showToast(t("trackedToast"));
            }}
            selected={selected}
            onToggleSuggestion={toggleSuggestion}
            onApplySelected={applySelected}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {trackerOpen && (
          <ApplicationsPanel
            open={trackerOpen}
            onClose={() => setTrackerOpen(false)}
            refreshToken={appsRefresh}
            onOpenUrl={(url) => {
              void window.api.openExternal(url);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {importOpen && (
          <ImportModal
            open={importOpen}
            onClose={() => setImportOpen(false)}
            onConfirm={(engine) => void runImport(engine)}
            hasKey={hasKey}
            onSaveKey={async (key) => {
              await window.api.setGeminiKey(key);
              setHasKey(true);
              showToast(t("keySaved"));
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {clearConfirmOpen && (
          <ConfirmDialog
            open={clearConfirmOpen}
            title={t("clearConfirm")}
            body={t("clearConfirmBody")}
            confirmLabel={t("clear")}
            danger
            onCancel={() => setClearConfirmOpen(false)}
            onConfirm={performClear}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="surface-solid fixed bottom-4 left-4 z-40 max-w-[min(420px,calc(100%-2rem))] rounded-[12px] px-3.5 py-2 text-sm"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {legacyOpen && (
          <LegacyModal
            onClose={() => setLegacyOpen(false)}
            onLaunch={async () => {
              const result = await window.api.launchLegacy();
              if (!result.ok) {
                showToast(result.error || "Legacy failed");
                return;
              }
              showToast("Classic 2020");
              setLegacyOpen(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ImportingLabel() {
  const { t } = useLocale();
  return (
    <span className="importing-label">
      <span>{t("importingBase")}</span>
      <span className="importing-dots" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="importing-dot"
            animate={{ opacity: [0.25, 1, 0.25], y: [0, -1.5, 0] }}
            transition={{
              duration: 0.9,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.16,
            }}
          >
            .
          </motion.span>
        ))}
      </span>
    </span>
  );
}

function AnalyzeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 5h10v14H4z" />
      <path d="M8 9h6M8 12h4" strokeLinecap="round" />
      <circle cx="16.5" cy="16.5" r="3.2" />
      <path d="M18.8 18.8 21 21" strokeLinecap="round" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path
        strokeLinecap="round"
        d="M12 2.5v2.2M12 19.3v2.2M4.5 12H2.3M21.7 12h-2.2M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17.8 15.2A7.2 7.2 0 0 1 8.8 6.2a7.2 7.2 0 1 0 9 9Z"
      />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.7 2.8 4 5.8 4 9s-1.3 6.2-4 9c-2.7-2.8-4-5.8-4-9s1.3-6.2 4-9Z" />
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <circle cx="8.2" cy="12" r="3.2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.2 12H20M17 12v2.4M20 12v2.4" />
    </svg>
  );
}

function LegacyModal({ onClose, onLaunch }: { onClose: () => void; onLaunch: () => void }) {
  const { t } = useLocale();
  return (
    <motion.div
      className="fixed inset-0 z-50 grid place-items-center bg-[rgba(12,24,32,0.4)] p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="surface-solid w-full max-w-md rounded-[var(--radius)] p-5"
        initial={{ scale: 0.96, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.98, y: 8 }}
      >
        <h3 className="display mt-0 mb-2 text-xl font-semibold">{t("classicTitle")}</h3>
        <p className="mt-0 mb-4 text-sm text-[var(--ink-soft)]">{t("classicBody")}</p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("close")}
          </button>
          <button type="button" className="btn btn-primary" onClick={onLaunch}>
            {t("open")}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
