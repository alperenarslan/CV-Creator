import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import type {
  AdaptLocale,
  CoverLetterTone,
  EditSuggestion,
  InterviewQuestion,
  JobAnalysis,
} from "../../shared/analysis";
import type { AtsReport } from "../../shared/ats";
import type { CVData } from "../../shared/cv";
import { useLocale } from "../i18n/LocaleContext";

interface Props {
  open: boolean;
  onClose: () => void;
  cv: CVData;
  hasKey: boolean;
  onSaveKey: (key: string) => Promise<void>;
  onAnalyzed: (analysis: JobAnalysis, applicationId?: string) => void;
  onMergeSuggestions: (suggestions: EditSuggestion[]) => void;
  onCvAdapted: (cv: CVData) => void;
  analysis: JobAnalysis | null;
  applicationId: string | null;
  selected: Set<string>;
  onToggleSuggestion: (id: string) => void;
  onApplySelected: () => void;
  onToast: (message: string) => void;
  onLoadSnapshot: (cv: CVData) => void;
  onAppsChanged?: () => void;
}

export function AIMatchPanel({
  open,
  onClose,
  cv,
  hasKey,
  onSaveKey,
  onAnalyzed,
  onMergeSuggestions,
  onCvAdapted,
  analysis,
  applicationId,
  selected,
  onToggleSuggestion,
  onApplySelected,
  onToast,
  onLoadSnapshot,
  onAppsChanged,
}: Props) {
  const { t } = useLocale();
  const [url, setUrl] = useState("");
  const [fallback, setFallback] = useState("");
  const [showFallback, setShowFallback] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [tone, setTone] = useState<CoverLetterTone>("professional");
  const [coverBusy, setCoverBusy] = useState(false);
  const [coverSubject, setCoverSubject] = useState("");
  const [coverBody, setCoverBody] = useState("");
  const [ats, setAts] = useState<AtsReport | null>(null);
  const [pkgBusy, setPkgBusy] = useState(false);
  const [snapBusy, setSnapBusy] = useState(false);
  const [weaveBusy, setWeaveBusy] = useState(false);
  const [adaptBusy, setAdaptBusy] = useState(false);
  const [shortBusy, setShortBusy] = useState(false);
  const [bankBusy, setBankBusy] = useState(false);
  const [interviewQs, setInterviewQs] = useState<InterviewQuestion[]>([]);

  const selectedCount = useMemo(() => selected.size, [selected]);
  const hasJobCard = Boolean(
    analysis &&
      (analysis.mustHaves?.length ||
        analysis.niceToHaves?.length ||
        analysis.fitReasons?.length ||
        analysis.riskReasons?.length ||
        analysis.location),
  );

  useEffect(() => {
    if (!analysis) {
      setAts(null);
      return;
    }
    void window.api
      .runAtsCheck({ cv, missingKeywords: analysis.missingKeywords })
      .then(setAts)
      .catch(() => setAts(null));
  }, [analysis, cv]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

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
        if (
          result.error?.toLowerCase().includes("paste") ||
          result.error?.includes("korumalı") ||
          result.error?.includes("yapıştır")
        ) {
          setShowFallback(true);
        }
        setError(result.error || "Error");
        return;
      }
      setCoverBody("");
      setCoverSubject("");
      setInterviewQs([]);
      onAnalyzed(result.analysis, result.applicationId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function runCoverLetter() {
    if (!analysis) return;
    setCoverBusy(true);
    setError(null);
    try {
      const result = await window.api.generateCoverLetter({
        cv,
        analysis,
        tone,
        applicationId: applicationId || undefined,
      });
      if (!result.ok || !result.body) {
        setError(result.error || "Error");
        return;
      }
      setCoverSubject(result.subject || "");
      setCoverBody(result.body);
      onToast(t("coverLetterReady"));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCoverBusy(false);
    }
  }

  async function runKeywordWeave() {
    if (!analysis?.missingKeywords.length) return;
    setWeaveBusy(true);
    setError(null);
    try {
      const result = await window.api.rewriteKeywords({
        cv,
        missingKeywords: analysis.missingKeywords,
        jobTitle: analysis.jobTitle,
        company: analysis.companyGuess,
      });
      if (!result.ok || !result.suggestions?.length) {
        setError(result.error || "Error");
        return;
      }
      onMergeSuggestions(result.suggestions);
      onToast(t("keywordsReady"));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWeaveBusy(false);
    }
  }

  async function runAdaptLanguage(targetLocale: AdaptLocale) {
    setAdaptBusy(true);
    setError(null);
    try {
      const result = await window.api.adaptLanguage({
        cv,
        targetLocale,
        coverLetter: coverBody || undefined,
        coverSubject: coverSubject || undefined,
      });
      if (!result.ok || !result.cv) {
        setError(result.error || "Error");
        return;
      }
      onCvAdapted(result.cv);
      if (result.coverLetter) setCoverBody(result.coverLetter);
      if (result.coverSubject) setCoverSubject(result.coverSubject);
      onToast(t("languageAdapted"));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAdaptBusy(false);
    }
  }

  async function runShortCv() {
    if (!analysis) return;
    setShortBusy(true);
    setError(null);
    try {
      const result = await window.api.shortenCv({ cv, analysis });
      if (!result.ok || !result.cv) {
        setError(result.error || "Error");
        return;
      }
      onCvAdapted(result.cv);
      onToast(t("shortCvReady"));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setShortBusy(false);
    }
  }

  async function runInterviewBank() {
    if (!analysis) return;
    setBankBusy(true);
    setError(null);
    try {
      const result = await window.api.interviewBank({ cv, analysis });
      if (!result.ok || !result.questions?.length) {
        setError(result.error || "Error");
        return;
      }
      setInterviewQs(result.questions);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBankBusy(false);
    }
  }

  async function copyCover() {
    if (!coverBody) return;
    const text = coverSubject ? `Subject: ${coverSubject}\n\n${coverBody}` : coverBody;
    await navigator.clipboard.writeText(text);
    onToast(t("copied"));
  }

  async function saveSnapshot() {
    if (!applicationId) {
      setError(t("needAnalysisFirst"));
      return;
    }
    setSnapBusy(true);
    try {
      const result = await window.api.saveSnapshot({ applicationId, cv });
      if (!result.ok) {
        setError(result.error || "Error");
        return;
      }
      onToast(t("snapshotSaved"));
      onAppsChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSnapBusy(false);
    }
  }

  async function loadSnapshot() {
    if (!applicationId) return;
    const result = await window.api.loadSnapshot(applicationId);
    if (!result.ok || !result.cv) {
      setError(result.error || t("snapshotMissing"));
      return;
    }
    onLoadSnapshot(result.cv);
    onToast(t("snapshotLoaded"));
  }

  async function exportPackage() {
    if (!analysis) return;
    setPkgBusy(true);
    setError(null);
    try {
      const result = await window.api.exportPackage({
        cv,
        analysis,
        coverLetter: coverBody || undefined,
        coverSubject: coverSubject || undefined,
        applicationId: applicationId || undefined,
        includePdf: true,
      });
      if (result.canceled) return;
      if (!result.ok) {
        setError(result.error || "Error");
        return;
      }
      onToast(t("packageExported"));
      onAppsChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPkgBusy(false);
    }
  }

  return (
    <motion.div
      className="job-match-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onClose}
    >
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-match-title"
        className="job-match-shell surface-solid"
        initial={{ opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.99 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="job-match-header">
          <div className="min-w-0">
            <h2 id="job-match-title" className="display m-0 text-xl font-semibold sm:text-2xl">
              {t("jobMatch")}
            </h2>
          </div>
          <button type="button" className="btn btn-ghost shrink-0" onClick={onClose}>
            {t("close")}
          </button>
        </header>

        <div className={`job-match-body ${analysis ? "has-analysis" : ""}`}>
          <aside className="job-match-rail scroll-thin">
            {!hasKey && (
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
              onClick={() => void runAnalyze()}
            >
              {loading ? t("analyzing") : t("analyze")}
            </button>

            {error && <p className="m-0 text-sm text-[var(--danger)]">{error}</p>}
            {info && <p className="m-0 text-sm text-[var(--good)]">{info}</p>}

            {analysis && (
              <>
                <div className="job-match-score">
                  <div className="display text-4xl font-semibold text-[var(--accent)] sm:text-5xl">
                    {analysis.matchScore}
                    <span className="text-base font-medium text-[var(--ink-soft)]"> / 100</span>
                  </div>
                  <p className="mt-2 mb-0 text-base font-medium">
                    {analysis.jobTitle}
                    {analysis.companyGuess ? ` · ${analysis.companyGuess}` : ""}
                  </p>
                  {analysis.location ? (
                    <p className="mt-1 mb-0 text-xs text-[var(--ink-soft)]">{analysis.location}</p>
                  ) : null}
                  <p className="mt-2 mb-0 text-sm leading-relaxed text-[var(--ink-soft)]">
                    {analysis.summary}
                  </p>
                </div>

                {hasJobCard && (
                  <div className="rounded-[var(--radius-sm)] border border-[var(--line)] p-3 space-y-2">
                    <h3 className="display m-0 text-base font-semibold">{t("jobCard")}</h3>
                    <ChipList title={t("mustHaves")} items={analysis.mustHaves || []} tone="warn" />
                    <ChipList
                      title={t("niceToHaves")}
                      items={analysis.niceToHaves || []}
                      tone="good"
                    />
                    <BulletList title={t("fitReasons")} items={analysis.fitReasons || []} tone="good" />
                    <BulletList
                      title={t("riskReasons")}
                      items={analysis.riskReasons || []}
                      tone="warn"
                    />
                  </div>
                )}

                <ChipList title={t("strengths")} items={analysis.strengths} tone="good" />
                <ChipList title={t("missingKeywords")} items={analysis.missingKeywords} tone="warn" />

                {analysis.missingKeywords.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-ghost w-full"
                    disabled={weaveBusy || !hasKey}
                    onClick={() => void runKeywordWeave()}
                  >
                    {weaveBusy ? t("weavingKeywords") : t("weaveKeywords")}
                  </button>
                )}

                {analysis.interviewTips && analysis.interviewTips.length > 0 && (
                  <div>
                    <h4 className="mb-1.5 mt-0 text-sm font-medium">{t("interviewTips")}</h4>
                    <ul className="m-0 space-y-1.5 pl-4 text-sm text-[var(--ink-soft)]">
                      {analysis.interviewTips.map((tip) => (
                        <li key={tip}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {ats && (
                  <div className="rounded-[var(--radius-sm)] border border-[var(--line)] p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="display m-0 text-base font-semibold">{t("atsCheck")}</h3>
                      <span className="display text-lg font-semibold text-[var(--accent)]">
                        {ats.score}
                        <span className="text-xs font-medium text-[var(--ink-soft)]"> / 100</span>
                      </span>
                    </div>
                    <ul className="mt-2 mb-0 grid gap-1.5 pl-0 list-none sm:grid-cols-1">
                      {ats.items.map((item) => (
                        <li key={item.id} className="text-xs">
                          <span
                            className={
                              item.severity === "pass"
                                ? "text-[var(--good)]"
                                : item.severity === "warn"
                                  ? "text-[#c49a4a]"
                                  : "text-[var(--danger)]"
                            }
                          >
                            {item.severity === "pass" ? "✓" : item.severity === "warn" ? "!" : "×"}{" "}
                            {item.title}
                          </span>
                          <span className="block text-[var(--ink-soft)] pl-3">{item.detail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </aside>

          <div className="job-match-main scroll-thin">
            {!analysis ? (
              <div className="job-match-empty">
                <p className="display m-0 text-lg font-semibold sm:text-xl">{t("jobMatch")}</p>
              </div>
            ) : (
              <div className="job-match-columns">
                <section className="job-match-col">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="display m-0 text-base font-semibold sm:text-lg">{t("suggestions")}</h3>
                    <span className="text-xs text-[var(--ink-soft)]">
                      {selectedCount}/{analysis.suggestions.length}
                    </span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {analysis.suggestions.map((s) => (
                      <SuggestionCard
                        key={s.id}
                        suggestion={s}
                        checked={selected.has(s.id)}
                        onToggle={() => onToggleSuggestion(s.id)}
                      />
                    ))}
                  </div>
                </section>

                <section className="job-match-col space-y-3">
                  <div className="rounded-[var(--radius-sm)] border border-[var(--line)] p-3 space-y-2 sm:p-4">
                    <h3 className="display m-0 text-base font-semibold sm:text-lg">{t("coverLetter")}</h3>
                    <label className="block text-xs">
                      <span className="mb-1 block text-[var(--ink-soft)]">{t("coverTone")}</span>
                      <select
                        className="field py-2 text-sm"
                        value={tone}
                        onChange={(e) => setTone(e.target.value as CoverLetterTone)}
                      >
                        <option value="professional">{t("toneProfessional")}</option>
                        <option value="warm">{t("toneWarm")}</option>
                        <option value="concise">{t("toneConcise")}</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      className="btn btn-primary w-full"
                      disabled={coverBusy || !hasKey}
                      onClick={() => void runCoverLetter()}
                    >
                      {coverBusy ? t("coverGenerating") : t("generateCover")}
                    </button>
                    {coverBody && (
                      <>
                        {coverSubject && (
                          <p className="m-0 text-xs text-[var(--ink-soft)]">
                            <strong>{t("coverSubject")}:</strong> {coverSubject}
                          </p>
                        )}
                        <textarea
                          className="field min-h-[160px] text-sm whitespace-pre-wrap"
                          value={coverBody}
                          onChange={(e) => setCoverBody(e.target.value)}
                        />
                        <button
                          type="button"
                          className="btn btn-ghost w-full"
                          onClick={() => void copyCover()}
                        >
                          {t("copyCover")}
                        </button>
                      </>
                    )}
                  </div>

                  <div className="rounded-[var(--radius-sm)] border border-[var(--line)] p-3 space-y-2 sm:p-4">
                    <h3 className="display m-0 text-base font-semibold">{t("adaptLanguage")}</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        className="btn btn-ghost w-full"
                        disabled={adaptBusy || !hasKey}
                        onClick={() => void runAdaptLanguage("tr")}
                      >
                        {adaptBusy ? t("adaptingLanguage") : t("adaptToTr")}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost w-full"
                        disabled={adaptBusy || !hasKey}
                        onClick={() => void runAdaptLanguage("en")}
                      >
                        {adaptBusy ? t("adaptingLanguage") : t("adaptToEn")}
                      </button>
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost w-full"
                      disabled={shortBusy || !hasKey}
                      onClick={() => void runShortCv()}
                    >
                      {shortBusy ? t("shorteningCv") : t("shortCv")}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost w-full"
                      disabled={bankBusy || !hasKey}
                      onClick={() => void runInterviewBank()}
                    >
                      {bankBusy ? t("loadingInterviewBank") : t("loadInterviewBank")}
                    </button>
                    {interviewQs.length > 0 && (
                      <div className="space-y-2 pt-1">
                        <h4 className="m-0 text-sm font-medium">{t("interviewBank")}</h4>
                        {interviewQs.map((q) => (
                          <div
                            key={q.question}
                            className="rounded-[8px] border border-[var(--line)] bg-[var(--surface-strong)] p-2 text-xs"
                          >
                            <div className="font-medium">{q.question}</div>
                            <p className="mt-1 mb-0 whitespace-pre-wrap text-[var(--ink-soft)]">
                              {q.answerOutline}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-[var(--radius-sm)] border border-[var(--line)] p-3 space-y-2 sm:p-4">
                    <h3 className="display m-0 text-base font-semibold">{t("packageActions")}</h3>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        className="btn btn-ghost w-full"
                        disabled={snapBusy || !applicationId}
                        onClick={() => void saveSnapshot()}
                      >
                        {snapBusy ? t("savingSnapshot") : t("saveSnapshot")}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost w-full"
                        disabled={!applicationId}
                        onClick={() => void loadSnapshot()}
                      >
                        {t("loadSnapshot")}
                      </button>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary w-full"
                      disabled={pkgBusy}
                      onClick={() => void exportPackage()}
                    >
                      {pkgBusy ? t("exportingPackage") : t("exportPackage")}
                    </button>
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>

        {analysis && (
          <footer className="job-match-footer">
            <button
              type="button"
              className="btn btn-primary min-w-[200px]"
              disabled={selectedCount === 0}
              onClick={onApplySelected}
            >
              {t("applySelected")} ({selectedCount})
            </button>
          </footer>
        )}
      </motion.section>
    </motion.div>
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

function BulletList({
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
      <ul className="m-0 space-y-1 pl-4 text-xs text-[var(--ink-soft)]">
        {items.map((item) => (
          <li
            key={item}
            className={tone === "good" ? "marker:text-[var(--good)]" : "marker:text-[#c49a4a]"}
          >
            {item}
          </li>
        ))}
      </ul>
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
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm">{suggestion.title}</div>
          <p className="mt-1 mb-0 text-xs text-[var(--ink-soft)]">{suggestion.rationale}</p>
          <div className="mt-2 grid gap-1 text-xs lg:grid-cols-2">
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
