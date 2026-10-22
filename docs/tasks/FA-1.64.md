---
id: FA-1.64
title: Biblioteka zdjęć strony w adminie — „wybierz z wgranych” przy każdym polu zdjęć
stage: 1
status: in_progress
difficulty: M
model: opus
model_approved:
effort: high
agent: fa-core
branch: feat/admin-page-photo-library
depends_on: [FA-1.62]
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 6
owner: tj
---

# FA-1.64 — Biblioteka zdjęć strony w adminie

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` — reguły nienegocjowalne
- `docs/03-conventions.md` — konwencje kodu
- `src/components/admin/multi-image-upload.tsx` — pole wielu zdjęć (`max`, `initial`, `onChange`, pierwsze = cover)
- `src/components/admin/image-upload.tsx` — pole jednego zdjęcia, kompresja, presety
- `src/components/admin/ExperiencePageForm.tsx` — wszystkie miejsca ze zdjęciami: galeria, content photos, views, bloki treści, ryby (`guidePhotos` już przekazywane do ryb — wzorzec)
- `src/components/admin/experience-v2-editor/ContentSection.tsx` — pola treści v2
- `src/lib/experiences/v2-editor.ts` — zod; adresy zdjęć (site path `/…` albo http(s))

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Admin nie wgrywa tego samego zdjęcia trzy razy. Przy każdym polu zdjęć strony jest
przycisk „Choose from this page” otwierający siatkę wszystkich zdjęć już przypisanych do
tej strony (galeria, content photos, views, bloki, ryby, zdjęcia przewodników strony);
klik dodaje adres do pola bez ponownego uploadu i bez kopiowania pliku (O-41 a: biblioteka
per strona, nie globalna).

## Zakres
- [ ] Odczyt bieżącego stanu: wypisz w notatkach każde pole zdjęć w `ExperiencePageForm` i zakładce v2 z jego `max` i źródłem danych; sprawdź, jak ryby dostają dziś `guidePhotos`
- [ ] Jedna funkcja `collectPagePhotos(form)` → unikalne adresy z wszystkich pól formularza (stan bieżący, nie tylko zapisany) + zdjęcia przewodników strony
- [ ] `MultiImageUpload` i `ImageUpload`: opcjonalny prop `library: string[]`; przycisk „Choose from this page” otwiera siatkę (miniatury, zaznaczone te już w polu); wybór respektuje `max`
- [ ] Prop podany we wszystkich polach zdjęć strony (v1; zakładka v2 nie ma pól zdjęć); duplikat w tym samym polu niemożliwy
- [ ] Zapis bez zmian w API — pole dostaje adres jak po uploadzie

## Gotowe, gdy
- [ ] Test `collectPagePhotos`: zbiera z każdego pola, deduplikuje, pomija puste; `pnpm test run page-photos multi-image-upload` zielone
- [ ] Na lokalnym stacku: zdjęcie z galerii dodane do ryby i do bloku treści przez bibliotekę; po zapisie i odświeżeniu oba pola je mają (zrzut w `docs/screenshots/FA-1.64/`); w Storage nie przybył nowy plik (`select count(*) from storage.objects` na lokalnej bazie przed/po w raporcie)
- [ ] Próba wyboru ponad `max` — przycisk wyboru nieaktywny z komunikatem (pokazany na czerwono na zrzucie)
- [ ] Pole bez `library` (formularze przewodników) wygląda i działa jak na `main`
- [ ] `git diff origin/main...HEAD -- src/app/api src/lib/supabase` pusty

## Poza zakresem
- Globalna biblioteka wszystkich zdjęć bucketa (O-41 b — odrzucone)
- Usuwanie zdjęć ze Storage, deduplikacja plików
- Edycja/kadrowanie zdjęć
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
brak

## Weryfikacja
```
pnpm test run page-photos multi-image-upload
ls docs/screenshots/FA-1.64/
git diff origin/main...HEAD --stat -- src/app/api src/lib/supabase
pnpm typecheck && pnpm lint && pnpm test run && pnpm knip && pnpm build
```

## Notatki z realizacji
- 2026-10-20 tj: O-41 → (a) biblioteka per strona. Zależy od FA-1.62 (limity 30 i galeria ryb — inaczej biblioteka nie ma gdzie wstawiać).
- 2026-10-22 tj: one picker — on page fields "Guide gallery" becomes "Choose from this page" (page photos + guide photos), no second picker; model opus/high. Task-file fixes: vitest filter without --, diff base origin/main, Storage check = storage.objects count, v2 tab has no photo fields.
