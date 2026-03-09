# FjordAnglers — Agent Context

## Projekt
Marketplace łączący skandynawskich przewodników wędkarskich z wędkarzami z Europy Środkowej.
Stack: Next.js 16 (App Router), Supabase, Stripe Connect, TypeScript, Tailwind CSS v4.
Środowisko: pnpm, Node 20+.

## Dokumentacja projektu (czytaj przed pracą)
- `docs/brand.md` — marka, kolory, tone of voice, logo, fotografia
- `docs/business-model.md` — model biznesowy, pricing, tiers
- `docs/mvp-scope.md` — zakres MVP, must-have features, routing
- `docs/gtm.md` — go-to-market, SEO flywheel, social strategy

## Architektura
- `src/app/` — Next.js App Router, każda strona = folder z page.tsx
- `src/components/` — reużywalne komponenty (atomic design)
- `src/lib/supabase/` — client/server helpers, typy generowane z DB
- `src/lib/stripe/` — Stripe Connect, webhooks
- `src/actions/` — Server Actions (nie REST API dla mutacji)

## Model biznesowy
Dwa warianty dla przewodników:
1. **Listing** — €20/month (profil + formularz kontaktowy)
2. **Bookable** — 10% komisja (pełny flow rezerwacji + payouty)
3. **Founding Guide** — 3 miesiące free + 8% dożywotnio (pierwsze 50)

## Styl kodu
- TypeScript strict mode, NO `any`
- Komponenty: functional, named exports
- Server Components domyślnie, `"use client"` tylko gdy konieczne
- Supabase Row Level Security (RLS) zawsze włączone
- Zmienne środowiskowe: tylko przez `src/lib/env.ts` (zod validation)
- Konwencja nazewnictwa: camelCase zmienne, PascalCase komponenty, kebab-case pliki

## Workflow
- Zawsze uruchom `pnpm typecheck` po serii zmian
- Testy jednostkowe: Vitest (`pnpm test`)
- E2E: Playwright (`pnpm test:e2e`)
- Branches: `feature/`, `fix/`, `chore/` → PR do `main`
- Nie modyfikuj bezpośrednio migracji Supabase — twórz nowe

## Kolory brandowe
- **Fjord Blue:** `#0A2E4D` (ciemny) / `#1B4F72` (CSS token)
- **Salmon Orange:** `#E67E50` (brand) / `#E67E22` (CSS token)
- **Ice White:** `#F8FAFB`
- Tagline: "Connecting anglers with the best fishing experiences in the world"

## Logo assets
Pliki w `/Desktop/fjordAnglers/identity/` oraz skopiowane do `public/brand/`:
- `white-logo.png` — na ciemne tła
- `dark-logo.png` — na jasne tła
- `sygnet.png` — ikona/favicon

## Zespół
- **Tymon** (CEO, dev): Next.js/Supabase/Stripe
- **Łukasz**: content, Instagram, visual identity
- **Krzychu**: fishing knowledge, weryfikacja przewodników, License Map data

## Co agent NIE powinien robić
- Nie używaj `require()` — tylko ES modules
- Nie edytuj `.env.local` bezpośrednio — powiedz jakie zmienne dodać
- Nie commituj sekretów
- Nie używaj `pages/` router — tylko `app/`
- Nie twórz nowych migracji Supabase bez konsultacji

