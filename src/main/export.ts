import { BrowserWindow, dialog } from "electron";
import fs from "node:fs/promises";
import { fullName, type CVData } from "../shared/cv";
import { cvToHtml } from "../shared/cvHtml";
import type { ExportResult } from "../shared/ipc";
import { loadPrefs } from "./store";

export function cvToTxt(cv: CVData): string {
  const p = cv.personal;
  const lines: string[] = [];
  lines.push("******Personal Information******");
  lines.push(`Name : ${p.firstName}\tSurname : ${p.lastName}`);
  lines.push(`Nationality : ${p.nationality}`);
  lines.push(`Address : ${p.address}`);
  lines.push(`Date of Birth : ${p.birthDate}`);
  lines.push(`Number : ${p.phone}`);
  lines.push(`e-mail : ${p.email}`);
  lines.push(`Post Code : ${p.postCode}`);
  if (p.linkedIn) lines.push(`LinkedIn : ${p.linkedIn}`);
  if (p.portfolio) lines.push(`Portfolio : ${p.portfolio}`);
  if (cv.summary) {
    lines.push("");
    lines.push("******Summary******");
    lines.push(cv.summary);
  }
  lines.push("");
  lines.push("*********Education Information*************");
  for (const e of cv.education) {
    lines.push(
      `${e.degree || "Education"} : ${e.school}\t Year : ${e.startYear} - ${e.endYear}`,
    );
  }
  lines.push("");
  lines.push("**********Skills**********************");
  lines.push(`Languages : ${cv.skills.languages}`);
  lines.push(`Software Languages : ${cv.skills.softwareLanguages}`);
  lines.push(`Hobbies : ${cv.skills.hobbies}`);
  lines.push(`Computer Programs : ${cv.skills.computerPrograms}`);
  lines.push("");
  lines.push("*********Work Experiences************");
  cv.experience.forEach((ex, i) => {
    lines.push(`${i + 1}-Company Name : ${ex.company}`);
    lines.push(`\tYear : ${ex.startYear} - ${ex.endYear}`);
    lines.push(`\tPosition : ${ex.position}`);
    if (ex.description) lines.push(`\t${ex.description}`);
  });
  return lines.join("\r\n");
}

async function pickSavePath(
  window: BrowserWindow,
  defaultName: string,
  filters: Electron.FileFilter[],
): Promise<string | undefined> {
  const result = await dialog.showSaveDialog(window, {
    defaultPath: defaultName,
    filters,
  });
  if (result.canceled || !result.filePath) return undefined;
  return result.filePath;
}

function htmlForExport(cv: CVData): string {
  return cvToHtml(cv, loadPrefs().locale);
}

export async function exportTxt(window: BrowserWindow, cv: CVData): Promise<ExportResult> {
  try {
    const filePath = await pickSavePath(window, `${fullName(cv)} Cv.txt`, [
      { name: "Text", extensions: ["txt"] },
    ]);
    if (!filePath) return { ok: false, canceled: true };
    await fs.writeFile(filePath, cvToTxt(cv), "utf8");
    return { ok: true, filePath };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function exportHtml(window: BrowserWindow, cv: CVData): Promise<ExportResult> {
  try {
    const filePath = await pickSavePath(window, `${fullName(cv)}_Cv.html`, [
      { name: "HTML", extensions: ["html"] },
    ]);
    if (!filePath) return { ok: false, canceled: true };
    await fs.writeFile(filePath, htmlForExport(cv), "utf8");
    return { ok: true, filePath };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function exportPdf(window: BrowserWindow, cv: CVData): Promise<ExportResult> {
  try {
    const filePath = await pickSavePath(window, `${fullName(cv)}_Cv.pdf`, [
      { name: "PDF", extensions: ["pdf"] },
    ]);
    if (!filePath) return { ok: false, canceled: true };

    const html = htmlForExport(cv);
    const printWin = new BrowserWindow({
      show: false,
      webPreferences: { offscreen: true },
    });
    await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const pdf = await printWin.webContents.printToPDF({
      printBackground: true,
      pageSize: "A4",
    });
    await fs.writeFile(filePath, pdf);
    printWin.destroy();
    return { ok: true, filePath };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
