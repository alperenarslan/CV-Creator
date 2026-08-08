const MAX_BYTES = 1_500_000;
const MAX_REDIRECTS = 4;
const TIMEOUT_MS = 15_000;

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export interface FetchJobResult {
  ok: boolean;
  text?: string;
  error?: string;
  blocked?: boolean;
}

async function fetchOnce(url: string, redirectsLeft: number): Promise<FetchJobResult> {
  if (!isHttpUrl(url)) {
    return { ok: false, error: "Geçersiz URL. Sadece http/https desteklenir." };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      redirect: "manual",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,tr;q=0.8",
      },
    });

    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const loc = res.headers.get("location");
      if (!loc || redirectsLeft <= 0) {
        return { ok: false, error: "Çok fazla yönlendirme." };
      }
      const next = new URL(loc, url).toString();
      return fetchOnce(next, redirectsLeft - 1);
    }

    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        blocked: true,
        error:
          "Bu sayfa korumalı görünüyor (giriş / bot engeli). İş ilanı metnini yapıştırarak devam edebilirsin.",
      };
    }

    if (!res.ok) {
      return { ok: false, error: `Sayfa alınamadı (HTTP ${res.status}).` };
    }

    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) {
      return { ok: false, error: "Sayfa çok büyük." };
    }

    const html = new TextDecoder("utf-8").decode(buf);
    const text = stripHtml(html);

    if (text.length < 80) {
      return {
        ok: false,
        blocked: true,
        error:
          "Sayfadan yeterli metin çıkarılamadı. LinkedIn gibi sitelerde giriş gerekebilir; ilan metnini yapıştır.",
      };
    }

    const lowered = text.toLowerCase();
    if (
      lowered.includes("sign in") &&
      lowered.includes("linkedin") &&
      text.length < 400
    ) {
      return {
        ok: false,
        blocked: true,
        error: "LinkedIn giriş sayfası döndü. İlan metnini yapıştırarak devam et.",
      };
    }

    return { ok: true, text: text.slice(0, 40_000) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("abort")) {
      return { ok: false, error: "İstek zaman aşımına uğradı." };
    }
    return { ok: false, error: `URL okunamadı: ${message}` };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJobText(url: string): Promise<FetchJobResult> {
  return fetchOnce(url.trim(), MAX_REDIRECTS);
}
