---
id: FA-0.09
title: Sekrety poza .claude/settings.local.json, rotacja tokenu GitHub (O-11) — zadanie dla człowieka
stage: 0
status: done
difficulty: S
model:
model_approved:
effort:
agent:
branch: chore/secrets-hygiene
depends_on: []
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 1
owner: tj
---

# FA-0.09 — Higiena sekretów (robi tj, nie agent)

## Kontekst
- `docs/04-open-questions.md` O-11, `docs/05-agent-operations.md` §7
- `.claude/settings.local.json` — dziś zawiera w `env`: `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ACCESS_TOKEN`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `GITHUB_TOKEN` (jawnym tekstem; plik jest w `.gitignore`, ale agent czyta go w każdej sesji)
- `.mcp.json` — klucz Firecrawl wpisany na sztywno, `--access-token` Supabase wpisany na sztywno
- `.claude/settings.json` — dodane `deny` na `Read(.env*)` i `Read(.claude/settings.local.json)`

## Cel
Agent pracujący w repo nie powinien mieć w zasięgu klucza service-role (etap 1 i 4 dają mu i tak wystarczająco dużo władzy przez migracje), a token GitHub i klucze Stripe nie powinny leżeć w pliku, który każde narzędzie może odczytać. Po zadaniu sekrety żyją w środowisku powłoki (direnv / 1Password CLI / Keychain), a w plikach konfiguracyjnych są tylko odwołania `${VAR}`.

## Zakres (checklista dla tj)
- [ ] Zrotować `GITHUB_TOKEN` (GitHub → Settings → Developer settings → tokens) — stary unieważnić.
- [ ] Zrotować `SUPABASE_ACCESS_TOKEN` (Supabase → Account → Access Tokens).
- [ ] Klucz Firecrawl z `.mcp.json` → `${FIRECRAWL_API_KEY}`; Supabase `--access-token` → `${SUPABASE_ACCESS_TOKEN}`.
- [ ] `.claude/settings.local.json`: usunąć sekcję `env` w całości; zostawić tylko `permissions`.
- [ ] `.envrc` (direnv) albo `~/.zshrc` z eksportami: `NEXT_PUBLIC_*`, `STRIPE_*` (test), `RESEND_API_KEY`, `ANTHROPIC_API_KEY`, `SUPABASE_ACCESS_TOKEN`, `GITHUB_TOKEN`, `FIRECRAWL_API_KEY`. **Bez `SUPABASE_SERVICE_ROLE_KEY`** — lokalny dev używa klucza anon + własnej sesji admina; jeśli jakiś skrypt lokalny wymaga service-role, to jest zgłoszenie do `docs/deferred-tasks.md`, nie powód, żeby klucz zostawić.
- [ ] Sprawdzić, że `pnpm dev` i Claude Code (MCP supabase/github) nadal działają.

## Gotowe, gdy
- [ ] `grep -c "eyJ\|sk_\|ghp_\|sbp_\|fc-" .claude/settings.local.json .mcp.json` → 0 w obu plikach.
- [ ] Stare tokeny unieważnione (zrzut z GitHub/Supabase).
- [ ] `pnpm dev` startuje; `/fa-verify` w Claude Code przechodzi punkt 9 (sekrety).

## Poza zakresem
- Sekrety w Vercel — tam są poprawnie.
- Rotacja kluczy Stripe test — nieszkodliwe, można pominąć.

## Bramki STOP
n/d — zadanie wykonuje człowiek.

## Weryfikacja
```
grep -c "eyJ\|sk_\|ghp_\|sbp_\|fc-" .claude/settings.local.json .mcp.json
```

## Notatki z realizacji


---

## Odbiór (fa-review, 16 IX 2026)

Werdykt: **done**. Kryterium sekretów udowodnione odczytem.

- `grep -c "eyJ\|sk_\|ghp_\|sbp_\|fc-" .claude/settings.local.json` → **0**
- `grep -c "eyJ\|sk_\|ghp_\|sbp_\|fc-" .mcp.json` → **0**

**Co było przed naprawą (odczyt 16 IX, stan wyjściowy):** `.claude/settings.local.json`
zawierał sekcję `env` z `NEXT_PUBLIC_SUPABASE_ANON_KEY` i `SUPABASE_SERVICE_ROLE_KEY`
w starym formacie `eyJ…` oraz `STRIPE_SECRET_KEY` (`sk_test_`); `.mcp.json` — token
osobisty Supabase `sbp_…` i `FIRECRAWL_API_KEY`. Oba pliki były w `.gitignore`
i nieśledzone, więc nic nie trafiło do repo.

**Co zrobiono:** sekcja `env` usunięta z `settings.local.json` — to ona przesłaniała
działające logowania i zablokowała pracę trzy razy (`gh` → `HTTP 401: Bad credentials`
w FA-1.06, keychain Supabase ignorowany w FA-1.01, `gen types` → `Unauthorized` w FA-0.05).
Token `sbp_…` **unieważniony przez tj**. Z `.mcp.json` usunięto serwery `supabase`
i `firecrawl` (decyzja tj: Supabase MCP i tak idzie przez inne konto, Firecrawl nieużywany);
zostały `github`, `stripe`, `sequential-thinking`, `context7`.

**Dodatkowo:** `.gitignore` nie obejmował `.mcp.json.bak*` — wzorzec `.mcp.json` nie łapie
kopii z sufiksem. Backup ze starymi sekretami leżał jako untracked, czyli jedno `git add -A`
od wejścia do repo. Wzorzec dodany (linia 46).

**Nieweryfikowane:** klucz Firecrawl nie został zrotowany, tylko usunięty z konfiguracji —
tj zgłosił, że z niego nie korzysta. Klucze Supabase `eyJ…` były już martwe (klucze legacy
wyłączone 11 IX), więc nie wymagały rotacji. `sk_test_` to Stripe w trybie testowym.
Punkt „`/fa-verify` przechodzi punkt 9" nie był sprawdzany przy odbiorze.
