---
id: FA-1.96
title: Strony z tokenem bez skryptów zewnętrznych — `/offers/`, `/reviews/`, `/invite/`, `/guide-intake/` + przegląd parametrów zapytania
stage: 1
status: in_progress
difficulty: S
model: sonnet
model_approved:
effort: low
agent: fa-web
branch: fix/fa-1.96-token-pages-third-party
depends_on: [FA-M.04]
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 2
owner: tj
---

# FA-1.96 — Strony z tokenem bez skryptów zewnętrznych

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `src/lib/analytics/third-party-free-routes.ts` — lista tras bez skryptów zewnętrznych (FA-M.04)
- `src/components/analytics/GoogleTags.tsx`, `src/components/ui/cookie-banner.tsx` — gdzie lista jest sprawdzana
- `src/app/r/[token]/request-page.test.tsx`, `request-page-third-party.test.tsx` — wzór testów
- `src/app/offers/[token]/`, `src/app/reviews/[token]/`, `src/app/invite/[token]/`, `src/app/guide-intake/[token]/`
- `docs/deferred-tasks.md` — wiersz FA-M.04 o przecieku z `/offers/<token>`

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Tag Google Ads (a z GTM także GA), Meta Pixel i Clarity wysyłają pełny adres strony. Na stronach, których adres niesie token (oferta z depozytem, opinia, zaproszenie przewodnika do konta, formularz intake), token trafia do Google, Mety i Microsoftu. FA-M.04 zamknął to dla `/r/` listą `THIRD_PARTY_FREE_ROUTES`; to zadanie obejmuje nią resztę stron z tokenem i sprawdza, czy dane dostępowe nie siedzą też w parametrach zapytania. Sukces: żaden link z danymi dostępowymi nie opuszcza strony do zewnętrznego skryptu, a pomiar i konwersje na pozostałych stronach działają jak dziś.

## Zakres
- [ ] Odczyt stanu: wszystkie trasy, których ścieżka, parametry zapytania albo część po `#` niosą dane dostępowe (`[token]`, `?token=`, `?token_hash=`, `?code=`, `?key=`, `#access_token` — m.in. `/reset-password`, `/auth/*`, `/inquiry/[id]/confirmed`); dla każdej: co daje posiadaczowi linku i czy ładuje skrypty zewnętrzne.
- [ ] Dopisanie `/offers/`, `/reviews/`, `/invite/`, `/guide-intake/` do `THIRD_PARTY_FREE_ROUTES`.
- [ ] Trasy z danymi dostępowymi w parametrach zapytania lub po `#`: jeśli są — STOP (bramka niżej).
- [ ] Testy dla każdej trasy z listy + przejście w przeglądarce.
- [ ] Wiersz deferred FA-M.04 o `/offers/` oznaczony jako zamknięty przez FA-1.96.

## Gotowe, gdy
- [ ] Na każdej z czterech tras przy zgodzie zapisanej jako `accepted` nie renderuje się tag Google, GTM, baner, Pixel ani Clarity; red proof (trasa usunięta z listy → test czerwony) — **jak sprawdzić:** test, wynik czerwony i zielony wklejony.
- [ ] Zwykła strona (`/`) dalej renderuje tagi, a konwersja `AW-18171634204/yydcCKmuoe0cEJzE9NhD` przy wysłaniu formularza działa bez zmian — **jak sprawdzić:** testy `experience-funnel` + test renderu `/` zielone.
- [ ] Przejście w przeglądarce (hosty Google, Meta, Clarity zablokowane i liczone, zgoda `accepted` w localStorage): 0 prób połączeń na każdej z czterech tras, >0 na `/` — **jak sprawdzić:** tabela liczników w opisie PR.
- [ ] Przegląd parametrów zapytania i części po `#`: lista tras z danymi dostępowymi z wynikiem (dopisane / nie dotyczy, z uzasadnieniem i dowodem) — **jak sprawdzić:** tabela w opisie PR + `grep -rn "searchParams" src/app --include=page.tsx`.
- [ ] CI zielone na head (`check`, `knip`, `db`, `secrets`) — **jak sprawdzić:** lista checków w opisie PR.

## Poza zakresem
- Unieważnianie tokenów, które już mogły wyciec → nie robimy (decyzja tj 2026-11-17, D2 a).
- Przeniesienie tokenu z adresu do ciasteczka → po MVP, jeśli lista okaże się zawodna.
- Tagi Google na localhost (wiersz deferred FA-M.02) → osobne zadanie.
- `server-only`, `requireToken` dla linków zleceń (wiersze deferred FA-M.04) → osobne zadania.
- Zmiany w samych stronach z tokenem (treść, wygląd, wygasanie linków).
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Przed zmianą dla trasy z danymi dostępowymi w parametrach zapytania lub po `#` (np. `/reset-password`, `/auth/*`) — pokaż trasę, co niesie, czy tagi faktycznie wysyłają tę część adresu (z dowodem) i opcje; czekaj na akceptację.
- Przed pierwszym krokiem w przeglądarce: `docker ps`, URL bazy dev servera 127.0.0.1/localhost (do merge FA-1.67 ręcznie), blokada hostów Google, Meta, Clarity potwierdzona w sesji Playwright.

## Weryfikacja
    pnpm exec vitest run third-party
    pnpm test -- experience-funnel
    grep -n "THIRD_PARTY_FREE_ROUTES" -A3 src/lib/analytics/third-party-free-routes.ts

## Notatki z realizacji
- **2026-11-17, tj (wf-plan):** D1 (a) — wszystkie cztery trasy z tokenem w jednym PR + przegląd parametrów zapytania; D2 (a) — tokenów, które mogły wyciec, nie unieważniamy (prod 17.11: 0 aktywnych linków ofert, 3 aktywne linki opinii, 0 zaproszeń, 1 publiczny link intake). Konwersja Ads strzela tylko przy formularzu zapytania, nie na stronach z tokenem.
- **2026-11-17, tj (STOP 1, parametry zapytania):** (b) — `/login` na `THIRD_PARTY_FREE_ROUTES`, dopasowanie dokładne (ścieżka, bez query string), nie prefiks; pozostałe wpisy zostają prefiksami; testy: `/login` i `/login?next=…` wykluczone, `/loginx` i `/` nie, `/offers/x` dalej wykluczone; red proof jak dla tras z tokenem; `/login?next=/invite/<code>` w przejściu przeglądarką (0 prób). (c) — kod zaproszenia poza adresem `/login` → deferred. Do deferred także: brak `referrer: 'no-referrer'` na `/offers/`, `/reviews/`, `/guide-intake/`; nieaktualny komentarz w `reset-password-form.tsx`. Pozostałe trasy z tabeli (`/auth/reset`, `/auth/callback`, `/reset-password`, `/inquiry/[id]/confirmed`) — „nie dotyczy” przyjęte; tabela zostaje w opisie PR. Bez ładowania prawdziwych skryptów Mety/Clarity.
- **2026-11-17, tj (STOP 2):** przejście w przeglądarce zatwierdzone (blokada w każdym przebiegu, zgoda `accepted` przed skryptami strony, `about:blank` przed zwrotem); stack Seaclouds nie ruszać. Komenda weryfikacji: `pnpm exec vitest run third-party` zamiast `pnpm test -- third-party`.
