---
id: FA-1.84
title: Blog, krok 2 — edytor w `/admin` (szkic/publikacja, zdjęcia, podgląd, metadane SEO), publikacja bez deployu
stage: 1
status: todo
difficulty: L
model: opus
model_approved:
effort: high
agent: fa-web
branch: feat/fa-1.84-blog-editor
pr:
depends_on: [FA-1.83]
blocked_by_questions: []
touches_db: true
touches_prod: false
estimate_h: 10
owner: tj
---

# FA-1.84 — Blog, krok 2: edytor w panelu

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` — reguły nienegocjowalne (reguła 3, reguła 5 o zdarzeniach)
- `docs/03-conventions.md` — konwencje
- `docs/audit/seo-audit-2026-11.md` — §2.8 (czego potrzebuje autor nietechniczny)
- `docs/tasks/FA-1.83.md` — tabela i czytnik
- `src/app/admin/testimonials/` + akcje opinii (FA-1.68) — wzorzec ekranu admina z uploadem do Storage
- `src/app/admin/layout.tsx` — `requireAdmin`

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Krzysztof publikuje artykuł sam, w przeglądarce, bez PR-a i deployu. Po zadaniu `/admin/blog` ma listę wpisów i formularz: tytuł, slug (podpowiadany, edytowalny do pierwszej publikacji), tytuł i opis SEO z licznikami znaków, treść z podglądem, zdjęcie z alt, kraj/hub, przewodnik, status. „Opublikuj” odświeża stronę artykułu, listę i sitemapę (`revalidateTag`).

## Zakres
- [ ] Odczyt stanu: tabela z FA-1.83 na prod (SELECT kolumn), wzorzec akcji i uploadu z FA-1.68.
- [ ] Lista wpisów + formularz (nowy / edycja) w `/admin/blog`, akcje w `src/actions/*` z walidacją zod, tylko admin.
- [ ] Liczniki: tytuł SEO ≤ 60, opis ≤ 155 (ostrzeżenie, nie blokada); slug zablokowany po pierwszej publikacji.
- [ ] Pole treści w Markdown z podglądem tym samym rendererem co strona publiczna (O-49 (a)).
- [ ] Upload zdjęcia do istniejącego bucketu `guide-photos`, folder `blog/` (O-50 (a), jak O-47); `updated_at` przy każdej zmianie; `revalidateTag('blog')` po zapisie opublikowanego.
- [ ] Konto dla Krzysztofa — instrukcja dla tj w opisie PR (rola admin albo nowa rola redaktora → STOP, decyzja tj).

## Gotowe, gdy
- [ ] Lokalnie: utworzenie szkicu → niewidoczny publicznie (404); publikacja → 200 i obecny w sitemapie — zrzuty/`curl` wklejone.
- [ ] Nie-admin dostaje odmowę przy zapisie (red proof wklejony).
- [ ] Zmiana sluga po publikacji odrzucona (red proof).
- [ ] Test akcji zielony; `curl` strony admina = 200 dla admina; CI zielone — wklejone.

## Poza zakresem
- Zaplanowana publikacja, wersjonowanie, komentarze → deferred.
- Edytor hubów → FA-1.85 (może użyć tych samych komponentów).
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Nowa rola użytkownika albo zmiana ustawień Auth — STOP, decyzja tj.
- Zmiana polityk Storage albo nowy bucket — STOP z SQL (O-50 (a): bez nowego bucketu).
- Stan bazy ustalasz bieżącym odczytem, nigdy z pamięci, notatek ani pliku typów.

## Weryfikacja
```
pnpm test -- blog-actions
curl -s -o /dev/null -w "%{http_code}" localhost:3000/blog/<szkic>   # 404
```

## Notatki z realizacji
- **2026-11-03, tj:** D4 — krok 2 opcji A.
- **2026-11-03, tj:** O-49 (a) Markdown; O-50 (a) zdjęcia w `guide-photos/blog/`.
