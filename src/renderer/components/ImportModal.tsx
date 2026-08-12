import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { ImportEngine } from "../../shared/prefs";
import { useLocale } from "../i18n/LocaleContext";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (engine: ImportEngine) => void;
  hasKey: boolean;
  onSaveKey: (key: string) => Promise<void>;
}

export function ImportModal({ open, onClose, onConfirm, hasKey, onSaveKey }: Props) {
  const { t } = useLocale();
  const [engine, setEngine] = useState<ImportEngine>("local");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      setApiKey("");
    }
  }, [open]);

  if (!open) return null;

  async function handleContinue() {
    setError(null);
    if (engine === "gemini" && !hasKey && !apiKey.trim()) {
      // geminiKeyHint: Gemini ile aktarmak için API anahtarı gerekli
      setError(t("geminiKey"));
      return;
    }
    try {
      setSaving(true);
      if (engine === "gemini" && apiKey.trim()) {
        await onSaveKey(apiKey.trim());
      }
      onConfirm(engine);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 grid place-items-center bg-[rgba(12,24,32,0.45)] p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="surface-solid w-full max-w-md rounded-[var(--radius)] p-5"
        initial={{ scale: 0.97, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.98, y: 8 }}
      >
        <h3 className="display mt-0 mb-4 text-xl font-semibold">{t("importTitle")}</h3>
        {/* importChoose: Nasıl aktarmak istediğini seç, ardından CV dosyanı seçersin.
            importLocalDesc: İnternet olmadan dosyadan okur
            importGeminiDesc: Daha akıllı alan eşlemesi — API anahtarı gerekir */}

        <div className="grid gap-2">
          <EngineOption
            active={engine === "local"}
            title={t("importLocal")}
            onClick={() => setEngine("local")}
          />
          <EngineOption
            active={engine === "gemini"}
            title={t("importGemini")}
            onClick={() => setEngine("gemini")}
          />
        </div>

        {engine === "gemini" && !hasKey && (
          <div className="mt-3 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--accent-soft)] p-3">
            {/* geminiKeyHint: Gemini ile aktarmak için API anahtarı gerekli */}
            <label className="block text-sm">
              <span className="mb-1.5 block text-[var(--ink-soft)]">{t("geminiKey")}</span>
              <input
                className="field"
                type="password"
                autoComplete="off"
                placeholder={t("geminiKeyPlaceholder")}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </label>
          </div>
        )}

        {error && <p className="mt-3 mb-0 text-sm text-[var(--danger)]">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("cancel")}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving}
            onClick={() => void handleContinue()}
          >
            {t("continue")}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function EngineOption({
  active,
  title,
  onClick,
}: {
  active: boolean;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[var(--radius-sm)] border px-3 py-3 text-left text-sm font-semibold transition-colors ${
        active
          ? "border-[var(--accent)] bg-[var(--accent-soft)]"
          : "border-[var(--line)] bg-[var(--surface-strong)]"
      }`}
    >
      {title}
    </button>
  );
}
