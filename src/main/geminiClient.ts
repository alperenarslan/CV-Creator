import { GoogleGenerativeAI } from "@google/generative-ai";
import { getGeminiApiKey } from "./store";

/**
 * Stable / current flash models first.
 * Older 1.5 / 2.0 IDs are often 404 on newer API keys.
 */
const MODEL_CANDIDATES = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite",
  "gemini-2.0-flash",
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    /\b503\b/.test(message) ||
    /\b429\b/.test(message) ||
    /high demand/i.test(message) ||
    /unavailable/i.test(message) ||
    /try again later/i.test(message) ||
    /resource.?exhausted/i.test(message)
  );
}

function isModelMissing(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    /\b404\b/.test(message) ||
    /not found for API version/i.test(message) ||
    /is not found/i.test(message) ||
    /not supported for generateContent/i.test(message)
  );
}

export async function generateGeminiJson(
  parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }>,
  temperature = 0.3,
): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("Gemini API key is not set for this session.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  let lastError: unknown;

  for (const modelName of MODEL_CANDIDATES) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature,
            responseMimeType: "application/json",
          },
        });
        const result = await model.generateContent(parts);
        return result.response.text();
      } catch (err) {
        lastError = err;
        // Missing model → try next candidate immediately.
        if (isModelMissing(err)) break;
        if (isRetryable(err) && attempt === 0) {
          await sleep(900 + Math.floor(Math.random() * 600));
          continue;
        }
        break;
      }
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError);
  if (isRetryable(lastError)) {
    throw new Error(
      "Gemini şu an yoğun (503/429). Bu Google tarafındaki geçici yük; birkaç saniye sonra tekrar dene.",
    );
  }
  if (isModelMissing(lastError)) {
    throw new Error(
      "Kullanılabilir Gemini modeli bulunamadı. API anahtarını ve Google AI Studio’daki model erişimini kontrol et.",
    );
  }
  throw lastError instanceof Error ? lastError : new Error(message || "Gemini request failed.");
}
