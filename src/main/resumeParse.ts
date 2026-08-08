import { createEmptyCV, createId, type CVData, type EducationItem, type ExperienceItem } from "../shared/cv";

const SECTION_PATTERNS: Array<{ key: SectionKey; re: RegExp }> = [
  {
    key: "summary",
    re: /^(summary|profile|objective|about(\s+me)?|özet|profil|hakkımda|kariyer\s*hedefi)\b/i,
  },
  {
    key: "experience",
    re: /^(experience|work\s*experience|employment|professional\s*experience|deneyim|iş\s*deneyimi|çalışma\s*deneyimi|work\s*history)\b/i,
  },
  {
    key: "education",
    re: /^(education|academic|eğitim|öğrenim|akademik)\b/i,
  },
  {
    key: "skills",
    re: /^(skills|technical\s*skills|competencies|beceriler|yetenekler|teknik\s*beceriler|yetenek)\b/i,
  },
  {
    key: "languages",
    re: /^(languages|spoken\s*languages|diller|konuşulan\s*diller)\b/i,
  },
  {
    key: "software",
    re: /^(software|programming(\s*languages)?|tech\s*stack|yazılım(\s*dilleri)?|programlama(\s*dilleri)?)\b/i,
  },
  {
    key: "tools",
    re: /^(tools|programs|applications|bilgisayar\s*programları|araçlar|teknolojiler)\b/i,
  },
  {
    key: "hobbies",
    re: /^(hobbies|interests|hobiler|ilgi\s*alanları)\b/i,
  },
  {
    key: "personal",
    re: /^(personal(\s*information)?|contact|iletişim|kişisel(\s*bilgiler)?)\b/i,
  },
];

type SectionKey =
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "languages"
  | "software"
  | "tools"
  | "hobbies"
  | "personal"
  | "header";

const YEAR_RANGE =
  /(\b(?:19|20)\d{2})\s*(?:[-–—to]+\s*|[-–—]\s*)(?:(present|current|günümüz|hala|halen)|(\b(?:19|20)\d{2}))/i;
const YEAR_SINGLE = /\b((?:19|20)\d{2})\b/g;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE =
  /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3,4}\)?[\s.-]?)\d{3,4}[\s.-]?\d{2,4}(?:[\s.-]?\d{2})?/;
const LINKEDIN_RE = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s,;]+/i;
const URL_RE = /https?:\/\/[^\s,;]+/i;
const POSTCODE_RE = /\b\d{5}\b/;

function normalizeLines(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function detectSection(line: string): SectionKey | null {
  const cleaned = line.replace(/[:：]\s*$/, "").trim();
  if (cleaned.length > 48) return null;
  for (const item of SECTION_PATTERNS) {
    if (item.re.test(cleaned)) return item.key;
  }
  return null;
}

function splitSections(lines: string[]): Record<SectionKey, string[]> {
  const sections: Record<SectionKey, string[]> = {
    header: [],
    summary: [],
    experience: [],
    education: [],
    skills: [],
    languages: [],
    software: [],
    tools: [],
    hobbies: [],
    personal: [],
  };

  let current: SectionKey = "header";
  for (const line of lines) {
    const section = detectSection(line);
    if (section) {
      current = section;
      continue;
    }
    sections[current].push(line);
  }
  return sections;
}

function extractYears(line: string): { startYear: string; endYear: string } {
  const range = line.match(YEAR_RANGE);
  if (range) {
    return {
      startYear: range[1] || "",
      endYear: range[3] || (range[2] ? "Günümüz" : ""),
    };
  }
  const years = [...line.matchAll(YEAR_SINGLE)].map((m) => m[1]);
  if (years.length >= 2) return { startYear: years[0], endYear: years[1] };
  if (years.length === 1) return { startYear: years[0], endYear: "" };
  return { startYear: "", endYear: "" };
}

function parseName(headerLines: string[]): { firstName: string; lastName: string } {
  const candidate =
    headerLines.find((l) => {
      if (EMAIL_RE.test(l) || PHONE_RE.test(l) || LINKEDIN_RE.test(l) || URL_RE.test(l)) return false;
      if (detectSection(l)) return false;
      const words = l.split(/\s+/);
      return (
        words.length >= 2 &&
        words.length <= 5 &&
        l.length <= 56 &&
        !/\d/.test(l) &&
        /^[\p{L}][\p{L}\p{M}'’.\-]+(?:\s+[\p{L}][\p{L}\p{M}'’.\-]+)+$/u.test(l)
      );
    }) || "";

  if (!candidate) return { firstName: "", lastName: "" };
  const parts = candidate.split(/\s+/);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" "),
  };
}

function parseEducation(lines: string[]): EducationItem[] {
  if (!lines.length) return [];
  const blocks = chunkByBlankOrYear(lines);
  const items: EducationItem[] = [];

  for (const block of blocks) {
    const joined = block.join(" ");
    const years = extractYears(joined);
    const schoolLine =
      block.find((l) =>
        /(university|üniversite|college|okul|lise|school|institute|fakülte|academy)/i.test(l),
      ) || block[0] || "";
    const degreeLine =
      block.find(
        (l) =>
          l !== schoolLine &&
          /(bachelor|master|phd|lisans|yüksek\s*lisans|associate|b\.?s\.?|m\.?s\.?|mühendis|mezun)/i.test(
            l,
          ),
      ) ||
      block[1] ||
      "";

    items.push({
      id: createId(),
      school: schoolLine.replace(YEAR_RANGE, "").trim(),
      degree: degreeLine.replace(YEAR_RANGE, "").trim(),
      startYear: years.startYear,
      endYear: years.endYear,
    });
  }

  return items.filter((i) => i.school || i.degree);
}

function parseExperience(lines: string[]): ExperienceItem[] {
  if (!lines.length) return [];
  const blocks = chunkByBlankOrYear(lines);
  const items: ExperienceItem[] = [];

  for (const block of blocks) {
    const joined = block.join(" ");
    const years = extractYears(joined);
    const titleLine = block[0] || "";
    const companyLine =
      block.find((l, idx) => idx > 0 && !YEAR_RANGE.test(l) && l.length < 80) || block[1] || "";

    let position = titleLine;
    let company = companyLine;

    const atSplit = titleLine.split(/\s+[@|]\s+|\s+[-–—]\s+/);
    if (atSplit.length >= 2 && !company) {
      position = atSplit[0].trim();
      company = atSplit.slice(1).join(" - ").trim();
    }

    const description = block
      .slice(2)
      .filter((l) => !YEAR_RANGE.test(l))
      .join("\n")
      .trim();

    items.push({
      id: createId(),
      company: company.replace(YEAR_RANGE, "").trim(),
      position: position.replace(YEAR_RANGE, "").trim(),
      startYear: years.startYear,
      endYear: years.endYear,
      description,
    });
  }

  return items.filter((i) => i.company || i.position || i.description);
}

function chunkByBlankOrYear(lines: string[]): string[][] {
  const blocks: string[][] = [];
  let current: string[] = [];

  for (const line of lines) {
    const startsNew =
      current.length > 0 &&
      (YEAR_RANGE.test(line) ||
        (/^[A-ZÇĞİÖŞÜ][\wÇĞİÖŞÜçğıöşü &/.-]{2,40}$/.test(line) && current.length >= 2));

    if (startsNew) {
      blocks.push(current);
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length) blocks.push(current);
  return blocks;
}

function joinSection(lines: string[]): string {
  return lines.join("\n").trim();
}

function findLabeledValue(lines: string[], labels: RegExp): string {
  for (const line of lines) {
    const m = line.match(new RegExp(`(?:${labels.source})\\s*[:：-]\\s*(.+)`, "i"));
    if (m?.[1]) return m[1].trim();
  }
  return "";
}

function parseBirthDate(value: string): string {
  const iso = value.match(/((?:19|20)\d{2})[./-](\d{1,2})[./-](\d{1,2})/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }
  const dmy = value.match(/(\d{1,2})[./-](\d{1,2})[./-]((?:19|20)\d{2})/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }
  return value.trim();
}

/** Open-source / offline CV text → structured CVData parser (no cloud AI). */
export function parseResumeText(rawText: string): CVData {
  const text = rawText.replace(/\u0000/g, "").trim();
  if (text.length < 20) {
    throw new Error("CV metni çok kısa veya boş.");
  }

  const lines = normalizeLines(text);
  const sections = splitSections(lines);
  const headerAndPersonal = [...sections.header, ...sections.personal];
  const allTop = headerAndPersonal.join("\n");

  const email = allTop.match(EMAIL_RE)?.[0] || text.match(EMAIL_RE)?.[0] || "";
  const phone = (allTop.match(PHONE_RE)?.[0] || text.match(PHONE_RE)?.[0] || "").trim();
  const linkedIn = allTop.match(LINKEDIN_RE)?.[0] || text.match(LINKEDIN_RE)?.[0] || "";
  const portfolio =
    headerAndPersonal
      .map((l) => l.match(URL_RE)?.[0] || "")
      .find((u) => u && !/linkedin\.com/i.test(u)) || "";

  const { firstName, lastName } = parseName(headerAndPersonal);
  const nationality = findLabeledValue(headerAndPersonal, /nationality|uyruk|uyruğu/);
  const address =
    findLabeledValue(headerAndPersonal, /address|adres/) ||
    headerAndPersonal.find(
      (l) =>
        !EMAIL_RE.test(l) &&
        !PHONE_RE.test(l) &&
        !LINKEDIN_RE.test(l) &&
        /(street|cad\.|sok\.|mah\.|avenue|district|istanbul|ankara|izmir|turkey|türkiye)/i.test(l),
    ) ||
    "";
  const postCode =
    findLabeledValue(headerAndPersonal, /post\s*code|posta\s*kodu|zip/) ||
    address.match(POSTCODE_RE)?.[0] ||
    "";
  const birthRaw = findLabeledValue(
    headerAndPersonal,
    /date\s*of\s*birth|doğum\s*tarihi|birthday|born/,
  );
  const birthDate = birthRaw ? parseBirthDate(birthRaw) : "";

  const education = parseEducation(sections.education);
  const experience = parseExperience(sections.experience);

  const skillsBlob = joinSection(sections.skills);
  const languages =
    joinSection(sections.languages) ||
    findLabeledValue(sections.skills, /languages|diller/) ||
    "";
  const software =
    joinSection(sections.software) ||
    findLabeledValue(sections.skills, /software|programming|yazılım|programlama/) ||
    skillsBlob;
  const tools =
    joinSection(sections.tools) ||
    findLabeledValue(sections.skills, /tools|programs|araçlar|programlar/) ||
    "";
  const hobbies = joinSection(sections.hobbies);
  const summary = joinSection(sections.summary);

  const cv = createEmptyCV();
  cv.personal = {
    ...cv.personal,
    firstName,
    lastName,
    email,
    phone,
    address,
    nationality,
    postCode,
    linkedIn,
    portfolio,
    birthDate,
  };
  cv.summary = summary;
  cv.education = education.length ? education : cv.education;
  cv.experience = experience.length ? experience : cv.experience;
  cv.skills = {
    languages,
    softwareLanguages: software,
    computerPrograms: tools,
    hobbies,
  };

  const hasSignal =
    Boolean(firstName || email || phone) ||
    education.some((e) => e.school || e.degree) ||
    experience.some((e) => e.company || e.position) ||
    Boolean(skillsBlob || summary);

  if (!hasSignal) {
    throw new Error(
      "CV alanları çıkarılamadı. Daha düzenli başlıklı (Education / Experience / Skills) bir dosya dene.",
    );
  }

  return cv;
}
