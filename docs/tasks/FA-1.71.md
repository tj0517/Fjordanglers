---
id: FA-1.71
title: Zdjęcie w opinii klienta — wybór w adminie „na górze” / „z boku” (`testimonials.photo_layout`)
stage: 1
status: review
difficulty: S
model: opus
model_approved: tj (2026-10-24, w rozmowie)
effort: medium
agent: fa-core
branch: feat/fa-1.71-testimonial-photo-layout
depends_on: [FA-1.68, FA-1.69]
blocked_by_questions: []
touches_db: true
touches_prod: false
estimate_h: 2
owner: tj
---

# FA-1.71 — zdjęcie w opinii: pasek na górze albo kolumna z boku

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` — reguły nienegocjowalne
- `docs/03-conventions.md` — konwencje kodu i migracji
- `supabase/migrations/20261012000000_add_testimonials.sql` — tabela z FA-1.68
- `src/components/testimonial-banner.tsx` — baner z FA-1.69 (to on rysuje zdjęcie)
- `src/components/experience-v2/offer-story-block.tsx` — wzór „zdjęcie z boku od `sm`”

## Cel

Baner (FA-1.69) wrzucał każde zdjęcie w pasek 180 px na górze karty. Zdjęcie klienta bywa
pionowe równie często jak poziome, a pionowe w takim pasku to klatka piersiowa i dwie ręce.
Wybór należy do FA — to FA wgrywa zdjęcie w adminie — więc jest to pole w formularzu, a nie
zgadywanie z proporcji pliku (decyzja tj, 24 X 2026).

## Zakres
- [x] Odczyt bieżącego stanu: `testimonials` na lokalnym stacku (`\d testimonials`), kod
      FA-1.68/1.69 (akcje, warstwa danych, formularz, baner), testy, które te pliki pinują
- [x] Migracja `20261024000000_testimonials_photo_layout.sql`: `photo_layout TEXT NOT NULL
      DEFAULT 'horizontal'` + CHECK na dwie wartości + COMMENT. Bez backfillu — default
      zostawia pięć istniejących wierszy dokładnie tak, jak wyglądają dziś
- [x] `pnpm supabase:types:local` po migracji (diff: dokładnie 3 linie `photo_layout`)
- [x] Warstwa danych: `Testimonial.photoLayout`, kolumna w `PUBLIC_COLUMNS`, mapper
- [x] Akcja: `photo_layout` w zodzie (enum), w `toColumns` — bez zdjęcia zawsze `horizontal`,
      komunikat dla `testimonials_photo_layout_check`
- [x] Formularz: dwie opcje („Across the top” / „Down the side”) pod uploadem, widoczne tylko
      gdy wiersz ma zdjęcie
- [x] Baner: `vertical` → od `sm` zdjęcie kolumną z boku (offsety = padding karty, więc zdjęcie
      kończy się równo z krawędzią), na mobile wyższy blok 300 px zamiast paska 180 px

## Gotowe, gdy
- [x] Dwie wartości działają end-to-end: admin → baza → strona
- [x] Wiersz bez zdjęcia zapisuje `horizontal`, nawet gdy formularz wyśle `vertical`
- [x] Istniejące wiersze bez zmian (default), żadnego backfillu
- [x] (dla nowego constraintu) pokazany na czerwono na celowo złym przypadku:
      `photo_layout='diagonal'` → `testimonials_photo_layout_check`, `NULL` → not-null
- [x] Testy: baner (3 przypadki), integracja na lokalnym stacku (round-trip + odmowa trzeciej
      wartości), zaktualizowany strażnik listy pól publicznych
- [x] `pnpm typecheck` czysty, `pnpm test` zielony poza plikami wymagającymi zdalnego stacku

## Poza zakresem
- Automatyczne rozpoznawanie proporcji pliku (świadomie odrzucone — wybór ma być FA)
- Zdjęcia w kartach recenzji anglerów (S10) — osobny PR, `design/v2-review-photo-orientation`
- Treść opinii na prod (FA-1.70, robi tj)

## Bramki STOP
- `db push` na prod **nie został wykonany** — migracja idzie na prod wyłącznie przez
  `deploy-db.yml` (`workflow_dispatch`, zatwierdza tj).
- **Kolejność: najpierw migracja na prod, potem merge kodu.** Kod *nie* jest zgodny wstecz:
  `photo_layout` jest w `PUBLIC_COLUMNS`, więc na bazie bez tej kolumny `getTestimonial()`
  dostanie błąd z PostgREST, zaloguje go i zwróci `null` — baner zniknie ze strony głównej,
  hubów i pustych S10. Odwrotna kolejność jest bezpieczna: kolumna z defaultem nie przeszkadza
  kodowi sprzed tego PR-a.

## Weryfikacja
```
pnpm typecheck && pnpm lint && pnpm test
```

## Notatki z realizacji
Raport w opisie PR-a. Dowody: `docs/screenshots/FA-1.71/`.
