import { fullName, type CVData } from "./cv";
import type { AdaptLocale } from "./analysis";

export type ApplicationStatus =
  | "saved"
  | "applied"
  | "interviewing"
  | "offer"
  | "rejected"
  | "withdrawn";

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  "saved",
  "applied",
  "interviewing",
  "offer",
  "rejected",
  "withdrawn",
];

export interface JobApplication {
  id: string;
  url: string;
  jobTitle: string;
  company: string;
  matchScore: number;
  status: ApplicationStatus;
  summary: string;
  strengths: string[];
  missingKeywords: string[];
  notes: string;
  analyzedAt: string;
  updatedAt: string;
  appliedAt?: string;
  /** ISO date (YYYY-MM-DD) for follow-up reminder */
  followUpAt?: string;
  /** ISO datetime or date for interview calendar */
  interviewAt?: string;
  coverLetter?: string;
  coverSubject?: string;
  hasSnapshot?: boolean;
  packageFolder?: string;
  interviewTips?: string[];
  /** What went wrong / what to learn after rejection or ghosting */
  rejectionNote?: string;
  /** Keywords extracted from rejection lessons */
  learnedKeywords?: string[];
}

export interface UpsertApplicationInput {
  url: string;
  jobTitle: string;
  company: string;
  matchScore: number;
  summary: string;
  strengths: string[];
  missingKeywords: string[];
  interviewTips?: string[];
}

export interface UpdateApplicationPatch {
  id: string;
  status?: ApplicationStatus;
  notes?: string;
  appliedAt?: string | null;
  followUpAt?: string | null;
  interviewAt?: string | null;
  jobTitle?: string;
  company?: string;
  coverLetter?: string | null;
  coverSubject?: string | null;
  hasSnapshot?: boolean;
  packageFolder?: string | null;
  rejectionNote?: string | null;
  learnedKeywords?: string[] | null;
}

/** Default follow-up = applied date + 7 days */
export function defaultFollowUpDate(fromIso = new Date().toISOString()): string {
  const d = new Date(fromIso.slice(0, 10) + "T12:00:00");
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

export function isFollowUpDue(app: JobApplication, today = new Date()): boolean {
  if (!app.followUpAt) return false;
  if (app.status === "rejected" || app.status === "withdrawn" || app.status === "offer") {
    return false;
  }
  if (app.status !== "applied" && app.status !== "interviewing") return false;
  const due = app.followUpAt.slice(0, 10);
  const now = today.toISOString().slice(0, 10);
  return due <= now;
}

export function followUpClipboardText(app: JobApplication, locale: AdaptLocale): string {
  const company = app.company || (locale === "tr" ? "ekibiniz" : "your team");
  const role = app.jobTitle || (locale === "tr" ? "pozisyon" : "role");
  if (locale === "tr") {
    return `Merhaba,\n\n${company} bünyesindeki ${role} başvurum hakkında kısa bir takip notu bırakmak istedim. Süreci öğrenmek ve ek bilgi gerekirse yardımcı olmak isterim.\n\nTeşekkürler`;
  }
  return `Hello,\n\nI wanted to follow up briefly on my application for the ${role} role at ${company}. Happy to share anything else that would help.\n\nThank you`;
}

export function thankYouClipboardText(app: JobApplication, locale: AdaptLocale): string {
  const company = app.company || (locale === "tr" ? "ekibiniz" : "your team");
  const role = app.jobTitle || (locale === "tr" ? "pozisyon" : "role");
  if (locale === "tr") {
    return `Merhaba,\n\n${company} ile ${role} mülakatı için teşekkür ederim. Rol ve ekip hakkında konuşmak keyifliydi. Süreci öğrenmek için sabırsızlanıyorum; ek bilgi isterseniz memnuniyetle paylaşırım.\n\nSevgiler`;
  }
  return `Hello,\n\nThank you for the conversation about the ${role} role at ${company}. I enjoyed learning more about the team. Happy to share anything else that would help.\n\nBest regards`;
}

export function rejectionThanksClipboardText(app: JobApplication, locale: AdaptLocale): string {
  const company = app.company || (locale === "tr" ? "ekibiniz" : "your team");
  const role = app.jobTitle || (locale === "tr" ? "pozisyon" : "role");
  if (locale === "tr") {
    return `Merhaba,\n\n${company} ${role} süreci hakkındaki bilgilendirme için teşekkür ederim. Kararı saygıyla karşılıyorum; ileride uygun bir rol olursa tekrar görüşmek isterim.\n\nSevgiler`;
  }
  return `Hello,\n\nThank you for the update on the ${role} process at ${company}. I respect the decision and would welcome staying in touch for a future fit.\n\nBest regards`;
}

/** Aggregate learned + missing keywords from rejected apps for next applications. */
export function collectLearnedKeywords(apps: JobApplication[], limit = 12): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const app of apps) {
    if (app.status !== "rejected" && app.status !== "withdrawn") continue;
    const pool = [...(app.learnedKeywords || []), ...(app.missingKeywords || [])];
    for (const raw of pool) {
      const key = raw.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(raw.trim());
      if (out.length >= limit) return out;
    }
  }
  return out;
}

export function buildInterviewIcs(app: JobApplication, locale: AdaptLocale): string | null {
  if (!app.interviewAt) return null;
  const start = new Date(app.interviewAt.includes("T") ? app.interviewAt : `${app.interviewAt}T10:00:00`);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const stamp = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z$/, "Z");
  const title =
    locale === "tr"
      ? `Mülakat: ${app.jobTitle || "Rol"}${app.company ? ` · ${app.company}` : ""}`
      : `Interview: ${app.jobTitle || "Role"}${app.company ? ` · ${app.company}` : ""}`;
  const desc = [app.url, app.summary].filter(Boolean).join("\\n");
  const uid = `${app.id}-${stamp(start)}@cvcreator.local`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CV Creator//Interview//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escapeIcs(title)}`,
    desc ? `DESCRIPTION:${escapeIcs(desc)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ]
    .filter(Boolean)
    .join("\r\n");
}

function escapeIcs(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function pitchFromCv(cv: CVData, locale: AdaptLocale): string {
  const name = fullName(cv).trim();
  const summary = cv.summary.trim();
  if (summary) {
    const sentences = summary.split(/(?<=[.!?…])\s+/).filter(Boolean).slice(0, 3);
    return sentences.join(" ");
  }
  const role = cv.experience[0]?.position || "";
  if (locale === "tr") {
    return [name, role].filter(Boolean).join(" — ") || name || "—";
  }
  return [name, role].filter(Boolean).join(" — ") || name || "—";
}
