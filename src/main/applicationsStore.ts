import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import { createId } from "../shared/cv";
import {
  APPLICATION_STATUSES,
  type JobApplication,
  type UpdateApplicationPatch,
  type UpsertApplicationInput,
} from "../shared/tracker";

function filePath(): string {
  return path.join(app.getPath("userData"), "applications.json");
}

function normalizeStatus(value: unknown): JobApplication["status"] {
  const s = String(value ?? "saved");
  return (APPLICATION_STATUSES as string[]).includes(s)
    ? (s as JobApplication["status"])
    : "saved";
}

function normalizeApp(raw: Partial<JobApplication>): JobApplication | null {
  if (!raw.url?.trim()) return null;
  const now = new Date().toISOString();
  return {
    id: raw.id || createId(),
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
      analyzedAt: now,
      updatedAt: now,
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

  if (patch.status === "applied" && !appliedAt) {
    appliedAt = now.slice(0, 10);
  }

  const next: JobApplication = {
    ...current,
    status: patch.status ?? current.status,
    notes: patch.notes ?? current.notes,
    jobTitle: patch.jobTitle ?? current.jobTitle,
    company: patch.company ?? current.company,
    appliedAt,
    updatedAt: now,
  };

  apps[idx] = next;
  saveApplications(apps);
  return next;
}

export function deleteApplication(id: string): boolean {
  const apps = loadApplications();
  const next = apps.filter((a) => a.id !== id);
  if (next.length === apps.length) return false;
  saveApplications(next);
  return true;
}
