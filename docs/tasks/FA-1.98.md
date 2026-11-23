---
id: FA-1.98
title: Edytor bloga — „Wstaw zdjęcie” w treści (upload do `guide-photos/blog/<slug>/`), alt obowiązkowy przy publikacji, ściągawka nowych bloków, autor i „Last checked” per wpis
stage: 1
status: todo
difficulty: M
model: opus
model_approved:
effort: high
agent: fa-web
branch: feat/fa-1.98-blog-editor-photos
depends_on: [FA-1.97]
blocked_by_questions: []
touches_db: true
touches_prod: false
estimate_h: 6
owner: tj
---

# FA-1.98 — Edytor bloga: zdjęcia w treści, autor, „Last checked”

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` — reguły nienegocjowalne (reguła 3, reguła 5 o zdarzeniach)
- `docs/03-conventions.md` — konwencje kodu i migracji
- `docs/tasks/FA-1.84.md` — edytor, decyzje O-49/O-50, E1–E4, `audit_log`
- `docs/tasks/FA-1.97.md` — nowy wygląd, dyrektywy `:::summary` i `::quote{…}`, stopka artykułu
- `src/components/admin/blog-post-form.tsx`, `src/components/admin/image-upload.tsx`, `src/actions/blog.ts`, `src/lib/blog/editor.ts`, `src/lib/blog/post.ts`

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Krzysztof składa cały artykuł w `/admin/blog`, łącznie ze zdjęciami w treści — bez dashboardu Supabase i bez SQL-a. 23 XI tj musiał wgrać 11 zdjęć artykułu o Nowej Zelandii ręcznie do bucketu i wkleić adresy do `::photo`, bo edytor przyjmuje tylko zdjęcie główne. Do tego dwa pola z makiety: autor i data ostatniego sprawdzenia treści.

## Zakres
- [ ] Odczyt stanu: kolumny `blog_posts` na prod (SELECT z `information_schema`), obecny formularz i `ImageUpload` (kompresja, limity, ścieżka).
- [ ] **„Wstaw zdjęcie”** przy polu treści: wybór pliku → ta sama kompresja co zdjęcie główne → upload do `guide-photos/blog/<slug>/<uuid>.<ext>` → w miejscu kursora wstawia `::photo{src="…" alt="" caption=""}`. Bez sluga (nowy szkic bez tytułu) przycisk nieaktywny z podpowiedzią. Bez nowego bucketu (O-50 (a)).
- [ ] **Alt obowiązkowy przy publikacji:** każdy `::photo` w treści musi mieć niepusty `alt` — inaczej publikacja zablokowana z listą brakujących (szkic można zapisać). Sprawdzenie w akcji serwerowej, nie tylko w formularzu.
- [ ] **Ściągawka** w formularzu uzupełniona o `:::summary` i `::quote{text="…" guide="…" region="…"}` (FA-1.97).
- [ ] **Migracja:** `blog_posts.author_name text NULL` (≤ 80 znaków, nie pusty) i `blog_posts.last_checked_at date NULL`. Pola w formularzu; `last_checked_at` ustawiane ręcznie (przycisk „Sprawdzone dziś”), **nie** przy każdym zapisie.
- [ ] **Czytnik:** stopka artykułu „Written by {author_name ?? 'FjordAnglers'} · Published … · Last checked …” (ostatnia część tylko gdy data jest); JSON-LD `Article.author` = `Person` gdy `author_name` jest, inaczej `Organization` jak dziś.
- [ ] **„Report an outdated rule”:** `mailto:contact@fjordanglers.com` z tematem „Outdated info: {tytuł}” i adresem artykułu w treści.
- [ ] `audit_log` dla nowych pól jak w FA-1.84 (decyzja 1 → A).

## Gotowe, gdy
- [ ] Lokalnie: wstawienie zdjęcia w treść szkicu → plik w `guide-photos/blog/<slug>/`, snippet w treści, zdjęcie widoczne w podglądzie — zrzuty wklejone.
- [ ] Publikacja z `::photo` bez `alt` odrzucona przez akcję (red proof: wywołanie akcji z pominięciem formularza); szkic z tym samym zapisuje się.
- [ ] `author_name` = '' odrzucone przez bazę (red proof constraintu).
- [ ] Artykuł z `author_name` → JSON-LD `Person`; bez → `Organization` — oba wklejone.
- [ ] `last_checked_at` nie zmienia się przy zwykłym zapisie (test).
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` zielone — wklejone.

## Poza zakresem
- Galeria / biblioteka wgranych zdjęć, usuwanie plików ze Storage → deferred.
- Bucket `Blog` utworzony ręcznie przez tj 23 XI (zdjęcia artykułu o NZ) — nie ruszasz; przeniesienie tych zdjęć do `guide-photos/blog/` zrobi tj przez nowy edytor.
- Wybór, kto podpisuje artykuły — decyzja treściowa tj/Krzysztofa, nie kod.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- SQL migracji — pokaż i czekaj.
- Migracja na prod wyłącznie przez `migrate-prod` (tj); kolejność: PR migracyjny → merge → `migrate-prod` → odczyt → PR z kodem.
- Zmiana polityk Storage albo nowy bucket — STOP z SQL.
- Stan bazy ustalasz bieżącym odczytem, nigdy z pamięci, notatek ani pliku typów.

## Weryfikacja
```
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

## Notatki z realizacji
- **2026-11-23, tj:** zdjęcia w treści wgrywane z edytora do `guide-photos/blog/<slug>/` (zamiast ręcznie do bucketu); `last_checked_at` jako osobna kolumna, nie `updated_at`; autor per wpis, z `Organization` jako zapasem; „Report an outdated rule” = `mailto:`.
