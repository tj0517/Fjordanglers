---
id: FA-1.70
title: Treści opinii — zgody klientów na imię i zdjęcie, sprawdzenie warunków Trustpilota, wpisanie 3–5 opinii w `/admin/testimonials` na prod; robi tj
stage: 1
status: todo
difficulty: S
model: — (człowiek)
model_approved:
effort:
agent: —
branch: —
depends_on: [FA-1.68]
blocked_by_questions: []
touches_db: false
touches_prod: true
estimate_h: 2
owner: tj
---

# FA-1.70 — Treści opinii (tj)

## Kontekst — przeczytaj przed startem
- `docs/tasks/FA-1.68.md` — pola opinii i reguły (TP wymaga linku, aktywna wymaga zgody)
- `docs/tasks/FA-1.69.md` — gdzie i jak baner pokazuje opinię

## Cel
Baner po FA-1.69 jest pusty, dopóki w tabeli nie ma aktywnych opinii. To zadanie wypełnia ją prawdziwymi treściami, z podstawą do publikacji każdej z nich.

## Zakres
- [ ] Warunki Trustpilota co do przytaczania recenzji na własnej stronie — sprawdzone, wniosek w notatkach
- [ ] Zgoda (np. mail) od każdego klienta, którego imię albo zdjęcie spoza Trustpilota publikujemy; data i forma w `consent_note`
- [ ] Zdjęcia w dobrej jakości (poziome, ≥1600 px szerokości)
- [ ] 3–5 opinii w `/admin/testimonials` na prod: co najmniej jedna ogólna i po jednej dla krajów z ruchem Ads; ustawiona kolejność

## Gotowe, gdy
- [ ] W adminie na prod ≥3 aktywne opinie, w tym ≥1 bez kraju — zrzut listy
- [ ] Każda aktywna ma `consent_note` — widać na liście/edycji
- [ ] Strona główna i jedna strona v2 bez recenzji pokazują baner na prod — dwa zrzuty
- [ ] Wniosek o warunkach TP w notatkach

## Poza zakresem
- Zmiany w kodzie → FA-1.68 / FA-1.69

## Bramki STOP
brak — zapis przez admina na prod to cel zadania; robi tj.

## Weryfikacja
Zrzuty z punktów „Gotowe, gdy”.

## Notatki z realizacji
- 2026-10-23 tj (/wf-plan „testimonial baner”): osobne zadanie na treści (tj).
