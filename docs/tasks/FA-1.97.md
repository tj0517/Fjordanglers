---
id: FA-1.97
title: Blog w nowym stylu — strona artykułu i lista wg makiety (grain), spis treści sticky zamiast fixed, FAQ jako sekcja + `FAQPage`
stage: 1
status: in_progress
difficulty: L
model: opus
model_approved:
effort: high
agent: fa-web
branch: feat/fa-1.97-blog-redesign
depends_on: []
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 10
owner: tj
---

# FA-1.97 — Blog w nowym stylu: artykuł i lista

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` — reguły nienegocjowalne
- `docs/03-conventions.md` — konwencje kodu
- `docs/design/blog-2026-11/README.md` + `article.dc.html`, `list.dc.html` — **makieta, źródło prawdy wyglądu**
- `docs/design/blog-hubs-2026-11/README.md` — kolory, fonty, opis efektu grain
- `src/components/site/grain.module.css`, `src/components/site/faq.tsx`, `src/components/site/ui.tsx`, `src/components/site/trip-card.tsx` — wspólne klocki z redesignu hubów; używasz ich, nie piszesz od nowa
- `src/app/(public)/blog/page.tsx`, `src/app/(public)/blog/[slug]/page.tsx` — obecne strony
- `src/components/blog/*` — obecny renderer (`ArticleBody`, bloki `::photo`, `:::info`, `:::warning`, `:::stat`), spis treści, `ArticleRelated`
- `src/lib/blog/article-markdown.ts` — wtyczki remark, `extractSections`
- `docs/tasks/FA-1.83.md`, `FA-1.84.md`, `FA-1.90.md` — jak powstał czytnik, edytor i linkowanie

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
`/blog` i `/blog/[slug]` wyglądają jak reszta strony po redesignie (hub, oferta v2, strona główna): makieta z `docs/design/blog-2026-11/`. Przy okazji naprawiony błąd zgłoszony przez tj: spis treści artykułu ma `position: fixed` na środku ekranu, więc wisi nad hero, treścią i stopką przez całe przewijanie.

## Zakres
- [ ] Odczyt stanu: obecne strony bloga i komponenty z `src/components/blog/`; które klocki z `src/components/site/` pasują do sekcji makiety (lista w raporcie: sekcja makiety → komponent).
- [ ] **Strona artykułu** wg `article.dc.html`, w kolejności makiety: hero (okruszki Home › Journal › kraj › tytuł, kategoria + kraj, H1, lead = `description`, autor/data/czas czytania), kolumna „In this article” + treść, sekcja FAQ, linki/stopka artykułu („Written by … · Published …”), „Fish it with a guide” (oferty z kraju), CTA huba na grainie, „More from the Journal”.
- [ ] **Spis treści:** kolumna obok treści, `position: sticky` pod pływającą nawigacją; zaczyna się pod hero i kończy razem z treścią artykułu — nie wchodzi na hero, sekcje pod artykułem ani stopkę. Mobile: jak dziś (zwijany). Obecny `fixed` usunięty.
- [ ] **Bloki w treści w nowym stylu:** `:::info` → „Good to know”, `:::warning` → „Important”, `:::stat` → blok na grainie, `::photo` z podpisem — wygląd z makiety. Składnia markdownu **bez zmian** (artykuły w bazie muszą renderować się tak samo).
- [ ] **Nowe dyrektywy** (renderer; edytor dostaje je w FA-1.98):
  - `:::summary` … `:::` → ramka „In short” z makiety,
  - `::quote{text="…" guide="…" region="…"}` → cytat przewodnika z makiety.
  Nieznane/niepełne dyrektywy nie wywalają strony (zachowanie jak dziś dla błędnych bloków).
- [ ] **FAQ:** sekcja `## FAQ…` (nagłówek H2 zaczynający się od „FAQ” albo „Frequently Asked Questions”) z pytaniami `###` wyjmowana z treści i renderowana jako osobna sekcja z makiety (grain, numerowane pytania, `FaqList` jeśli pasuje) + schema `FAQPage` w JSON-LD z tymi samymi pytaniami i odpowiedziami. Artykuł bez takiej sekcji: bez bloku i bez schemy.
- [ ] **Lista `/blog`** wg `list.dc.html`: wyróżniony najnowszy wpis, kafle „Topic hubs” → `/blog?category=Regulations|Seasons|Species`, „All articles” z filtrem kategorii i kraju, kafle destynacji (linki do hubów), CTA „Plan your trip”. Filtrowanie po stronie klienta na pełnej liście (wpisów jest kilka) — strona zostaje statyczna/ISR, canonical zawsze `/blog`, parametr tylko ustawia filtr początkowy. Porównanie kategorii bez rozróżniania wielkości liter (kategoria to wolny tekst, FA-1.84 C3). „Load more” tylko gdy wpisów > 12.
- [ ] Zaślepki z makiety (`[X] min read`, `[DATE]`, cytat itd.) nigdy nie trafiają na stronę: brak danych → blok się chowa.

## Gotowe, gdy
- [ ] Zrzuty (desktop 1440 i mobile 390) `/blog` i `/blog/fishing-regulations-norway-2026` obok odpowiednich plansz makiety — wklejone.
- [ ] Spis treści: zrzuty w trzech położeniach przewijania (nad hero / w środku treści / przy stopce) — w pierwszym i trzecim go nie widać nad hero/stopką.
- [ ] Artykuł o Norwegii renderuje wszystkie dotychczasowe bloki (`::photo`, `:::info`, `:::warning`, `:::stat`, tabela) — test renderera zielony, bez zmian w `body_md` w bazie.
- [ ] Test: markdown z `:::summary` i `::quote{…}` daje oba bloki; `::quote` bez `text` nie wywala renderu (red proof).
- [ ] Test: sekcja FAQ wyjęta z treści + JSON-LD `FAQPage` ma tyle pytań, ile `###` w sekcji; artykuł bez FAQ → brak `FAQPage` (red proof). JSON-LD z artykułu o Norwegii wklejony.
- [ ] `/blog?category=seasons` pokazuje tylko wpisy z kategorią „Seasons”; `<link rel="canonical">` = `/blog` — wklejone.
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` zielone — wklejone.

## Poza zakresem
- Edytor, upload zdjęć w treści, kolumny autora i „Last checked” → FA-1.98 (tu stopka artykułu pokazuje „FjordAnglers” i datę publikacji/aktualizacji jak dziś).
- Osobne strony „Topic hubs” → później, gdy będzie ≥ 5 wpisów w kategorii.
- Link „Report an outdated rule” → FA-1.98.
- Zmiany w hubach, ofertach, nawigacji i stopce strony.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
brak

## Weryfikacja
```
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

## Notatki z realizacji
- **2026-11-23, tj:** makieta artykułu i listy zaakceptowana (kanwa Claude Design, plansze „Artykuł” i „Blog: lista artykułów”), skopiowana do `docs/design/blog-2026-11/`.
- **2026-11-23, tj:** spis treści ma zatrzymywać się na treści (sticky w kolumnie), nie wisieć nad hero i stopką.
- **2026-11-23, tj:** „Topic hubs” → `/blog?category=…`, bez nowych stron; FAQ jako sekcja + `FAQPage`; nowe dyrektywy `:::summary` i `::quote{…}`.
