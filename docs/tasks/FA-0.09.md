---
id: FA-0.09
title: Sekrety poza .claude/settings.local.json, rotacja tokenu GitHub (O-11) — zadanie dla człowieka
stage: 0
status: todo
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

