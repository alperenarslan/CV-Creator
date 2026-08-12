import type { CVData } from "./cv";
import { fullName } from "./cv";

export type AtsSeverity = "pass" | "warn" | "fail";

export interface AtsCheckItem {
  id: string;
  severity: AtsSeverity;
  title: string;
  detail: string;
}

export interface AtsReport {
  score: number;
  items: AtsCheckItem[];
}

export interface AtsCheckInput {
  cv: CVData;
  missingKeywords?: string[];
  locale?: "tr" | "en";
}

function scoreFromItems(items: AtsCheckItem[]): number {
  if (!items.length) return 100;
  let points = 0;
  let weight = 0;
  for (const item of items) {
    const w = item.severity === "fail" ? 3 : item.severity === "warn" ? 2 : 1;
    weight += w;
    if (item.severity === "pass") points += w;
    else if (item.severity === "warn") points += w * 0.45;
  }
  return Math.max(0, Math.min(100, Math.round((points / weight) * 100)));
}

/** Local ATS-oriented checklist — no network. */
export function runAtsCheck(input: AtsCheckInput): AtsReport {
  const { cv, missingKeywords = [], locale = "tr" } = input;
  const tr = locale === "tr";
  const p = cv.personal;
  const items: AtsCheckItem[] = [];

  const name = fullName(cv).trim();
  items.push({
    id: "name",
    severity: name.length >= 2 ? "pass" : "fail",
    title: tr ? "Ad soyad" : "Full name",
    detail: name
      ? name
      : tr
        ? "Ad ve soyad boş — ATS ve recruiter için kritik."
        : "First/last name empty — critical for ATS and recruiters.",
  });

  items.push({
    id: "email",
    severity: /.+@.+\..+/.test(p.email.trim()) ? "pass" : "fail",
    title: tr ? "E-posta" : "Email",
    detail: p.email.trim()
      ? p.email.trim()
      : tr
        ? "Geçerli bir e-posta ekle."
        : "Add a valid email address.",
  });

  items.push({
    id: "phone",
    severity: p.phone.replace(/\D/g, "").length >= 7 ? "pass" : "warn",
    title: tr ? "Telefon" : "Phone",
    detail: p.phone.trim()
      ? p.phone.trim()
      : tr
        ? "Telefon numarası eksik veya kısa."
        : "Phone missing or too short.",
  });

  const summaryLen = cv.summary.trim().length;
  items.push({
    id: "summary",
    severity: summaryLen >= 80 ? "pass" : summaryLen >= 30 ? "warn" : "fail",
    title: tr ? "Profesyonel özet" : "Professional summary",
    detail:
      summaryLen >= 80
        ? tr
          ? `${summaryLen} karakter — yeterli.`
          : `${summaryLen} chars — good.`
        : tr
          ? "Özeti 2–4 cümle ve ilan anahtar kelimeleriyle güçlendir."
          : "Strengthen the summary with 2–4 sentences and job keywords.",
  });

  items.push({
    id: "experience",
    severity: cv.experience.length > 0 ? "pass" : "fail",
    title: tr ? "İş deneyimi" : "Work experience",
    detail:
      cv.experience.length > 0
        ? tr
          ? `${cv.experience.length} kayıt`
          : `${cv.experience.length} entries`
        : tr
          ? "En az bir deneyim satırı ekle."
          : "Add at least one experience entry.",
  });

  const thinExp = cv.experience.filter((e) => e.description.trim().length < 40);
  if (cv.experience.length > 0) {
    items.push({
      id: "experience-detail",
      severity: thinExp.length === 0 ? "pass" : thinExp.length === cv.experience.length ? "fail" : "warn",
      title: tr ? "Deneyim açıklamaları" : "Experience bullets",
      detail:
        thinExp.length === 0
          ? tr
            ? "Açıklamalar dolu."
            : "Descriptions look filled."
          : tr
            ? `${thinExp.length} deneyimde açıklama çok kısa — etki / sonuç ekle.`
            : `${thinExp.length} roles have thin descriptions — add impact.`,
    });
  }

  items.push({
    id: "education",
    severity: cv.education.length > 0 ? "pass" : "warn",
    title: tr ? "Eğitim" : "Education",
    detail:
      cv.education.length > 0
        ? tr
          ? `${cv.education.length} kayıt`
          : `${cv.education.length} entries`
        : tr
          ? "Eğitim bölümü boş."
          : "Education section is empty.",
  });

  const skillsBlob = [
    cv.skills.languages,
    cv.skills.softwareLanguages,
    cv.skills.computerPrograms,
  ]
    .join(" ")
    .trim();
  items.push({
    id: "skills",
    severity: skillsBlob.length >= 8 ? "pass" : "warn",
    title: tr ? "Beceriler" : "Skills",
    detail:
      skillsBlob.length >= 8
        ? tr
          ? "Beceri alanları dolu."
          : "Skills fields look filled."
        : tr
          ? "Dil / yazılım / araç alanlarını doldur."
          : "Fill language / software / tools fields.",
  });

  const template = cv.meta.templateId;
  const atsSafe = template === "ats" || template === "modern" || template === "source";
  items.push({
    id: "template",
    severity: atsSafe ? "pass" : "warn",
    title: tr ? "Şablon" : "Template",
    detail: atsSafe
      ? tr
        ? `"${template}" — başvuru sistemleri için uygun.`
        : `"${template}" — fine for most ATS portals.`
      : tr
        ? `"${template}" görsel ağırlıklı; portal başvurularında ATS şablonunu tercih et.`
        : `"${template}" is more visual; prefer ATS for portal applications.`,
  });

  if (missingKeywords.length > 0) {
    const sample = missingKeywords.slice(0, 6).join(", ");
    items.push({
      id: "keywords",
      severity: missingKeywords.length >= 5 ? "fail" : "warn",
      title: tr ? "İlan anahtar kelimeleri" : "Job keywords",
      detail: tr
        ? `Eksik görünenler: ${sample}. Özet veya becerilere doğal şekilde ekle.`
        : `Still missing: ${sample}. Weave into summary or skills naturally.`,
    });
  } else {
    items.push({
      id: "keywords",
      severity: "pass",
      title: tr ? "İlan anahtar kelimeleri" : "Job keywords",
      detail: tr
        ? "Bu kontrol için eksik kelime listesi yok (önce ilan analizi yap)."
        : "No missing-keyword list for this check (run job analysis first).",
    });
  }

  return { score: scoreFromItems(items), items };
}

export function formatAtsChecklist(report: AtsReport, locale: "tr" | "en" = "tr"): string {
  const tr = locale === "tr";
  const lines = [
    tr ? `ATS kontrol skoru: ${report.score}/100` : `ATS check score: ${report.score}/100`,
    "",
  ];
  for (const item of report.items) {
    const mark = item.severity === "pass" ? "[OK]" : item.severity === "warn" ? "[!]" : "[X]";
    lines.push(`${mark} ${item.title}`);
    lines.push(`    ${item.detail}`);
    lines.push("");
  }
  return lines.join("\n");
}
