---
id: FA-0.14
title: Strona hub `/patagonia` dla grupy reklam „Patagonia ogólna”
stage: 0
status: todo
difficulty: M
model: sonnet
model_approved:
effort: medium
agent: fa-core
branch: feat/patagonia-hub
depends_on: [FA-0.11, FA-0.12]
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 5
owner: tj
---

# FA-0.14 — Strona hub `/patagonia`

**Skąd to zadanie (audyt lejka 5 IX 2026).** Grupa reklam „Patagonia ogólna" (12 najszerszych
słów kluczowych) miała lądować na `/patagonia`, które zwraca 404; tymczasowo kieruje na
Bariloche. Zapasowe `/trips` ma tytuł o Norwegii. Hub ma pokazać obu przewodników
(Prior — Coyhaique, Leobono — Bariloche) i sprowadzić klienta do jednego z dwóch formularzy.

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`; `docs/03-conventions.md`; `docs/01-architecture.md` (trasy publiczne)
- `src/app/trips/page.tsx` — jedyna dziś strona listująca; wzorzec zapytania i kart
- `src/app/experiences/[slug]/page.tsx` — sekcja „More like this" (karty) i `generateMetadata` — do reużycia, nie kopiowania
- `src/components/layout/footer.tsx` + `NavWithUser` — jak strony publiczne składają chrome
- `src/app/sitemap.ts`, `src/app/robots.ts`
- `claude/patagonia-test-campaign-2026-09.md` (projekt Cowork) — nagłówki/teksty grupy 3: hub ma odpowiadać na
  obietnicę „Two vetted owner-guides in Patagonia: Bariloche, Argentina and Coyhaique, Chile. Ask once."
- FA-0.11 (ceny) i FA-0.12 (mapa kraj→grupa regionu) — hub używa obu; nie zaczynaj przed ich `review`

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
`/patagonia` istnieje, ma tytuł i opis o Patagonii, pokazuje aktywne strony z grupy Patagonia
(z bazy, nie na sztywno — gdy dojdzie trzeci przewodnik, pojawi się sam), ceny w USD przez
helper z FA-0.11, jedno CTA na kartę prowadzące do strony doświadczenia. Bez nowego formularza —
zapytanie składa się na stronie przewodnika, żeby `experience_page_id` i `trip_id` były wypełnione.

## Zakres
- [ ] **Odczyt bieżącego stanu**: `curl -sI https://fjordanglers.com/patagonia` (404); otwórz `trips/page.tsx`
      i sekcję kart w `experiences/[slug]/page.tsx`; ustal, czy karty da się wynieść do komponentu bez zmiany wyglądu.
- [ ] Trasa `src/app/(public)/patagonia/page.tsx` (grupa `(public)` — jak `/guides`, żeby dziedziczyć chrome);
      dane: `experience_pages` gdzie `status='active'` i kraj ∈ grupa `patagonia` (mapa z FA-0.12).
- [ ] Nagłówek + 2–3 zdania (tekst od tj — patrz STOP), karty przewodników, sekcja „How it works" w trzech
      krokach (dates → we check availability → deposit only once confirmed) — tekst z dokumentu kampanii.
- [ ] `generateMetadata`: tytuł „Patagonia Fly Fishing Trips — Bariloche & Coyhaique | FjordAnglers" (jeden sufiks),
      opis, canonical, OG image = hero pierwszej aktywnej strony.
- [ ] `sitemap.ts` dopisuje `/patagonia`; `robots.ts` bez zmian.
- [ ] `revalidate = 60` jak `/trips`.

## Gotowe, gdy
- [ ] `curl -s -o /dev/null -w "%{http_code}" https://fjordanglers.com/patagonia` → `200` (po deployu).
- [ ] `curl -s https://fjordanglers.com/patagonia | grep -o "<title>[^<]*"` → zawiera `Patagonia`, dokładnie jedno `FjordAnglers`.
- [ ] Strona listuje dokładnie tyle kart, ile jest aktywnych stron z grupy Patagonia w bazie (liczba z SELECT-a w raporcie = liczba kart).
- [ ] Każda karta linkuje do `/experiences/<slug>`; ceny w `$` (helper FA-0.11) — zrzut w raporcie.
- [ ] `grep -c "Scandinavia" <html>` → 0; stopka pokazuje destynacje z FA-0.12.
- [ ] `/patagonia` w `sitemap.xml`.
- [ ] `pnpm typecheck && pnpm test -- --run && pnpm build` zielone; `pnpm lint` zero nowych błędów vs `main`.
- [ ] Status `todo → review` tu i w `INDEX.md`, w tym samym PR.

## Poza zakresem
- Ogólny mechanizm `/destinations/[group]` — jeśli hub NZ okaże się potrzebny, wtedy uogólnienie; nie teraz.
- Nowy formularz na hubie.
- Zmiana kierowania grupy 3 w Google Ads — tj po deployu.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Copy nagłówka i akapitu — **od tj**; agent nie pisze tekstów marketingowych, wstawia placeholder
  `[TEXT FROM TJ]` i zatrzymuje się przed PR, jeśli tekst nie dotarł.

## Weryfikacja
```
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/patagonia
curl -s http://localhost:3000/patagonia | grep -o "<title>[^<]*"
curl -s http://localhost:3000/patagonia | grep -o 'href="/experiences/[^"]*"' | sort -u
curl -s http://localhost:3000/sitemap.xml | grep -c patagonia
pnpm typecheck && pnpm lint && pnpm test -- --run && pnpm build
```

## Notatki z realizacji
