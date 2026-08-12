import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import type { CVData } from "../shared/cv";

function snapshotsDir(): string {
  return path.join(app.getPath("userData"), "cv-snapshots");
}

function snapshotPath(applicationId: string): string {
  const safe = applicationId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(snapshotsDir(), `${safe}.json`);
}

export function saveCvSnapshot(applicationId: string, cv: CVData): { ok: true; path: string } {
  const dir = snapshotsDir();
  fs.mkdirSync(dir, { recursive: true });
  const file = snapshotPath(applicationId);
  const payload = {
    applicationId,
    savedAt: new Date().toISOString(),
    cv,
  };
  fs.writeFileSync(file, JSON.stringify(payload, null, 2), "utf8");
  return { ok: true, path: file };
}

export function loadCvSnapshot(applicationId: string): CVData | null {
  try {
    const file = snapshotPath(applicationId);
    if (!fs.existsSync(file)) return null;
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as { cv?: CVData };
    return raw.cv ?? null;
  } catch {
    return null;
  }
}

export function hasCvSnapshot(applicationId: string): boolean {
  return fs.existsSync(snapshotPath(applicationId));
}

export function deleteCvSnapshot(applicationId: string): void {
  try {
    const file = snapshotPath(applicationId);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch {
    /* ignore */
  }
}
