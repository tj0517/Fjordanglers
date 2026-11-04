---
id: FA-1.79
title: Jeden host kanoniczny `www` — jedna stała adresu zamiast 58 wpisanych na sztywno; apex → www stałym 308 (ustawienie Vercela robi tj)
stage: 1
status: review
difficulty: M
model: sonnet
model_approved:
effort: high
agent: fa-web
branch: feat/fa-1.79-canonical-www
pr: 173
depends_on: []
blocked_by_questions: []
touches_db: false
touches_prod: true
estimate_h: 4
owner: tj
---

# FA-1.79 — Jeden host kanoniczny `www`

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` — reguły nienegocjowalne
- `docs/03-conventions.md` — konwencje
- `docs/audit/seo-audit-2026-11.md` — F1 (host), F2 (sitemapa), D1
- `src/app/layout.tsx`, `src/app/sitemap.ts`, `src/app/robots.ts` — miejsca z adresem bazowym
- `grep -rn "https://fjordanglers.com" src` — pełna lista (58 wystąpień w 22 plikach na `77e419b`)

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Dziś domena bez `www` odpowiada 307 na `www`, a wszystkie canonicale, OG, JSON-LD, `robots.txt` i 70/70 adresów sitemapy wskazują domenę bez `www`. Google indeksuje oba hosty (GSC, 90 dni: apex 9 320 wyświetleń, www 6 448), więc siła stron dzieli się na dwa. Po zadaniu każdy adres generowany przez aplikację wskazuje `https://www.fjordanglers.com`, a adres bazowy siedzi w jednej stałej. Przekierowanie apex → www na stałe 308 ustawia tj w Vercelu po merge (decyzja tj D1, 2026-11-03).

## Zakres
- [ ] Odczyt stanu: `grep -rn "https://fjordanglers.com" src | wc -l` i lista plików — wklejone.
- [ ] Jedna stała adresu bazowego (np. `SITE_URL` w `src/lib/site.ts`) = `https://www.fjordanglers.com`; wszystkie 58 wystąpień przez nią.
- [ ] `metadataBase`, canonicale, `og:url`, JSON-LD, sitemapa, linia `Sitemap:` w `robots.ts` — z tej stałej.
- [ ] Test jednostkowy: sitemapa i `robots` nie zawierają hosta bez `www`.
- [ ] W opisie PR instrukcja dla tj: w Vercelu domena `www.fjordanglers.com` jako główna, `fjordanglers.com` → przekierowanie stałe (308).

## Gotowe, gdy
- [ ] `grep -rn "https://fjordanglers.com" src` zwraca 0 wierszy (poza stałą, jeśli trzyma wariant bez `www` do porównań) — wklejone.
- [ ] Test sitemapy/robots zielony; red proof: test pada, gdy stała wskazuje host bez `www` — wklejony wynik obu przebiegów.
- [ ] Lokalnie `curl -s localhost:3000/sitemap.xml | grep -o '<loc>[^<]*' | awk -F/ '{print $3}' | sort | uniq -c` → tylko `www.fjordanglers.com`; canonical na `/`, hubie, ofercie, artykule → `www` — wklejone.
- [ ] **Po wdrożeniu (tj)** — nie warunek `review`/`done`: `curl -sI https://fjordanglers.com/trips` → 308 na `https://www.fjordanglers.com/trips`; na prod sitemapa 70×`www` — wkleja tj albo agent w notatkach.
- [ ] CI zielone na head PR (`check`, `knip`, `db`, `secrets`) — lista wklejona.

## Poza zakresem
- Zgłoszenie sitemapy w GSC (tj, po FA-1.88).
- Zmiana treści sitemapy (stuby, `lastModified`) → FA-1.88.
- Linki z UUID przewodników → FA-1.86.
- Ustawienia domen w Vercelu — robi tj.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Zmiana ustawień domen / env w Vercelu — STOP, robi tj (instrukcja w opisie PR).

## Weryfikacja
```
grep -rn "https://fjordanglers.com" src
pnpm test -- sitemap
curl -s localhost:3000/sitemap.xml | grep -o '<loc>[^<]*' | awk -F/ '{print $3}' | sort | uniq -c
```

## Notatki z realizacji
- **2026-11-03, tj:** D1 — host kanoniczny `www`, apex → www stałym 308 (audyt SEO §4). Właściwość GSC to `sc-domain:fjordanglers.com` (domenowa), obejmuje oba hosty.
- **2026-11-04, tj:** the post-deploy criterion (308 + prod sitemap www) moved out of done — checked by tj after deploy; PR description also instructs tj to set NEXT_PUBLIC_APP_URL to www
