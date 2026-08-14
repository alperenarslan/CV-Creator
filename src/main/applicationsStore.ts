import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import { createId } from "../shared/cv";
import {
  APPLICATION_STATUSES,
  defaultFollowUpDate,
  type JobApplication,
  type ListingFetchStatus,
  type UpdateApplicationPatch,
  type UpsertApplicationInput,
} from "../shared/tracker";
import { deleteCvSnapshot, hasCvSnapshot } from "./snapshotStore";

function filePath(): string {
  return path.join(app.getPath("userData"), "applications.json");
}

const FETCH_STATUSES: ListingFetchStatus[] = [
  "pending",
  "fetching",
  "ready",
  "blocked",
  "error",
];

function normalizeStatus(value: unknown): JobApplication["status"] {
  const s = String(value ?? "saved");
  return (APPLICATION_STATUSES as string[]).includes(s)
    ? (s as JobApplication["status"])
    : "saved";
}

function normalizeCategories(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const list = raw
    .map(String)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8);
  return list.length ? list : undefined;
}

function normalizeFetchStatus(raw: unknown): ListingFetchStatus | undefined {
  return FETCH_STATUSES.includes(raw as ListingFetchStatus)
    ? (raw as ListingFetchStatus)
    : undefined;
}

function normalizeApp(raw: Partial<JobApplication>): JobApplication | null {
  if (!raw.url?.trim()) return null;
  const now = new Date().toISOString();
  const id = raw.id || createId();
  return {
    id,
    url: raw.url.trim(),
    jobTitle: String(raw.jobTitle ?? ""),
    company: String(raw.company ?? ""),
    matchScore: Number.isFinite(Number(raw.matchScore))
      ? Math.max(0, Math.min(100, Math.round(Number(raw.matchScore))))
      : 0,
    status: normalizeStatus(raw.status),
    summary: String(raw.summary ?? ""),
    strengths: Array.isArray(raw.strengths) ? raw.strengths.map(String) : [],
    missingKeywords: Array.isArray(raw.missingKeywords)
      ? raw.missingKeywords.map(String)
      : [],
    notes: String(raw.notes ?? ""),
    analyzedAt: raw.analyzedAt || now,
    updatedAt: raw.updatedAt || now,
    appliedAt: raw.appliedAt || undefined,
    followUpAt: raw.followUpAt || undefined,
    coverLetter: raw.coverLetter || undefined,
    coverSubject: raw.coverSubject || undefined,
    hasSnapshot: Boolean(raw.hasSnapshot) || hasCvSnapshot(id),
    packageFolder: raw.packageFolder || undefined,
    interviewTips: Array.isArray(raw.interviewTips)
      ? raw.interviewTips.map(String)
      : undefined,
    interviewAt: raw.interviewAt || undefined,
    rejectionNote: raw.rejectionNote || undefined,
    learnedKeywords: Array.isArray(raw.learnedKeywords)
      ? raw.learnedKeywords.map(String)
      : undefined,
    categories: normalizeCategories(raw.categories),
    fetchStatus: normalizeFetchStatus(raw.fetchStatus),
    fetchError: raw.fetchError ? String(raw.fetchError) : undefined,
  };
}

export function loadApplications(): JobApplication[] {
  try {
    if (!fs.existsSync(filePath())) return [];
    const raw = JSON.parse(fs.readFileSync(filePath(), "utf8")) as unknown;
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => normalizeApp(item as Partial<JobApplication>))
      .filter((item): item is JobApplication => Boolean(item))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

function saveApplications(apps: JobApplication[]): void {
  fs.mkdirSync(path.dirname(filePath()), { recursive: true });
  const sorted = [...apps].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  fs.writeFileSync(filePath(), JSON.stringify(sorted, null, 2), "utf8");
}

function sameUrl(a: string, b: string): boolean {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    return (
      ua.href.replace(/\/$/, "").toLowerCase() === ub.href.replace(/\/$/, "").toLowerCase()
    );
  } catch {
    return a.trim().toLowerCase() === b.trim().toLowerCase();
  }
}

/** Create or refresh an application from a job analysis. */
export function upsertFromAnalysis(input: UpsertApplicationInput): JobApplication {
  const apps = loadApplications();
  const now = new Date().toISOString();
  const existing = apps.find((a) => sameUrl(a.url, input.url));
  const categories = normalizeCategories(input.categories);

  if (existing) {
    const next: JobApplication = {
      ...existing,
      url: input.url.trim() || existing.url,
      jobTitle: input.jobTitle || existing.jobTitle,
      company: input.company || existing.company,
      matchScore: input.matchScore,
      summary: input.summary || existing.summary,
      strengths: input.strengths,
      missingKeywords: input.missingKeywords,
      interviewTips: input.interviewTips?.length ? input.interviewTips : existing.interviewTips,
      categories: categories?.length ? categories : existing.categories,
      fetchStatus: "ready",
      fetchError: undefined,
      analyzedAt: now,
      updatedAt: now,
      hasSnapshot: existing.hasSnapshot || hasCvSnapshot(existing.id),
    };
    saveApplications(apps.map((a) => (a.id === existing.id ? next : a)));
    return next;
  }

  const created: JobApplication = {
    id: createId(),
    url: input.url.trim(),
    jobTitle: input.jobTitle,
    company: input.company,
    matchScore: input.matchScore,
    status: "saved",
    summary: input.summary,
    strengths: input.strengths,
    missingKeywords: input.missingKeywords,
    notes: "",
    analyzedAt: now,
    updatedAt: now,
    interviewTips: input.interviewTips,
    categories,
    fetchStatus: "ready",
  };
  saveApplications([created, ...apps]);
  return created;
}

export function updateApplication(patch: UpdateApplicationPatch): JobApplication | null {
  const apps = loadApplications();
  const idx = apps.findIndex((a) => a.id === patch.id);
  if (idx === -1) return null;

  const current = apps[idx];
  const now = new Date().toISOString();
  let appliedAt = current.appliedAt;
  if (patch.appliedAt === null) appliedAt = undefined;
  else if (typeof patch.appliedAt === "string") appliedAt = patch.appliedAt;

  let followUpAt = current.followUpAt;
  if (patch.followUpAt === null) followUpAt = undefined;
  else if (typeof patch.followUpAt === "string") followUpAt = patch.followUpAt;

  if (patch.status === "applied" && !appliedAt) {
    appliedAt = now.slice(0, 10);
  }

  if (
    (patch.status === "applied" || (!patch.status && current.status === "applied" && patch.appliedAt)) &&
    !followUpAt &&
    patch.followUpAt !== null
  ) {
    followUpAt = defaultFollowUpDate(appliedAt || now);
  }

  let coverLetter = current.coverLetter;
  if (patch.coverLetter === null) coverLetter = undefined;
  else if (typeof patch.coverLetter === "string") coverLetter = patch.coverLetter;

  let coverSubject = current.coverSubject;
  if (patch.coverSubject === null) coverSubject = undefined;
  else if (typeof patch.coverSubject === "string") coverSubject = patch.coverSubject;

  let packageFolder = current.packageFolder;
  if (patch.packageFolder === null) packageFolder = undefined;
  else if (typeof patch.packageFolder === "string") packageFolder = patch.packageFolder;

  let interviewAt = current.interviewAt;
  if (patch.interviewAt === null) interviewAt = undefined;
  else if (typeof patch.interviewAt === "string") interviewAt = patch.interviewAt;

  if (patch.status === "interviewing" && !interviewAt && patch.interviewAt !== null) {
    interviewAt = now.slice(0, 10);
  }

  let rejectionNote = current.rejectionNote;
  if (patch.rejectionNote === null) rejectionNote = undefined;
  else if (typeof patch.rejectionNote === "string") rejectionNote = patch.rejectionNote;

  let learnedKeywords = current.learnedKeywords;
  if (patch.learnedKeywords === null) learnedKeywords = undefined;
  else if (Array.isArray(patch.learnedKeywords)) learnedKeywords = patch.learnedKeywords;

  let categories = current.categories;
  if ("categories" in patch) {
    categories = patch.categories?.length
      ? patch.categories.map(String).map((s) => s.trim()).filter(Boolean).slice(0, 8)
      : undefined;
  }

  let fetchStatus = current.fetchStatus;
  if (patch.fetchStatus) fetchStatus = patch.fetchStatus;

  let fetchError = current.fetchError;
  if ("fetchError" in patch) {
    fetchError = patch.fetchError ? String(patch.fetchError) : undefined;
  }

  const next: JobApplication = {
    ...current,
    status: patch.status ?? current.status,
    notes: patch.notes ?? current.notes,
    jobTitle: patch.jobTitle ?? current.jobTitle,
    company: patch.company ?? current.company,
    summary: patch.summary ?? current.summary,
    matchScore:
      typeof patch.matchScore === "number"
        ? Math.max(0, Math.min(100, Math.round(patch.matchScore)))
        : current.matchScore,
    appliedAt,
    followUpAt,
    interviewAt,
    coverLetter,
    coverSubject,
    hasSnapshot: patch.hasSnapshot ?? current.hasSnapshot,
    packageFolder,
    rejectionNote,
    learnedKeywords,
    categories,
    fetchStatus,
    fetchError,
    updatedAt: now,
  };

  apps[idx] = next;
  saveApplications(apps);
  return next;
}

/** Create a lightweight listing row from URL (no CV match yet). */
export function createListingFromUrl(url: string): JobApplication {
  const apps = loadApplications();
  const trimmed = url.trim();
  const existing = apps.find((a) => sameUrl(a.url, trimmed));
  if (existing) return existing;

  const now = new Date().toISOString();
  let host = "ilan";
  try {
    host = new URL(trimmed).hostname.replace(/^www\./, "");
  } catch {
    /* keep */
  }

  const created: JobApplication = {
    id: createId(),
    url: trimmed,
    jobTitle: host,
    company: "",
    matchScore: 0,
    status: "saved",
    summary: "",
    strengths: [],
    missingKeywords: [],
    notes: "",
    analyzedAt: now,
    updatedAt: now,
    fetchStatus: "pending",
  };
  saveApplications([created, ...apps]);
  return created;
}

export function deleteApplication(id: string): boolean {
  const apps = loadApplications();
  const next = apps.filter((a) => a.id !== id);
  if (next.length === apps.length) return false;
  deleteCvSnapshot(id);
  saveApplications(next);
  return true;
}
