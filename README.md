# CV Creator v2 (Desktop)

Modern masaüstü CV oluşturucu. Gemini ile iş ilanı URL’sine göre CV eşleştirme / düzenleme önerileri; mevcut PDF/DOCX/TXT CV’den veri çekme; klasik 2020 Java uygulaması easter egg olarak durur.

## Özellikler

- Modern CV editörü (kişisel, eğitim, deneyim, beceriler, özet)
- Hazır CV içe aktarma (PDF/DOCX/TXT/HTML → `pdf-parse` + `mammoth` + yerel ayrıştırıcı; Gemini gerekmez)
- Canlı önizleme + otomatik yerel kayıt
- TXT / HTML / PDF dışa aktarma
- İş ilanı URL’sini okuyup Gemini ile match skoru, anahtar kelime analizi ve madde bazlı öneriler
- İş başvuru takibi: analiz edilen URL’ler skor ve durumla kaydedilir (başvuruldu / mülakat / teklif vb.)
- Classic 2020 easter egg (`Ctrl+Shift+L` veya logoya 5 tık)

## Gereksinimler

- Node.js 20+
- (Opsiyonel easter egg için) JDK 17+
- İş ilanı eşleştirme için Google Gemini API key (CV içe aktarma için gerekmez)

## Kurulum

```bash
npm install
copy .env.example .env
# İlan eşleştirme kullanacaksan .env içine GEMINI_API_KEY=... yaz
npm run dev
```

Windows’ta Electron indirmesi TLS hatası verirse `npm install --ignore-scripts` sonrası `node scripts/ensure-electron.cjs` çalıştır (curl ile GitHub’dan indirir).

Gemini key UI’dan girildiğinde yalnızca o oturumda bellekte tutulur; uygulama kapanınca silinir. İstersen `.env` ile de verebilirsin.

## Kullanım

1. Sol panellerden CV bilgilerini doldur veya **CV içe aktar** ile PDF/DOCX yükle.
2. Alttaki orb’a tıkla.
3. LinkedIn / kariyer sitesi iş ilanı URL’sini yapıştır ve analiz et.
4. Önerileri seçip CV’ye uygula.
5. TXT / HTML / PDF olarak dışa aktar.

> Not: LinkedIn gibi korumalı sayfalar bot engeli döndürebilir. Bu durumda panel, ilan metnini yapıştırman için yedek alan açar.

## Legacy (Classic 2020)

Orijinal Swing uygulaması [`legacy/`](legacy/) klasöründedir. Detay: [`legacy/README.md`](legacy/README.md).

## Mimari

- Electron + React + TypeScript + Vite + Tailwind
- CV import: `pdf-parse` (PDF), `mammoth` (DOCX), yerel section parser
- Job match: Gemini (`gemini-2.0-flash`) main process üzerinden
- Veri: `app.getPath('userData')/cv-data.json`

## Lisans

MIT
