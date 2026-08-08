import {
  defaultStyleAxes,
  isTemplateId,
  type CVTemplateId,
  type StyleAxes,
} from "./templates";

export interface PersonalInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  /** Single birth date value, preferably YYYY-MM-DD */
  birthDate: string;
  nationality: string;
  postCode: string;
  linkedIn: string;
  portfolio: string;
  /** Optional portrait as data URL (image/jpeg or image/png) */
  photo: string;
}

export interface EducationItem {
  id: string;
  school: string;
  degree: string;
  startYear: string;
  endYear: string;
}

export interface ExperienceItem {
  id: string;
  company: string;
  position: string;
  startYear: string;
  endYear: string;
  description: string;
}

export interface SkillsInfo {
  languages: string;
  softwareLanguages: string;
  hobbies: string;
  computerPrograms: string;
}

export interface CVMeta {
  templateId: CVTemplateId;
  /** Original file name when imported */
  importedFrom?: string;
  wasImported?: boolean;
  styleAxes?: StyleAxes;
}

export interface CVData {
  personal: PersonalInfo;
  education: EducationItem[];
  experience: ExperienceItem[];
  skills: SkillsInfo;
  summary: string;
  meta: CVMeta;
}

export function createId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptyCV(): CVData {
  return {
    personal: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      address: "",
      birthDate: "",
      nationality: "",
      postCode: "",
      linkedIn: "",
      portfolio: "",
      photo: "",
    },
    education: [
      {
        id: createId(),
        school: "",
        degree: "",
        startYear: "",
        endYear: "",
      },
    ],
    experience: [
      {
        id: createId(),
        company: "",
        position: "",
        startYear: "",
        endYear: "",
        description: "",
      },
    ],
    skills: {
      languages: "",
      softwareLanguages: "",
      hobbies: "",
      computerPrograms: "",
    },
    summary: "",
    meta: {
      templateId: "ats",
      styleAxes: { ...defaultStyleAxes },
    },
  };
}

export function fullName(cv: CVData): string {
  return `${cv.personal.firstName} ${cv.personal.lastName}`.trim() || "CV";
}

type LegacyPersonal = Partial<PersonalInfo> & {
  birthDay?: string;
  birthMonth?: string;
  birthYear?: string;
  maritalStatus?: string;
};

const MAX_PHOTO_CHARS = 1_800_000;

function sanitizePhoto(value: unknown): string {
  if (
    typeof value === "string" &&
    value.startsWith("data:image/") &&
    value.includes(";base64,") &&
    value.length > 64 &&
    value.length <= MAX_PHOTO_CHARS
  ) {
    return value;
  }
  return "";
}

/** Migrate older CV shapes (day/month/year + maritalStatus). */
export function normalizeCVData(raw: unknown): CVData {
  const empty = createEmptyCV();
  if (!raw || typeof raw !== "object") return empty;
  const parsed = raw as Partial<CVData> & { personal?: LegacyPersonal };
  const p: LegacyPersonal = parsed.personal ?? {};

  let birthDate = p.birthDate ?? "";
  if (!birthDate && (p.birthYear || p.birthMonth || p.birthDay)) {
    const y = p.birthYear || "";
    const m = (p.birthMonth || "").padStart(2, "0");
    const d = (p.birthDay || "").padStart(2, "0");
    birthDate = y && m && d ? `${y}-${m}-${d}` : [d, m, y].filter(Boolean).join("/");
  }

  const rawMeta = (parsed as { meta?: Partial<CVMeta> }).meta;
  const templateId = isTemplateId(rawMeta?.templateId) ? rawMeta.templateId : empty.meta.templateId;
  const styleAxes: StyleAxes = {
    era:
      typeof rawMeta?.styleAxes?.era === "number"
        ? rawMeta.styleAxes.era
        : (empty.meta.styleAxes?.era ?? defaultStyleAxes.era),
    temperature:
      typeof rawMeta?.styleAxes?.temperature === "number"
        ? rawMeta.styleAxes.temperature
        : (empty.meta.styleAxes?.temperature ?? defaultStyleAxes.temperature),
  };

  return {
    ...empty,
    ...parsed,
    personal: {
      ...empty.personal,
      firstName: p.firstName ?? "",
      lastName: p.lastName ?? "",
      email: p.email ?? "",
      phone: p.phone ?? "",
      address: p.address ?? "",
      birthDate,
      nationality: p.nationality ?? "",
      postCode: p.postCode ?? "",
      linkedIn: p.linkedIn ?? "",
      portfolio: p.portfolio ?? "",
      photo: sanitizePhoto(p.photo),
    },
    education: Array.isArray(parsed.education) && parsed.education.length ? parsed.education : empty.education,
    experience:
      Array.isArray(parsed.experience) && parsed.experience.length ? parsed.experience : empty.experience,
    skills: { ...empty.skills, ...(parsed.skills ?? {}) },
    summary: parsed.summary ?? "",
    meta: {
      templateId,
      importedFrom: typeof rawMeta?.importedFrom === "string" ? rawMeta.importedFrom : undefined,
      wasImported: Boolean(rawMeta?.wasImported),
      styleAxes,
    },
  };
}
