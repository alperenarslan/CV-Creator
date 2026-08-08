import type { CVData } from "../../shared/cv";
import { fullName } from "../../shared/cv";
import { isTemplateId, type CVTemplateId } from "../../shared/templates";
import { useLocale } from "../i18n/LocaleContext";

export function CVPreview({ cv }: { cv: CVData }) {
  const { t } = useLocale();
  const p = cv.personal;
  const template: CVTemplateId = isTemplateId(cv.meta?.templateId)
    ? cv.meta.templateId
    : "ats";
  const hasPhoto = Boolean(p.photo?.startsWith("data:image/"));

  return (
    <div className={`cv-sheet cv-sheet--${template} h-full overflow-auto scroll-thin`}>
      <div className={`cv-header ${hasPhoto ? "has-photo" : ""}`}>
        {hasPhoto ? (
          <img
            className="cv-photo"
            src={p.photo}
            alt=""
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : null}
        <div className="cv-header-text">
          <h1 className="cv-name m-0">{fullName(cv)}</h1>
          <p className="cv-meta mt-1 mb-0 break-words">
            {[p.email, p.phone, p.address].filter(Boolean).join(" · ") || t("contactInfo")}
          </p>
        </div>
      </div>

      {cv.summary ? (
        <section className="cv-section mb-4 mt-4">
          <h2 className="cv-h2 m-0">{t("summary")}</h2>
          <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">{cv.summary}</p>
        </section>
      ) : (
        <div className="mt-4" />
      )}

      <section className="cv-section mb-4">
        <h2 className="cv-h2 m-0">{t("personal")}</h2>
        <p className="mt-1 text-sm leading-relaxed">
          {t("nationality")}: {p.nationality || "—"}
          <br />
          {t("birthDate")}: {p.birthDate || "—"}
          {p.linkedIn ? (
            <>
              <br />
              LinkedIn: {p.linkedIn}
            </>
          ) : null}
          {p.portfolio ? (
            <>
              <br />
              Portfolio: {p.portfolio}
            </>
          ) : null}
        </p>
      </section>

      <section className="cv-section mb-4">
        <h2 className="cv-h2 m-0">{t("education")}</h2>
        <ul className="cv-list mt-1 space-y-2 pl-4 text-sm">
          {cv.education.map((e) => (
            <li key={e.id}>
              <strong>{e.degree || t("education")}</strong> — {e.school || "—"} ({e.startYear || "?"}–
              {e.endYear || "?"})
            </li>
          ))}
        </ul>
      </section>

      <section className="cv-section mb-4">
        <h2 className="cv-h2 m-0">{t("skills")}</h2>
        <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">
          {t("spokenLanguages")}: {cv.skills.languages || "—"}
          <br />
          {t("softwareLanguages")}: {cv.skills.softwareLanguages || "—"}
          <br />
          {t("tools")}: {cv.skills.computerPrograms || "—"}
          <br />
          {t("hobbies")}: {cv.skills.hobbies || "—"}
        </p>
      </section>

      <section className="cv-section">
        <h2 className="cv-h2 m-0">{t("experience")}</h2>
        <ul className="cv-exp mt-1 list-none space-y-3 pl-0 text-sm">
          {cv.experience.map((e) => (
            <li key={e.id} className="cv-exp-item">
              <strong>{e.position || t("position")}</strong> @ {e.company || t("company")}
              <div className="cv-exp-dates">
                {e.startYear || "?"} – {e.endYear || "?"}
              </div>
              {e.description ? (
                <p className="mt-1 whitespace-pre-wrap text-[13px]">{e.description}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
