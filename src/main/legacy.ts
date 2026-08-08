import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { LegacyLaunchResult } from "../shared/ipc";

function projectRoot(): string {
  // dist-electron/main -> project root
  return path.resolve(__dirname, "../../..");
}

export function getLegacyDir(): string {
  return path.join(projectRoot(), "legacy");
}

export async function launchLegacyApp(): Promise<LegacyLaunchResult> {
  const dir = getLegacyDir();
  const gui = path.join(dir, "CV_GUI.java");
  const variables = path.join(dir, "Variables.java");

  if (!fs.existsSync(gui) || !fs.existsSync(variables)) {
    return { ok: false, error: "Legacy kaynakları bulunamadı (legacy/ klasörü)." };
  }

  const javaHome = process.env.JAVA_HOME;
  const javaBin = javaHome
    ? path.join(javaHome, "bin", process.platform === "win32" ? "java.exe" : "java")
    : process.platform === "win32"
      ? "java.exe"
      : "java";
  const javacBin = javaHome
    ? path.join(javaHome, "bin", process.platform === "win32" ? "javac.exe" : "javac")
    : process.platform === "win32"
      ? "javac.exe"
      : "javac";

  try {
    await run(javacBin, ["Variables.java", "CV_GUI.java"], dir);
    spawn(javaBin, ["CV_GUI"], {
      cwd: dir,
      detached: true,
      stdio: "ignore",
      shell: process.platform === "win32",
    }).unref();
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Java bulunamadı veya legacy uygulama derlenemedi. JDK kurulu olduğundan emin ol.",
    };
  }
}

function run(cmd: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, shell: process.platform === "win32" });
    let stderr = "";
    child.stderr.on("data", (d) => {
      stderr += String(d);
    });
    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr || `${cmd} exit ${code}`));
    });
  });
}
