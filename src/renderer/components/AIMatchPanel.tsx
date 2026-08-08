import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import type { EditSuggestion, JobAnalysis } from "../../shared/analysis";
import type { CVData } from "../../shared/cv";
import { useLocale } from "../i18n/LocaleContext";

interface Props {
  open: boolean;
  onClose: () => void;
  cv: CVData;
  hasKey: boolean;
  onSaveKey: (key: string) => Promise<void>;
  onAnalyzed: (analysis: JobAnalysis) => void;
  analysis: JobAnalysis | null;
  selected: Set<string>;
  onToggleSuggestion: (id: string) => void;
  onApplySelected: () => void;
}

export function AIMatchPanel({
  open,
  onClose,
  cv,
  hasKey,
  onSaveKey,
  onAnalyzed,
  analysis,
  selected,
  onToggleSuggestion,
  onApplySelected,
}: Props) {
  const { t } = useLocale();
  const [url, setUrl] = useState("");
  const [fallback, setFallback] = useState("");
  const [showFallback, setShowFallback] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const selectedCount = useMemo(() => selected.size, [selected]);

  if (!open) return null;

  async function runAnalyze() {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      if (!hasKey && apiKey.trim()) {
        await onSaveKey(apiKey.trim());
      }
      const result = await window.api.analyzeJob({
        url: url.trim(),
        fallbackText: fallback.trim() || undefined,
        cv,
      });
      if (!result.ok || !result.analysis) {
        if (result.error?.toLowerCase().includes("paste") || result.error?.includes("korumalı") || result.error?.includes("yapıştır")) {
          setShowFallback(true);
        }
        setError(result.error || "Error");
        return;
      }
      onAnalyzed(result.analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.aside
      layout
      initial={{ opacity: 0, y: 28, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 18, scale: 0.99 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="surface-solid absolute inset-x-3 bottom-3 top-20 z-20 overflow-hidden rounded-[var(--radius)] sm:inset-x-4 sm:bottom-4 sm:top-24 md:inset-x-auto md:right-5 md:w-[min(440px,calc(100%-2rem))]"
    >
      <div className="flex h-full flex-col">
        <header className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-4 py-3.5 sm:px-5">
          <div>
            <h2 className="display m-0 text-lg font-semibold sm:text-xl">{t("jobMatch")}</h2>
          </div>
          <button type="button" className="btn btn-ghost shrink-0" onClick={onClose}>
            {t("close")}
          </button>
        </header>

        <div className="flex-1 space-y-3 overflow-auto px-4 py-4 sm:px-5 scroll-thin">
          {hasKey ? (
            <div className="rounded-[var(--radius-sm)] bg-[var(--accent-soft)] px-3 py-2 text-sm">
              {t("geminiKeySaved")}
            </div>
          ) : (
            <div className="rounded-[var(--radius-sm)] bg-[var(--accent-soft)] p-3">
              <Field
                label={t("geminiKey")}
                value={apiKey}
                onChange={setApiKey}
                placeholder={t("geminiKeyPlaceholder")}
              />
            </div>
          )}

          <Field label={t("jobUrl")} value={url} onChange={setUrl} placeholder="https://..." />

          {showFallback && (
            <Field label={t("fallbackJobText")} value={fallback} onChange={setFallback} textarea />
          )}

          <button
            type="button"
            className="btn btn-primary w-full"
            disabled={loading || (!url.trim() && !fallback.trim())}
            onClick={runAnalyze}
          >
            {loading ? t("analyzing") : t("analyze")}
          </button>

          {error && <p className="m-0 text-sm text-[var(--danger)]">{error}</p>}
          {info && <p className="m-0 text-sm text-[var(--good)]">{info}</p>}

          {analysis && (
            <div className="space-y-3 pt-1">
              <div className="rounded-[var(--radius-sm)] bg-[var(--accent-soft)] p-4">
                <div className="display text-3xl font-semibold text-[var(--accent)]">
                  {analysis.matchScore}
                  <span className="text-base font-medium text-[var(--ink-soft)]"> / 100</span>
                </div>
                <p className="mt-1 mb-0 text-sm font-medium">
                  {analysis.jobTitle}
                  {analysis.companyGuess ? ` · ${analysis.companyGuess}` : ""}
                </p>
                <p className="mt-2 mb-0 text-sm text-[var(--ink-soft)]">{analysis.summary}</p>
              </div>

              <ChipList title={t("strengths")} items={analysis.strengths} tone="good" />
              <ChipList title={t("missingKeywords")} items={analysis.missingKeywords} tone="warn" />

              <div>
                <h3 className="display mb-2 mt-0 text-base font-semibold">{t("suggestions")}</h3>
                <div className="space-y-2">
                  {analysis.suggestions.map((s) => (
                    <SuggestionCard
                      key={s.id}
                      suggestion={s}
                      checked={selected.has(s.id)}
                      onToggle={() => onToggleSuggestion(s.id)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {analysis && (
          <footer className="border-t border-[var(--line)] px-4 py-3 sm:px-5">
            <button
              type="button"
              className="btn btn-primary w-full"
              disabled={selectedCount === 0}
              onClick={onApplySelected}
            >
              {t("applySelected")} ({selectedCount})
            </button>
          </footer>
        )}
      </div>
    </motion.aside>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  textarea,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  textarea?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block text-[var(--ink-soft)]">{label}</span>
      {textarea ? (
        <textarea
          className="field min-h-[100px]"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className="field"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}

function ChipList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "good" | "warn";
}) {
  if (!items.length) return null;
  return (
    <div>
      <h4 className="mb-1.5 mt-0 text-sm font-medium">{title}</h4>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span
            key={item}
            className={`rounded-[8px] px-2 py-1 text-xs ${
              tone === "good"
                ? "bg-[color-mix(in_srgb,var(--good)_14%,transparent)] text-[var(--good)]"
                : "bg-[rgba(138,90,18,0.14)] text-[#c49a4a]"
            }`}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function SuggestionCard({
  suggestion,
  checked,
  onToggle,
}: {
  suggestion: EditSuggestion;
  checked: boolean;
  onToggle: () => void;
}) {
  const { t } = useLocale();
  return (
    <label className="block cursor-pointer rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-strong)] p-3">
      <div className="flex items-start gap-2">
        <input type="checkbox" checked={checked} onChange={onToggle} className="mt-1" />
        <div>
          <div className="font-medium text-sm">{suggestion.title}</div>
          <p className="mt-1 mb-0 text-xs text-[var(--ink-soft)]">{suggestion.rationale}</p>
          <div className="mt-2 grid gap-1 text-xs">
            <div className="rounded-[8px] bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] p-2 whitespace-pre-wrap">
              <strong>{t("currently")}</strong> {suggestion.currentText || "—"}
            </div>
            <div className="rounded-[8px] bg-[var(--accent-soft)] p-2 whitespace-pre-wrap">
              <strong>{t("suggestion")}</strong> {suggestion.suggestedText}
            </div>
          </div>
        </div>
      </div>
    </label>
  );
}
