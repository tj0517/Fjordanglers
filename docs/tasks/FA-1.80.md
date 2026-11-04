---
id: FA-1.80
title: Strony publiczne w cache — odczyt sesji poza drzewem renderu stron publicznych, `revalidate`/SSG zaczynają działać
stage: 1
status: review
difficulty: M
model: opus
model_approved:
effort: high
agent: fa-web
branch: feat/fa-1.80-public-cache
pr: 174
depends_on: []
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 5
owner: tj
---

# FA-1.80 — Strony publiczne w cache

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` — reguły nienegocjowalne
- `docs/03-conventions.md` — konwencje, sekcja „Production verification”
- `docs/audit/seo-audit-2026-11.md` — F3, F4, §2.1
- `docs/deferred-tasks.md` — wiersz FA-1.52 (ta sama hipoteza)
- `src/app/(public)/layout.tsx`, `src/components/layout/nav-with-user.tsx` — podejrzany odczyt `cookies()`
- `src/app/page.tsx`, `src/app/trips/page.tsx` — strony poza `(public)` z tą samą nawigacją

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Każda strona publiczna (blog, hub, oferta, główna) jest dziś renderowana przy każdym żądaniu (`private, no-store`, `x-vercel-cache: MISS`), mimo `revalidate` i `generateStaticParams`. TTFB oferty 1,33 s. Po zadaniu strony publiczne idą z cache Vercela, a stan zalogowania w nawigacji dociąga klient. Bez tego nie zadziała też ISR bloga (FA-1.83).

## Zakres
- [ ] Odczyt stanu: `pnpm build` (przy zatrzymanym stacku) — tabela tras z oznaczeniem ○/●/ƒ wklejona; hipoteza z audytu potwierdzona albo obalona z dowodem.
- [ ] Usunąć dynamiczny odczyt sesji z drzewa renderu stron publicznych (np. nawigacja z małą wyspą klienta dla stanu użytkownika).
- [ ] Tak samo dla stron poza `(public)`, które renderują tę nawigację (`/`, `/trips`).
- [ ] Panel, konto i strony z tokenem pozostają dynamiczne.

## Gotowe, gdy
- [ ] `pnpm build`: `/`, `/trips`, `/guides`, `/[destination]`, `/blog`, `/blog/[slug]`, `/experiences/[slug]` nie są `ƒ` — tabela przed/po wklejona.
- [ ] Zalogowany użytkownik dalej widzi swój stan w nawigacji (zrzut lub test), niezalogowany — przyciski logowania.
- [ ] Po wdrożeniu (tj): dwa kolejne `curl -s -D - -o /dev/null https://www.fjordanglers.com/iceland` → drugie `x-vercel-cache: HIT` (lub `STALE`) i `cache-control` bez `private, no-store`; to samo dla jednego artykułu i jednej oferty — wklejone.
- [ ] CI zielone na head PR — lista wklejona.

## Poza zakresem
- Obrazy, LCP, JS oferty → FA-1.92.
- Treść i struktura bloga → FA-1.83.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- brak (bez bazy i bez prod; `pnpm build` tylko przy zatrzymanym stacku, `docs/05-agent-operations.md` §9).

## Weryfikacja
```
pnpm build   # stack zatrzymany
curl -s -D - -o /dev/null https://www.fjordanglers.com/iceland | grep -iE 'cache-control|x-vercel-cache'   # ×2, po deployu
```

## Notatki z realizacji
- **2026-11-03, tj:** zadanie z audytu SEO (F3); kolejność wg raportu (D6).
- **2026-11-04, tj:** build criterion narrowed to /, /[destination], /blog, /blog/[slug], /experiences/[slug] — /trips and /guides stay ƒ (searchParams) but lose the session read; post-deploy cache check moved out of done — checked by tj after deploy; model opus · high
- **2026-11-04, tj (decyzja 1):** dane użytkownika w nawigacji — opcja C. `GET /api/nav-user` zwraca wyłącznie `{ name, role, avatarUrl }` wołającego (brak sesji → 401/puste); odczyt `profiles` w warstwie danych, nie w pliku route. Odpowiedź nigdy nie cache'owalna (`Cache-Control: private, no-store`, route dynamiczny, test na nagłówek). Wiersz tylko po id z sesji, nigdy z query stringa. Brak `.from(...)` w kodzie klienta. Opcja B (metadane rejestracji) odrzucona: na prodzie jedyne konto admina nie ma roli w metadanych.
- **2026-11-04, tj (decyzja 2):** stan przejściowy — „Log in” w HTML z serwera; po hydracji, jeśli istnieje lokalna sesja, natychmiast neutralny placeholder (rozmiar bloku awatara) do odpowiedzi `/api/nav-user`. Zrzuty: wylogowany, zalogowany (końcowy), placeholder jeśli da się złapać.
- **2026-11-04, tj:** bez zmian w tabeli `profiles`, jej politykach i grantach (osobne pilne zadanie). `proxy.ts` bez zmian, chyba że kontrola `Set-Cookie` pokaże inaczej (wtedy STOP).
