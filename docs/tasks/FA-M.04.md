---
id: FA-M.04
title: Strona zlecenia `/r/[token]` — brief i daty, akceptuj / odrzuć / 1–3 inne daty, bez logowania, mobile-first
stage: M
status: todo
difficulty: M
model: sonnet
model_approved:
effort: medium
agent: fa-web
branch: feat/fa-m.04-request-page
depends_on: [FA-M.03]
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 6
owner: tj
---

# FA-M.04 — Strona zlecenia dla przewodnika

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md`
- `docs/tasks/FA-M.03.md` — warstwa danych zleceń (token, otwarcie, odpowiedź)
- `src/lib/inquiries/brief.ts` — schemat briefu i `briefSummaryLines`
- `src/app/offers/[token]/page.tsx` — wzór strony z tokenem bez logowania
- Dokument „Aplikacja dla przewodników — zakres MVP” — funkcja 3 i decyzja 10.11 o „innym terminie”

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Przewodnik w sezonie odpowiada w ~10 sekund: otwiera link z WhatsAppa (albo push), widzi najważniejsze o zleceniu i jednym kliknięciem akceptuje, odrzuca albo wybiera 1–3 inne daty. Bez logowania, po angielsku, czytelnie na telefonie. Otwarcie i odpowiedź trafiają do zapytania.

## Zakres
- [ ] Odczyt stanu: warstwa danych z FA-M.03, `briefSummaryLines`, strona `/offers/[token]` jako wzór (noindex, obsługa wygasłego tokenu).
- [ ] Trasa `/r/[token]` (nazwę ścieżki agent może zaproponować): weryfikacja tokenu, zapis pierwszego otwarcia, widok: kraj/rejon, daty klienta, liczba osób, brief (jeśli jest), uwagi FA.
- [ ] Trzy akcje: **Accept**, **Decline** (opcjonalny powód), **Other dates** (wybór 1–3 dat w kalendarzu na stronie); potwierdzenie po wysłaniu; ponowne wejście po odpowiedzi pokazuje, co odpowiedziano.
- [ ] Wygasły / zły token: czytelna strona „ten link wygasł — napisz do nas na WhatsApp”, bez szczegółów zlecenia.
- [ ] `noindex`, brak w sitemapie.
- [ ] Testy + przejście w przeglądarce w widoku telefonu (390 px).

## Gotowe, gdy
- [ ] Otwarcie linku zapisuje `first_opened_at` tylko raz — **jak sprawdzić:** test (dwa wejścia → jeden znacznik, jedno zdarzenie).
- [ ] Każda z trzech odpowiedzi zapisuje się i emituje `guide.request_answered` — **jak sprawdzić:** testy akcji.
- [ ] „Other dates” nie przepuszcza 0 ani 4 dat ani daty z przeszłości (walidacja po stronie serwera); pokazane na czerwono — **jak sprawdzić:** test akcji.
- [ ] Wygasły token nie ujawnia danych zlecenia — **jak sprawdzić:** test renderu / `curl` lokalnie, wklejony fragment.
- [ ] Strona ma `noindex` i nie ma jej w sitemapie — **jak sprawdzić:** `curl -s localhost:3000/r/<token> | grep -i noindex`, grep w `src/app/sitemap.ts`.
- [ ] Zrzuty w widoku 390 px: zlecenie, po akceptacji, wybór dat, wygasły link — **jak sprawdzić:** ścieżki zrzutów w opisie PR.

## Poza zakresem
- Wysyłka linku i przycisk w adminie → FA-M.05.
- Logowanie / konto przewodnika → FA-M.08; lista zleceń w koncie → FA-M.13.
- Podgląd kalendarza przewodnika na stronie zlecenia → po MVP.
- Formularz oferty z polami → poza MVP (decyzja 4.11).
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Przed krokiem przeglądarki: `scripts/dev-preflight.sh`, URL bazy 127.0.0.1/localhost.

## Weryfikacja
```
pnpm test -- request-page
curl -s -o /dev/null -w '%{http_code}' localhost:3000/r/<token>
```

## Notatki z realizacji
- **2026-11-10, tj (wf-plan):** „inny termin” = wybór 1–3 dat (decyzja w dokumencie MVP).
