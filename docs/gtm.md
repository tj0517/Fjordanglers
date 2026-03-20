# FjordAnglers — Go-To-Market Strategy

> Aktualizacja: 2026-03-20

---

## Przegląd

Dwustronny marketplace → fokus najpierw na **supply** (przewodnicy), potem SEO napędza **demand** (wędkarze).

---

## Faza 1 — Pre-Launch (teraz)

**Cel:** 15–20 profili przewodników gotowych przed soft launch.

**Jak:**
- Instagram DM outreach do skandynawskich przewodników wędkarskich
- Potwierdzony wskaźnik odpowiedzi: **50%+**
- Manualny onboarding przez admina — brak self-serve signup
- Oferta: Founding Guide deal (8% komisji przez pierwsze 24 miesiące)

**Kluczowa metryka:** Liczba opublikowanych profili przewodników

---

## Faza 2 — Soft Launch

**Cel:** Pierwsze organiczne wejścia, pierwsze bookings/zapytania.

**Jak:**
- SEO-zoptymalizowane profile przewodników idą live
- Light paid ads (Instagram/Meta) targetujące polskich/niemieckich wędkarzy
- Content: License Map opublikowana (targets high-intent keywords)

**Kluczowa metryka:** Tygodniowy trend organicznego ruchu (GSC)

---

## Faza 3 — Full Launch

**Cel:** Skalowanie supply i demand, rozszerzenie języków.

**Jak:**
- Niemieckie i polskie landing pages
- Szersza płatna akwizycja
- PR / partnerstwa z mediami wędkarskimi

---

## SEO Flywheel (główny kanał demand)

Podstawowy kanał akwizycji popytu to **organiczne wyszukiwanie**.

### Target Keywords
- `fishing guide Norway` / `fishing guide Sweden`
- `salmon fishing guide Scandinavia`
- `fishing license Norway tourist`
- `where to buy fishing license Norway`
- `pike fishing Sweden`
- `fly fishing guide Iceland`

### Strategia SEO
1. **Strony tripów** — unikalny content per trip, lokalizacja, gatunek (URL: `/trips/[slug]`)
2. **Profile przewodników** — unikalna strona per guide (URL: `/guides/[country]/[slug]`)
3. **License Map** — przechwytuje high-intent queries "jak legalnie łowić"
4. **Blog/Content** — species guides, opisy lokalizacji (post-MVP)

### Techniczne SEO
- `generateMetadata` z `title`, `description`, `openGraph.images` na każdej stronie
- `sitemap.ts` generuje wpisy dla wszystkich `published = true` tripów i profili
- Structured data (schema.org) dla tripów i przewodników
- Mobile-first rendering

---

## Social Media (Instagram)

**Zasada 80/20:**
- 80% wartościowy i inspirujący content (filmy wędkarskie, lokalizacje, porady)
- 20% promocja platformy

**Owner:** Łukasz (Head of Content)

**Outreach do przewodników:** Instagram DM z personalizowaną wiadomością + link do Founding Guide landing page.

---

## Priorytety contentu
1. **License Map** (SEO) — najwyższy priorytet
2. **Strony tripów** (SEO + konwersja)
3. **Profile przewodników** (SEO + trust)
4. **Instagram content** (brand awareness + guide outreach)
