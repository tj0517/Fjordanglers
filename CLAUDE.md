# FjordAnglers — Agent Context

## Projekt
Marketplace łączący skandynawskich przewodników wędkarskich z wędkarzami z Europy Środkowej.
Stack: Next.js 16 (App Router), Supabase, Stripe Connect, TypeScript, Tailwind CSS v4.
Środowisko: pnpm, Node 20+.

## Dokumentacja projektu (czytaj przed pracą)
- `docs/brand.md` — marka, kolory, typografia, tone of voice, logo
- `docs/business-model.md` — model biznesowy, komisja, Founding Guide
- `docs/mvp-scope.md` — co jest zbudowane, routing, architektura
- `docs/gtm.md` — go-to-market, SEO flywheel, social strategy
- `docs/trips-spec.md` — spec strony tripu, pakiety, pola DB

## Architektura
- `src/app/` — Next.js App Router; każda strona = folder z `page.tsx`
- `src/components/` — reużywalne komponenty UI
- `src/lib/supabase/` — client/server helpers, typy z `database.types.ts`
- `src/lib/stripe/` — Stripe Connect, webhook helpers
- `src/actions/` — Server Actions (nie REST API dla mutacji)
- `src/lib/env.ts` — wszystkie zmienne env przez Zod (nie importuj `process.env` bezpośrednio)

## Model biznesowy (aktualny)
Jeden model — komisja od transakcji:
- **Standard** — 10% (`PLATFORM_COMMISSION_RATE=0.10`)
- **Founding Guide** — 8% przez pierwsze 24 miesiące od rejestracji

`guides.plan` w DB: `'commission'` (główny) lub `'flat_fee'` (legacy/specjalne przypadki).

## Dwa typy użytkowników
- **Guide** → `src/app/dashboard/` — zarządza tripami, bookingami, kalendarzem, zapytaniami
- **Angler** → `src/app/account/` — widzi swoje rezerwacje, zapytania, czat

## Booking types (pole `experiences.booking_type`)
- `'direct'` — instant booking przez Stripe Elements (`/book/[expId]`)
- `'icelandic'` — tylko zapytania (`/trips/[id]/inquire` → GuideOfferForm → Stripe Checkout)
- `'both'` — oba dostępne

## Inquiry flow (status trip_inquiries)
```
inquiry → reviewing → offer_sent → offer_accepted → confirmed → completed
                                                  ↘ cancelled
```
Booking record tworzony automatycznie po `confirmed` przez `createBookingFromInquiry()`.

## Styl kodu
- TypeScript strict mode, NO `any`
- Komponenty: functional, named exports
- Server Components domyślnie; `"use client"` tylko gdy konieczne
- Supabase Row Level Security (RLS) zawsze włączone
- Zmienne środowiskowe: TYLKO przez `src/lib/env.ts`
- Nazewnictwo: camelCase zmienne, PascalCase komponenty, kebab-case pliki

## Typografia (ważne!)
- **DM Sans** — jedyna czcionka projektu
- `f-display` — nagłówki (font-weight bold)
- `f-body` — body text, labele, przyciski
- NIE używaj `font-sans` ani `Inter`

## Kolory brandowe
- **Fjord Blue:** `#0A2E4D` (dark) / CSS token `#1B4F72`
- **Salmon Orange:** `#E67E50` (brand) / CSS token `#E67E22`
- **Ice White:** `#F8FAFB`
- Inline style zawsze z `#0A2E4D`/`#E67E50`; Tailwind klasy z tokenami

## Logo assets (`public/brand/`)
- `white-logo.png` — na ciemne tła
- `dark-logo.png` — na jasne tła
- `sygnet.png` — ikona/favicon

## Zespół
- **Tymon** (CEO, dev): Next.js/Supabase/Stripe
- **Łukasz**: content, Instagram, visual identity
- **Krzychu**: fishing knowledge, weryfikacja przewodników, License Map data

## Workflow
- Zawsze `pnpm typecheck` po serii zmian — musi być 0 błędów
- Testy: Vitest (`pnpm test`), E2E: Playwright (`pnpm test:e2e`)
- Branches: `feature/`, `fix/`, `chore/` → PR do `main`; preview: `preview/main`
- Nie modyfikuj istniejących migracji Supabase — twórz nowe

## Zakazy
- Nie używaj `require()` — tylko ES modules
- Nie edytuj `.env.local` — napisz jakie zmienne dodać
- Nie commituj sekretów
- Nie używaj `pages/` router — tylko `app/`
- Nie twórz nowych migracji bez konsultacji
- Nie używaj `any` w TypeScript
