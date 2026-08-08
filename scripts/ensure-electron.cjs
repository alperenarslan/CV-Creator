/**
 * Fallback Electron binary installer for environments where
 * npm's HTTPS download of Electron fails (TLS/proxy issues).
 */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const electronDir = path.join(__dirname, "..", "node_modules", "electron");
const distExe = path.join(
  electronDir,
  "dist",
  process.platform === "win32" ? "electron.exe" : "electron",
);

if (fs.existsSync(distExe)) {
  process.exit(0);
}

if (!fs.existsSync(electronDir)) {
  console.warn("[ensure-electron] electron package missing; skip");
  process.exit(0);
}

console.log("[ensure-electron] Electron binary missing, running install.js …");
const result = spawnSync(process.execPath, [path.join(electronDir, "install.js")], {
  stdio: "inherit",
  env: process.env,
});

if (result.status === 0 && fs.existsSync(distExe)) {
  process.exit(0);
}

if (process.platform !== "win32") {
  console.error("[ensure-electron] Automatic fallback is Windows-oriented. Install Electron manually.");
  process.exit(result.status || 1);
}

const pkg = JSON.parse(fs.readFileSync(path.join(electronDir, "package.json"), "utf8"));
const ver = pkg.version;
const zipName = `electron-v${ver}-win32-x64.zip`;
const url = `https://github.com/electron/electron/releases/download/v${ver}/${zipName}`;
const zipPath = path.join(os.tmpdir(), zipName);
const cache = path.join(process.env.LOCALAPPDATA || os.tmpdir(), "electron", "Cache");

fs.mkdirSync(cache, { recursive: true });
console.log(`[ensure-electron] Downloading ${url}`);
const curl = spawnSync(
  "curl.exe",
  ["-L", "--retry", "3", "--retry-all-errors", "-o", zipPath, url],
  { stdio: "inherit" },
);
if (curl.status !== 0) process.exit(curl.status || 1);

fs.copyFileSync(zipPath, path.join(cache, zipName));
const retry = spawnSync(process.execPath, [path.join(electronDir, "install.js")], {
  stdio: "inherit",
  env: { ...process.env, electron_config_cache: cache },
});
process.exit(retry.status === 0 && fs.existsSync(distExe) ? 0 : retry.status || 1);
