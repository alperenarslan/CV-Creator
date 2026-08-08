/** In-memory Gemini API key for the current app session only. Cleared on quit. */

let sessionApiKey: string | undefined;

export function setSessionGeminiApiKey(key: string): void {
  const trimmed = key.trim();
  sessionApiKey = trimmed || undefined;
}

export function getSessionGeminiApiKey(): string | undefined {
  return sessionApiKey;
}

export function clearSessionGeminiApiKey(): void {
  sessionApiKey = undefined;
}

export function hasSessionGeminiApiKey(): boolean {
  return Boolean(sessionApiKey?.trim());
}
