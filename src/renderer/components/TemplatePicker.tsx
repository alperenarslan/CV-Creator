import { useEffect, useMemo, useRef, useState } from "react";
import type { CVData } from "../../shared/cv";
import {
  defaultStyleAxes,
  recommendTemplate,
  TEMPLATE_CATALOG,
  type CVTemplateId,
  type StyleAxes,
} from "../../shared/templates";
import { useLocale } from "../i18n/LocaleContext";

export function TemplatePicker({
  cv,
  onChange,
}: {
  cv: CVData;
  onChange: (next: CVData) => void;
}) {
  const { t } = useLocale();
  const [advisorOpen, setAdvisorOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const axes: StyleAxes = cv.meta.styleAxes ?? defaultStyleAxes;
  const active = cv.meta.templateId;
  const wasImported = Boolean(cv.meta.wasImported);

  const advice = useMemo(
    () => recommendTemplate(axes, { wasImported }),
    [axes, wasImported],
  );

  const visibleCatalog = TEMPLATE_CATALOG.filter(
    (item) => item.id !== "source" || wasImported,
  );

  const activeName = t(
    visibleCatalog.find((c) => c.id === active)?.nameKey ??
      TEMPLATE_CATALOG.find((c) => c.id === active)?.nameKey ??
      "templateAts",
  );

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  function setTemplate(templateId: CVTemplateId) {
    onChange({
      ...cv,
      meta: { ...cv.meta, templateId },
    });
    setMenuOpen(false);
  }

  function setAxes(next: StyleAxes) {
    const rec = recommendTemplate(next, { wasImported });
    onChange({
      ...cv,
      meta: {
        ...cv.meta,
        styleAxes: next,
        templateId: rec.templateId,
      },
    });
  }

  return (
    <div className="template-picker mb-3">
      <div className="template-toolbar">
        <div className="template-select" ref={menuRef}>
          <button
            type="button"
            className="template-select-trigger"
            aria-expanded={menuOpen}
            aria-haspopup="listbox"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span className="template-select-label">{t("templateLabel")}</span>
            <span className="template-select-value">{activeName}</span>
            <span className="template-select-chevron" aria-hidden="true">
              ▾
            </span>
          </button>
          {menuOpen ? (
            <div className="template-select-menu" role="listbox">
              {/* Chip tags (önerilen / içe aktarım) UI’da yok — messages.ts */}
              {visibleCatalog.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={active === item.id}
                  className={active === item.id ? "is-active" : ""}
                  onClick={() => setTemplate(item.id)}
                >
                  {t(item.nameKey)}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <button
          type="button"
          className={`btn btn-ghost !px-2.5 !py-1.5 text-xs ${advisorOpen ? "is-pressed" : ""}`}
          onClick={() => setAdvisorOpen((v) => !v)}
        >
          {advisorOpen ? t("templateAdvisorHide") : t("templateAdvisor")}
        </button>
      </div>

      {wasImported && cv.meta.importedFrom ? (
        <p className="m-0 mt-1.5 truncate text-[11px] text-[var(--ink-soft)]">
          ← {cv.meta.importedFrom}
        </p>
      ) : null}

      {advisorOpen ? (
        <div className="template-advisor mt-3">
          {/* templateAdvisorHint + recommend* — messages.ts */}
          <label className="template-axis">
            <span className="template-axis-labels">
              <span>{t("axisModern")}</span>
              <span>{t("axisRetro")}</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={axes.era}
              onChange={(e) => setAxes({ ...axes, era: Number(e.target.value) })}
            />
          </label>

          <label className="template-axis">
            <span className="template-axis-labels">
              <span>{t("axisCool")}</span>
              <span>{t("axisWarm")}</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={axes.temperature}
              onChange={(e) =>
                setAxes({ ...axes, temperature: Number(e.target.value) })
              }
            />
          </label>

          <div className="template-advice">
            <strong>
              {t(
                TEMPLATE_CATALOG.find((c) => c.id === advice.templateId)?.nameKey ??
                  "templateAts",
              )}
            </strong>
            <button
              type="button"
              className="btn btn-primary !px-2.5 !py-1 text-xs"
              onClick={() => setTemplate(advice.templateId)}
            >
              {t("applyRecommendation")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
