---
id: FA-1.84
title: Blog, krok 2 — edytor w `/admin` (szkic/publikacja, zdjęcia, podgląd, metadane SEO), publikacja bez deployu
stage: 1
status: done
difficulty: L
model: opus
model_approved:
effort: high
agent: fa-web
branch: feat/fa-1.84-blog-editor
pr: 187
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
- [ ] Liczniki: tytuł SEO ≤ 60, opis ≤ 155 — **blokada** (E1, zastępuje „ostrzeżenie, nie blokada"; baza wymusza limity także dla szkiców); slug zablokowany po pierwszej publikacji (E2, tylko w akcji).
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
- **2026-11-10, tj:** E1 (a) — tytuł SEO ≤ 60 i opis ≤ 155 są **blokadą** w formularzu (licznik czerwony, zapis wyłączony); baza wymusza je także dla szkiców. Zastępuje „ostrzeżenie, nie blokada" z zakresu.
- **2026-11-10, tj:** E2 (a) — niezmienność sluga po pierwszej publikacji wymuszana wyłącznie w akcji serwerowej (bez triggera, bez migracji), z testem red-proof.
- **2026-11-10, tj:** E3 (a) — Krzysztof dostaje istniejącą rolę `admin`, bez nowej roli. Kroki dla tj w opisie PR; zmianę roli na prod wykonuje tj.
- **2026-11-10, tj:** E4 (tak) — oba wiersze z deferred w zakresie: czytelny komunikat zamiast surowego błędu 23514 przy publikacji niekompletnego wpisu (decyzja C2) oraz ostrzeżenie w podglądzie, gdy treść zawiera znaczniki HTML, które zostaną usunięte (`skipHtml`).
- **2026-11-10, tj:** Decyzja 1 → A — akcja serwerowa zapisuje jeden wiersz `audit_log` na każdy udany zapis / publikację / wycofanie (`table_name` 'blog_posts', `operation`, `record_id`, `changed_by` = id admina). Wiersz jest mały: `old_data`/`new_data` zawierają zmienione pola metadanych w całości, ale dla `body_md` tylko długość i krótki hash przed/po — nigdy pełną treść. Jeśli zapis do `audit_log` się nie uda: log błędu, zapis wpisu zostaje (nie przerywamy zapisu użytkownika). Lokalnie sprawdzić, że insert service-role działa, i wkleić wiersz; jeśli nie działa — STOP. (tj potwierdził odczyty prod: 190 wierszy `audit_log`, 138 bez aktora, service_role może wstawiać.)
- **2026-11-10, tj:** Decyzja 2 → A — lokalny stack bez `storage-api` na liście `-x` na czas tego zadania. Przed każdym `pnpm build` zatrzymać stacki i zapytać tj. Wkleić `docker ps` i `free -h` raz, gdy działają next dev + Playwright.
- **2026-11-10, agent:** „pierwsza publikacja" = ustawione `published_at`: akcja stempluje je przy pierwszej publikacji i zachowuje przy wycofaniu, więc wycofany wpis nie odblokowuje sluga (test red-proof). Zmiana sluga szkicu nigdy nie publikowanego jest dodatkowo zabezpieczona warunkiem w `UPDATE` (status `draft`, brak `published_at`) — gdy inny admin opublikuje wpis w międzyczasie, zapis nie trafi w żaden wiersz.
- **2026-11-10, agent:** obraz główny: formularz przyjmuje wgranie do `guide-photos/blog/` albo ścieżkę serwisową (`/fish_catalog/…`, jak w artykule o Norwegii), żeby edycja istniejącego wpisu nie wymagała ponownego wgrania. Limit rozmiaru i typów wymusza bucket (prod: 52 428 800 B, jpeg/jpg/png/webp), nazwę pliku generuje komponent (UUID).
- **Otwarte (decyzja tj w raporcie PR):** C3 — zamknięta lista kategorii (treść listy); sprawdzenie `revalidateTag` w trybie produkcyjnym (wymaga `pnpm build`).
- **2026-11-10, tj (accepted — close it):** Kategoria zostaje wolnym tekstem; zamknięta lista odłożona (wiersz w deferred: lista do ustalenia później, ryzyko duplikatów przez literówki typu „planning"/„Planning"). `revalidateTag` w trybie produkcyjnym: nie dowodzony lokalnym buildem — dowód po merge na prod przez tj: edycja artykułu o Norwegii w nowym edytorze (poprawki z deferred: „sjørøye", limit wywozu 15 kg → 10 kg), zapis i sprawdzenie, że `/blog/fishing-regulations-norway-2026` pokazuje zmianę w ciągu kilku minut; w tej samej sesji tj testuje prawdziwy upload do `guide-photos/blog/` i wiersz `audit_log`. Jeśli zmiana nie pojawi się w 5 minut — wraca jako nowe zadanie. Dodany wiersz deferred dla FA-1.92: bucket `guide-photos` przyjmuje pliki do 50 MB — tak duże zdjęcie główne spowalnia stronę artykułu; rozważyć mniejszy limit albo zmianę rozmiaru przy uploadzie.
