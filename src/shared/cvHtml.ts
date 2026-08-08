import { fullName, type CVData } from "./cv";
import type { AppLocale } from "./prefs";
import { isTemplateId, type CVTemplateId } from "./templates";

export interface CvHtmlLabels {
  summary: string;
  personal: string;
  education: string;
  skills: string;
  experience: string;
  nationality: string;
  birthDate: string;
  languages: string;
  software: string;
  tools: string;
  hobbies: string;
}

const labelsTr: CvHtmlLabels = {
  summary: "Özet",
  personal: "Kişisel bilgiler",
  education: "Eğitim",
  skills: "Beceriler",
  experience: "Deneyim",
  nationality: "Uyruk",
  birthDate: "Doğum tarihi",
  languages: "Diller",
  software: "Yazılım dilleri",
  tools: "Araçlar",
  hobbies: "Hobiler",
};

const labelsEn: CvHtmlLabels = {
  summary: "Summary",
  personal: "Personal information",
  education: "Education",
  skills: "Skills",
  experience: "Experience",
  nationality: "Nationality",
  birthDate: "Date of birth",
  languages: "Languages",
  software: "Programming languages",
  tools: "Tools",
  hobbies: "Hobbies",
};

export function labelsForLocale(locale: AppLocale): CvHtmlLabels {
  return locale === "en" ? labelsEn : labelsTr;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function templateCss(id: CVTemplateId): string {
  switch (id) {
    case "ats":
      return `
  body { font-family: Calibri, Arial, Helvetica, sans-serif; max-width: 720px; margin: 28px auto; color: #111; line-height: 1.45; font-size: 11pt; }
  .cv-header { display: flex; gap: 14px; align-items: flex-start; margin-bottom: 4px; }
  .cv-header-text { flex: 1; min-width: 0; }
  .cv-photo { width: 92px; height: 110px; object-fit: cover; border-radius: 2px; flex-shrink: 0; }
  h1 { font-size: 18pt; margin: 0 0 4px; font-weight: 700; letter-spacing: 0.02em; text-transform: uppercase; }
  h2 { font-size: 12pt; margin: 18px 0 6px; border-bottom: 1px solid #222; padding-bottom: 3px; text-transform: uppercase; letter-spacing: 0.04em; color: #111; }
  .meta { color: #222; font-size: 10pt; margin: 0 0 8px; }
  ul { padding-left: 1.1rem; margin: 0.3rem 0; }
  li { margin: 0.35rem 0; }
  .job-title { font-weight: 700; }
  .muted { color: #333; font-size: 10pt; }
  .exp-desc { margin: 2px 0 0; }`;
    case "source":
      return `
  body { font-family: "Times New Roman", Times, Georgia, serif; max-width: 720px; margin: 32px auto; color: #1a1a1a; line-height: 1.5; font-size: 11pt; }
  .cv-header { display: flex; gap: 16px; align-items: flex-start; margin-bottom: 4px; }
  .cv-header-text { flex: 1; min-width: 0; }
  .cv-photo { width: 96px; height: 118px; object-fit: cover; border-radius: 3px; flex-shrink: 0; border: 1px solid #cbd5e1; }
  h1 { font-size: 20pt; margin: 0 0 6px; font-weight: 700; color: #0f2744; }
  h2 { font-size: 12pt; margin: 20px 0 8px; border-bottom: 1.5px solid #0f2744; padding-bottom: 3px; color: #0f2744; text-transform: uppercase; letter-spacing: 0.03em; }
  .meta { color: #333; font-size: 10.5pt; margin: 0 0 10px; }
  ul { padding-left: 1.15rem; margin: 0.35rem 0; }
  li { margin: 0.4rem 0; }
  .job-title { font-weight: 700; }
  .muted { color: #444; font-size: 10pt; }
  .exp-desc { margin: 3px 0 0; }`;
    case "modern":
      return `
  body { font-family: "Segoe UI", system-ui, sans-serif; max-width: 740px; margin: 36px auto; color: #14212b; line-height: 1.5; font-size: 10.5pt; }
  .cv-header { display: flex; gap: 16px; align-items: flex-start; margin-bottom: 4px; }
  .cv-header-text { flex: 1; min-width: 0; }
  .cv-photo { width: 96px; height: 96px; object-fit: cover; border-radius: 12px; flex-shrink: 0; }
  h1 { font-size: 22pt; margin: 0 0 4px; font-weight: 650; letter-spacing: -0.02em; }
  h2 { font-size: 11pt; margin: 22px 0 8px; border-bottom: 1px solid #d7e0e7; padding-bottom: 5px; color: #0b6e99; font-weight: 650; }
  .meta { color: #4a5d6a; font-size: 10pt; margin: 0 0 10px; }
  ul { padding-left: 1.1rem; margin: 0.35rem 0; }
  li { margin: 0.45rem 0; }
  .job-title { font-weight: 650; }
  .muted { color: #4a5d6a; font-size: 9.5pt; }
  .exp-item { border-left: 2px solid #9ec9db; padding-left: 10px; list-style: none; margin-left: -4px; }
  .exp-desc { margin: 4px 0 0; }`;
    case "cool":
      return `
  body { font-family: "Segoe UI", system-ui, sans-serif; max-width: 740px; margin: 36px auto; color: #0f172a; line-height: 1.5; font-size: 10.5pt; background: #f8fafc; padding: 8px 20px; }
  .cv-header { display: flex; gap: 16px; align-items: flex-start; margin-bottom: 4px; }
  .cv-header-text { flex: 1; min-width: 0; }
  .cv-photo { width: 92px; height: 92px; object-fit: cover; border-radius: 999px; flex-shrink: 0; border: 2px solid #bae6fd; }
  h1 { font-size: 22pt; margin: 0 0 4px; font-weight: 600; color: #0c4a6e; letter-spacing: -0.03em; }
  h2 { font-size: 10.5pt; margin: 22px 0 8px; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; color: #0369a1; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 650; }
  .meta { color: #475569; font-size: 10pt; margin: 0 0 10px; }
  ul { padding-left: 1.1rem; margin: 0.35rem 0; }
  li { margin: 0.45rem 0; }
  .job-title { font-weight: 650; color: #0f172a; }
  .muted { color: #64748b; font-size: 9.5pt; }
  .exp-item { list-style: none; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0; margin-left: 0; }
  .exp-item:last-child { border-bottom: none; }
  .exp-desc { margin: 4px 0 0; }`;
    case "warm":
      return `
  body { font-family: Georgia, "Times New Roman", serif; max-width: 740px; margin: 36px auto; color: #3d2c29; line-height: 1.55; font-size: 10.5pt; background: #faf6f1; padding: 8px 20px; }
  .cv-header { display: flex; gap: 16px; align-items: flex-start; margin-bottom: 4px; }
  .cv-header-text { flex: 1; min-width: 0; }
  .cv-photo { width: 100px; height: 118px; object-fit: cover; border-radius: 8px; flex-shrink: 0; border: 2px solid #fdba74; }
  h1 { font-family: Georgia, serif; font-size: 24pt; margin: 0 0 6px; font-weight: 700; color: #5c2e1a; }
  h2 { font-family: "Segoe UI", system-ui, sans-serif; font-size: 10.5pt; margin: 22px 0 8px; border-bottom: 2px solid #c2410c; padding-bottom: 4px; color: #9a3412; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 650; }
  .meta { font-family: "Segoe UI", system-ui, sans-serif; color: #6b4f47; font-size: 10pt; margin: 0 0 10px; }
  ul { padding-left: 1.15rem; margin: 0.35rem 0; }
  li { margin: 0.45rem 0; }
  .job-title { font-weight: 700; }
  .muted { font-family: "Segoe UI", system-ui, sans-serif; color: #7c5c52; font-size: 9.5pt; }
  .exp-desc { margin: 4px 0 0; }`;
    case "retro":
      return `
  body { font-family: "Courier New", Courier, monospace; max-width: 700px; margin: 32px auto; color: #1c1917; line-height: 1.45; font-size: 10.5pt; }
  .cv-header { display: flex; flex-direction: column; align-items: center; gap: 10px; margin-bottom: 4px; }
  .cv-header-text { width: 100%; text-align: center; }
  .cv-photo { width: 100px; height: 120px; object-fit: cover; border-radius: 0; flex-shrink: 0; border: 2px solid #1c1917; }
  h1 { font-family: "Times New Roman", Times, serif; font-size: 22pt; margin: 0 0 8px; font-weight: 700; text-align: center; text-transform: uppercase; letter-spacing: 0.08em; }
  h2 { font-family: "Times New Roman", Times, serif; font-size: 12pt; margin: 20px 0 8px; border-top: 2px double #1c1917; border-bottom: 2px double #1c1917; padding: 4px 0; text-align: center; text-transform: uppercase; letter-spacing: 0.12em; }
  .meta { text-align: center; color: #292524; font-size: 9.5pt; margin: 0 0 14px; }
  ul { padding-left: 1.2rem; margin: 0.35rem 0; }
  li { margin: 0.4rem 0; }
  .job-title { font-weight: 700; }
  .muted { color: #44403c; font-size: 9.5pt; }
  .exp-desc { margin: 3px 0 0; }`;
    default:
      return templateCss("ats");
  }
}

export function resolveTemplateId(cv: CVData): CVTemplateId {
  return isTemplateId(cv.meta?.templateId) ? cv.meta.templateId : "ats";
}

export function cvToHtml(cv: CVData, locale: AppLocale = "tr"): string {
  const p = cv.personal;
  const name = fullName(cv);
  const L = labelsForLocale(locale);
  const templateId = resolveTemplateId(cv);
  const useExpClass = templateId === "modern" || templateId === "cool";

  const edu = cv.education
    .map(
      (e) =>
        `<li><strong>${escapeHtml(e.degree || L.education)}</strong> — ${escapeHtml(e.school)} (${escapeHtml(e.startYear)}–${escapeHtml(e.endYear)})</li>`,
    )
    .join("");

  const exp = cv.experience
    .map((e) => {
      const cls = useExpClass ? ' class="exp-item"' : "";
      return `<li${cls}><span class="job-title">${escapeHtml(e.position)}</span> @ ${escapeHtml(e.company)} <span class="muted">(${escapeHtml(e.startYear)}–${escapeHtml(e.endYear)})</span>${
        e.description ? `<div class="exp-desc">${escapeHtml(e.description)}</div>` : ""
      }</li>`;
    })
    .join("");

  const contact = [p.email, p.phone, p.address].filter(Boolean).map(escapeHtml).join(" · ");
  const photo =
    p.photo && p.photo.startsWith("data:image/")
      ? `<img class="cv-photo" src="${p.photo.replaceAll('"', "")}" alt="" />`
      : "";

  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
<title>${escapeHtml(name)} CV</title>
<style>
${templateCss(templateId)}
  @media print { body { margin: 0; background: #fff; } }
</style>
</head>
<body>
  <div class="cv-header">
    ${photo}
    <div class="cv-header-text">
      <h1>${escapeHtml(name)}</h1>
      <p class="meta">${contact}</p>
    </div>
  </div>
  ${cv.summary ? `<h2>${L.summary}</h2><p>${escapeHtml(cv.summary)}</p>` : ""}
  <h2>${L.personal}</h2>
  <p>${L.nationality}: ${escapeHtml(p.nationality)}<br/>
  ${L.birthDate}: ${escapeHtml(p.birthDate)}
  ${p.postCode ? `<br/>${escapeHtml(p.postCode)}` : ""}
  ${p.linkedIn ? `<br/>LinkedIn: ${escapeHtml(p.linkedIn)}` : ""}
  ${p.portfolio ? `<br/>Portfolio: ${escapeHtml(p.portfolio)}` : ""}
  </p>
  <h2>${L.education}</h2><ul>${edu}</ul>
  <h2>${L.skills}</h2>
  <p>${L.languages}: ${escapeHtml(cv.skills.languages)}<br/>
  ${L.software}: ${escapeHtml(cv.skills.softwareLanguages)}<br/>
  ${L.tools}: ${escapeHtml(cv.skills.computerPrograms)}<br/>
  ${L.hobbies}: ${escapeHtml(cv.skills.hobbies)}</p>
  <h2>${L.experience}</h2><ul${useExpClass ? ' style="list-style:none;padding-left:0"' : ""}>${exp}</ul>
</body>
</html>`;
}
