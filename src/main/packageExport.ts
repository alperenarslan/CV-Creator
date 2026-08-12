import { BrowserWindow, dialog, shell } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import { fullName, type CVData } from "../shared/cv";
import { cvToHtml } from "../shared/cvHtml";
import { formatAtsChecklist, runAtsCheck } from "../shared/ats";
import type { JobAnalysis } from "../shared/analysis";
import type { AppLocale } from "../shared/prefs";
import { loadPrefs } from "./store";
import { cvToTxt } from "./export";

export interface PackageExportRequest {
  cv: CVData;
  analysis: JobAnalysis;
  coverLetter?: string;
  coverSubject?: string;
  applicationId?: string;
  includePdf?: boolean;
}

export interface PackageExportResult {
  ok: boolean;
  folderPath?: string;
  error?: string;
  canceled?: boolean;
}

function slugPart(value: string, fallback: string): string {
  const cleaned = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return cleaned || fallback;
}

function packageFolderName(cv: CVData, analysis: JobAnalysis): string {
  const date = new Date().toISOString().slice(0, 10);
  const company = slugPart(analysis.companyGuess || "Company", "Company");
  const role = slugPart(analysis.jobTitle || "Role", "Role");
  return `${date}_${company}_${role}`;
}

function fileBase(cv: CVData, analysis: JobAnalysis): string {
  const person = slugPart(fullName(cv) || "CV", "CV");
  const company = slugPart(analysis.companyGuess || "Company", "Company");
  return `${person}_${company}`;
}

async function writePdf(html: string, outPath: string): Promise<void> {
  const printWin = new BrowserWindow({
    show: false,
    webPreferences: { offscreen: true },
  });
  try {
    await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const pdf = await printWin.webContents.printToPDF({
      printBackground: true,
      pageSize: "A4",
    });
    await fs.writeFile(outPath, pdf);
  } finally {
    printWin.destroy();
  }
}

export async function exportApplicationPackage(
  window: BrowserWindow,
  req: PackageExportRequest,
): Promise<PackageExportResult> {
  try {
    const prefs = loadPrefs();
    const locale = prefs.locale as AppLocale;
    const pick = await dialog.showOpenDialog(window, {
      title: locale === "tr" ? "Başvuru paketi klasörü seç" : "Choose package folder",
      properties: ["openDirectory", "createDirectory"],
    });
    if (pick.canceled || !pick.filePaths[0]) return { ok: false, canceled: true };

    const root = path.join(pick.filePaths[0], packageFolderName(req.cv, req.analysis));
    await fs.mkdir(root, { recursive: true });
    const base = fileBase(req.cv, req.analysis);
    const html = cvToHtml(req.cv, locale);

    await fs.writeFile(path.join(root, `${base}_CV.html`), html, "utf8");
    await fs.writeFile(path.join(root, `${base}_CV.txt`), cvToTxt(req.cv), "utf8");

    if (req.includePdf !== false) {
      try {
        await writePdf(html, path.join(root, `${base}_CV.pdf`));
      } catch {
        /* PDF optional if print fails */
      }
    }

    if (req.coverLetter?.trim()) {
      const subject = req.coverSubject?.trim() || req.analysis.jobTitle;
      const letter = `Subject: ${subject}\n\n${req.coverLetter.trim()}\n`;
      await fs.writeFile(path.join(root, `${base}_CoverLetter.txt`), letter, "utf8");
    }

    const ats = runAtsCheck({
      cv: req.cv,
      missingKeywords: req.analysis.missingKeywords,
      locale,
    });
    await fs.writeFile(
      path.join(root, "ATS_Checklist.txt"),
      formatAtsChecklist(ats, locale),
      "utf8",
    );

    const summaryLines = [
      `Job: ${req.analysis.jobTitle}`,
      `Company: ${req.analysis.companyGuess || "—"}`,
      `Match score: ${req.analysis.matchScore}/100`,
      "",
      req.analysis.summary,
      "",
      "Strengths:",
      ...req.analysis.strengths.map((s) => `- ${s}`),
      "",
      "Must-haves:",
      ...(req.analysis.mustHaves || []).map((s) => `- ${s}`),
      "",
      "Nice-to-haves:",
      ...(req.analysis.niceToHaves || []).map((s) => `- ${s}`),
      "",
      "Fit:",
      ...(req.analysis.fitReasons || []).map((s) => `- ${s}`),
      "",
      "Risks:",
      ...(req.analysis.riskReasons || []).map((s) => `- ${s}`),
      "",
      "Missing keywords:",
      ...req.analysis.missingKeywords.map((s) => `- ${s}`),
      "",
      req.analysis.location ? `Location: ${req.analysis.location}` : "",
      "",
      req.analysis.interviewTips?.length
        ? ["Interview tips:", ...req.analysis.interviewTips.map((s) => `- ${s}`), ""].join("\n")
        : "",
      req.applicationId ? `Application id: ${req.applicationId}` : "",
      `Exported: ${new Date().toISOString()}`,
    ];
    await fs.writeFile(path.join(root, "Job_Summary.txt"), summaryLines.filter(Boolean).join("\n"), "utf8");

    await shell.openPath(root);
    return { ok: true, folderPath: root };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
