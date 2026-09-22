---
id: FA-1.19
title: Skan sekretów w CI (gitleaks) — PR z kluczem w kodzie jest zatrzymany
stage: 1
status: todo
difficulty: S
model: sonnet
model_approved:
effort: low
agent: fa-core
branch: chore/ci-secret-scan
depends_on: []
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 1
owner: tj
---

# FA-1.19 — Skan sekretów w CI

## Cel
Klucz Stripe, service-role albo token wklejony przez pomyłkę do kodu ma zatrzymać PR
automatycznie, zanim trafi do historii repo — review łapie to grepem, ale tylko w tym,
co review czyta. Decyzja tj 2026-09-22 (audyt agent-workflow).

## Zakres
- [ ] Odczyt stanu: `.github/workflows/ci.yml`, czy istnieje jakakolwiek konfiguracja skanu
- [ ] Job `secrets` w `ci.yml` z gitleaks (akcja z przypiętą wersją/SHA), skan diffu PR i pełnej historii przy pierwszym uruchomieniu
- [ ] `.gitleaks.toml` z allowlistą **tylko** dla deterministycznych kluczy lokalnego stacku w `.env.test` (z komentarzem dlaczego)
- [ ] Job wymagany w ochronie gałęzi `stage-1` i `main` — **STOP**, zmiana ustawień repo robi tj

## Gotowe, gdy
- czysty PR przechodzi — **jak sprawdzić**: zielony run joba `secrets`
- red proof: PR z fałszywym kluczem w formacie `sk_live_…` jest czerwony — **jak sprawdzić**: link do czerwonego runu z gałęzi testowej (gałąź potem usunięta)
- pełna historia bez znalezisk albo znaleziska opisane — **jak sprawdzić**: wynik pierwszego runu w raporcie

## Poza zakresem
- rotacja kluczy (jeśli skan coś znajdzie → osobna decyzja tj, STOP)

## Bramki STOP
- zmiana ochrony gałęzi (ustawienia repo)
- jeśli skan znajdzie prawdziwy sekret w historii — stop i raport, bez przepisywania historii

## Kontekst
- `.github/workflows/ci.yml`
- `~/Documents/agent-workflow/core/security.md` §1, §S

## Notatki z realizacji
- 2026-09-22 tj: skan sekretów w CI (audyt agent-workflow).
