import { useMemo, useState } from "react";
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
  const axes: StyleAxes = cv.meta.styleAxes ?? defaultStyleAxes;
  const active = cv.meta.templateId;
  const wasImported = Boolean(cv.meta.wasImported);

  const advice = useMemo(
    () => recommendTemplate(axes, { wasImported }),
    [axes, wasImported],
  );

  function setTemplate(templateId: CVTemplateId) {
    onChange({
      ...cv,
      meta: { ...cv.meta, templateId },
    });
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

  const visibleCatalog = TEMPLATE_CATALOG.filter(
    (item) => item.id !== "source" || wasImported,
  );

  return (
    <div className="template-picker mb-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold tracking-wide text-[var(--ink-soft)] uppercase">
            {t("templateLabel")}
          </span>
          {wasImported && cv.meta.importedFrom ? (
            <span className="text-[11px] text-[var(--ink-soft)]" title={cv.meta.importedFrom}>
              ← {cv.meta.importedFrom}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          className="btn btn-ghost !px-2 !py-1 text-xs"
          onClick={() => setAdvisorOpen((v) => !v)}
        >
          {advisorOpen ? t("templateAdvisorHide") : t("templateAdvisor")}
        </button>
      </div>

      <div className="template-chips">
        {visibleCatalog.map((item) => {
          const selected = active === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`template-chip ${selected ? "is-active" : ""}`}
              onClick={() => setTemplate(item.id)}
              title={t(item.descKey)}
            >
              <span>{t(item.nameKey)}</span>
              {item.recommended ? (
                <em className="template-chip-tag">{t("templateRecommended")}</em>
              ) : null}
              {item.id === "source" ? (
                <em className="template-chip-tag">{t("templateFromImport")}</em>
              ) : null}
            </button>
          );
        })}
      </div>

      {advisorOpen ? (
        <div className="template-advisor mt-3">
          <p className="m-0 mb-3 text-xs leading-relaxed text-[var(--ink-soft)]">
            {t("templateAdvisorHint")}
          </p>

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
              onChange={(e) =>
                setAxes({ ...axes, era: Number(e.target.value) })
              }
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
            <strong>{t(advice.reasonKey)}</strong>
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
