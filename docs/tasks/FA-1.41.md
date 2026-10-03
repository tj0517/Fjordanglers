---
id: FA-1.41
title: Limit żądań POST /api/inquiries — per IP i per e-mail, współdzielony między instancjami; odrzucone żądanie nie zapisuje, nie woła AI i nie wysyła maili
stage: 1
status: done
difficulty: M
model: sonnet
model_approved:
effort: medium
agent: fa-core
branch: feat/inquiries-rate-limit
pr: 122
depends_on: []
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 4
owner: tj
---

# FA-1.41 — Limit żądań na publicznym formularzu zapytań

## Kontekst — przeczytaj przed startem
- `CLAUDE.md`, `docs/03-conventions.md` — reguły i konwencje
- `docs/05-agent-operations.md` §3, §7 — bramki STOP, sekrety
- `docs/04-open-questions.md` — O-26 (Upstash) i O-29 (fail-open przy awarii limitera), oba rozstrzygnięte
- `src/app/api/inquiries/route.ts` — trasa publiczna, bez logowania; limit idzie na samym początku
- `src/app/api/events/route.ts` (~linie 21–40, 109) — dotychczasowy limit w pamięci procesu, celowo bez czytania IP; NIE jest wzorem (nie jest współdzielony między instancjami)
- `src/lib/env.ts` — deklaracje zmiennych środowiskowych
- `docs/tasks/FA-1.40.md` — dlaczego trasa po zmianie uruchamia pełną auto-wysyłkę

Nie zgaduj tego, czego nie ma w tych plikach. Brakujące informacje zgłoś, zamiast wymyślać.

## Cel
Trasa `POST /api/inquiries` jest publiczna i po włączeniu `AI_AUTO_REPLY_ENABLED` każde żądanie kosztuje trzy wywołania Anthropic i kilka maili, w tym mail na adres wpisany w formularzu. Dziś nic nie ogranicza liczby żądań. Po zadaniu seria żądań ponad próg z jednego IP albo na jeden adres e-mail dostaje 429 z `Retry-After` i nie powoduje zapisu, wywołania AI ani maila. Liczniki są wspólne dla wszystkich instancji (O-26: Upstash Redis). Decyzja tj z 2 X 2026.

## Zakres
- [ ] Odczyt bieżącego stanu: trasa, `/api/events` i `env.ts`; sprawdź w dokumentacji Vercel (context7 / docs), z którego nagłówka bierze się adres IP klienta na Vercelu i czy da się go podrobić.
- [ ] Limit w trasie, **przed** zapytaniami do bazy o stronę wyprawy: per IP i per e-mail (adres po `trim` i `toLowerCase`). Progi startowe w jednym miejscu jako stałe: IP 5 żądań / 10 min, e-mail 3 żądania / godzinę. *Progi do potwierdzenia przez tj przed startem agenta, patrz notatki.*
- [ ] Biblioteki: `@upstash/ratelimit` i `@upstash/redis`. Logika limitera za małym interfejsem, żeby testy używały adaptera w pamięci, a nie prawdziwego Upstasha.
- [ ] Prywatność: adres IP nie jest zapisywany w postaci jawnej ani w logach. Klucz licznika to hash z solą (`RATE_LIMIT_SALT`), TTL równy oknu. E-mail w kluczu także tylko jako hash.
- [ ] Odpowiedź 429: `{ error: ... }` bez szczegółów o progach, nagłówek `Retry-After`.
- [ ] Awaria limitera (Upstash niedostępny, brak zmiennych): fail-open (O-29 a): formularz działa bez limitu, błąd trafia do logu bez jawnego IP i e-maila. Lokalnie bez zmiennych limiter jest wyłączony i trasa działa jak dziś.
- [ ] STOP — przed dodaniem zależności pokaż diff `package.json` i `pnpm-lock.yaml` (tylko te dwie biblioteki i ich tranzytywne) i czekaj na akceptację.
- [ ] STOP — nie ustawiasz żadnych zmiennych w Vercelu ani nie zakładasz bazy w Upstashu; to robi tj w FA-1.45. Dopisz zmienne do `src/lib/env.ts` i do `.env.example`.

## Gotowe, gdy
- [ ] Test trasy: 6. żądanie z tego samego IP w oknie → 429 z `Retry-After`; `createInquiry`, `classifyInquiry`, `autoSendReply` i wysyłka maili nie są wywołane (asercje na mockach). **Pokazany na czerwono na kodzie z `main`** (tam odpowiedź to 201), potem zielony. Sprawdzenie: `pnpm exec vitest run src/app/api/inquiries`.
- [ ] Test: 4. żądanie na ten sam e-mail z różnych IP → 429 z tymi samymi asercjami; czerwony, potem zielony.
- [ ] Test: żądania poniżej progu przechodzą jak dziś, istniejące testy trasy zielone bez zmian.
- [ ] Test awarii limitera: adapter rzuca wyjątek → żądanie przechodzi jak bez limitu (201), błąd zalogowany bez jawnego IP i e-maila (fail-open, O-29).
- [ ] Klucze licznika i logi nie zawierają jawnego IP ani adresu e-mail — **jak sprawdzić:** test, że klucz przekazany adapterowi nie zawiera `@` ani wzorca IPv4/IPv6, oraz `git diff main...HEAD | grep -nE '^\+.*console\.(log|error).*(ip|email)'` bez trafień.
- [ ] `.env.example` istnieje i zawiera same nazwy zmiennych (istniejące z nagłówka `env.ts` + nowe) — **jak sprawdzić:** `git diff main...HEAD -- .env.example | grep -nE '=\S'` bez trafień.
- [ ] `pnpm typecheck && pnpm lint && pnpm exec vitest run && pnpm knip` zielone; brak nowych `as any`, `eslint-disable` i `.from(` poza warstwą danych.

## Poza zakresem
- Limit na `/api/events`, webhookach (`email-inbound`, Stripe) i pozostałych trasach → osobne zadanie, jeśli tj zdecyduje; webhook `email-inbound` woła `autoSendReply`, jego autoryzacji tu nie oceniamy → deferred.
- Powtórki z tego samego e-maila w oknie, dzienny sufit auto-wysyłek → FA-1.42.
- Honeypot i czas wypełnienia → FA-1.43.
- Przeniesienie klasyfikacji i auto-wysyłki poza żądanie (asynchronicznie, żeby formularz nie czekał na modele) → deferred, osobne zadanie.
- Reguły WAF w Vercelu → nie robimy (O-26: a).
- Zakładanie bazy Upstash i ustawianie zmiennych w Vercelu → FA-1.45, robi tj.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
- Dodanie zależności (`package.json`, lockfile) — pokaż diff i czekaj.
- Jakakolwiek zmiana zmiennych środowiskowych w Vercelu lub konfiguracji Upstasha — STOP, robi tj.
- Prawdziwe wywołania Upstasha z lokalnych testów — STOP; testy tylko na adapterze w pamięci.
- Merge do `main` = deploy na prod; PR otwarty z `--base main`.

## Weryfikacja
```
pnpm exec vitest run src/app/api/inquiries
pnpm typecheck && pnpm lint && pnpm knip
pnpm exec vitest run
```

## Notatki z realizacji
- 2026-10-02 tj: O-26 → Upstash Redis (współdzielone liczniki).
- 2026-10-02 tj: O-29 → a: fail-open przy awarii limitera.
- 2026-10-02 tj: progi startowe potwierdzone — IP 5 żądań / 10 min, e-mail 3 żądania / godzinę.
- 2026-10-02 tj: zgoda na przetwarzanie IP wyłącznie jako hash z solą (`RATE_LIMIT_SALT`), z TTL równym oknu.
- 2026-10-02 tj: zakres rozszerzony o utworzenie `.env.example` (na `main` nie istnieje) — same nazwy zmiennych, bez wartości; do „Gotowe, gdy” dochodzi sprawdzenie `git diff main...HEAD -- .env.example | grep -nE '=\S'` bez trafień.
- 2026-10-02 agent: `.env.example` jest dziś ignorowany przez git (`.gitignore:34`, wzorzec `.env*`; wyjątek jest tylko dla `.env.test`) — potrzebna linia `!.env.example` w `.gitignore`, inaczej plik nie wejdzie do PR.
- 2026-10-02 tj (decyzja 1): źródło IP klienta = `cf-connecting-ip` (Cloudflare proxy'uje fjordanglers.com — `curl -sI`: `server: cloudflare`, `cf-ray`). Przed oparciem się na nim agent potwierdza nagłówek w aktualnej dokumentacji Cloudflare i cytuje źródło w raporcie. Obejście `*.vercel.app` → `docs/deferred-tasks.md` (poprawka: sekretny nagłówek dodawany przez Cloudflare i sprawdzany w aplikacji, razem ze zmiennymi z FA-1.45).
- 2026-10-02 tj (decyzja 2): brak nagłówka IP (lokalnie, bezpośrednie wejście) → pomijamy tylko limit per IP, limit per e-mail działa dalej (fail-open, O-29). Na produkcji brak nagłówka loguje ostrzeżenie bez danych osobowych, żeby martwy limit IP był widoczny. Test obu gałęzi.
- 2026-10-02 tj (decyzja 3): biblioteki `@upstash/ratelimit` i `@upstash/redis` zatwierdzone. Lockfile nie może być łatą ręczną — CI przypina pnpm 10.30.3 (`.github/workflows/ci.yml`, `PNPM_VERSION`), maszyna ma 12.4.2 (stąd 1492 linie przepisane). Regeneracja pnpm-em 10.30.3, bez zmiany `packageManager` ani konfiguracji, dowód realnym `pnpm install --frozen-lockfile`. STOP: diff `package.json` + `pnpm-lock.yaml` ze statystyką do akceptacji przed jakimkolwiek kodem obsługi IP. „package.json bez przypiętego packageManager” → deferred.
- 2026-10-02 tj (decyzja 4): w `.gitignore` dodać `!.env.example` po regule `.env*` (linia 34) — to jedyna dozwolona zmiana `.gitignore`; `.env.example` tworzymy z samymi nazwami.
- 2026-10-02 tj (decyzja 5): dwa ograniczenia zostają jak zaprojektowane i trafiają do `docs/deferred-tasks.md` z id tego zadania: (a) cudzy adres e-mail można „wypalić” (3/godz.), (b) odpowiedzi 400 liczą się do limitu IP.
- 2026-10-02 tj (decyzja 6): nie zatrzymujemy ani nie ruszamy kontenerów innego projektu (Seaclouds); zadanie nie wymaga bazy, `pnpm build` nie wchodzi do weryfikacji.
- 2026-10-02 agent: potwierdzenie `cf-connecting-ip` w dokumentacji Cloudflare (context7, `/cloudflare/cloudflare-docs`, źródło: `fundamentals/reference/http-headers.mdx`): nagłówek „provides the client IP address connecting to Cloudflare to the origin”, zawsze dokładnie jeden adres, Cloudflare zaleca go zamiast `X-Forwarded-For`. Dokumentacja (w odczytanych fragmentach) nie stwierdza wprost, że nadpisuje wartość podaną przez klienta, i nie obejmuje żądań omijających Cloudflare — stąd wpis w deferred. Managed Transform „Remove visitor IP headers” usuwa ten nagłówek (wtedy zadziała gałąź „brak nagłówka” + ostrzeżenie).
- 2026-10-02 agent: lockfile wygenerowany `npx pnpm@10.30.3 add … --lockfile-only` w kopii roboczej: +36 / −0 linii (4 pakiety: `@upstash/ratelimit`, `@upstash/redis`, `@upstash/core-analytics`, `uncrypto`). Dowód: pełny `pnpm install --frozen-lockfile` (pnpm 10.30.3, bez `--lockfile-only` i bez `--ignore-scripts`) → exit 0, sha256 lockfile identyczny przed i po. Czeka na akceptację tj.
- 2026-10-02 tj: akceptacja zależności — `@upstash/ratelimit` 2.2.0 i `@upstash/redis` 1.39.0 oraz diffu `pnpm-lock.yaml` dokładnie jak pokazany (+36/−0, 4 pakiety). Pliki zastosowane, potem `pnpm install --frozen-lockfile` pnpm-em 10.30.3 (wersja z CI); jeśli lockfile zmieni się po instalacji — stop i diff. W PR statystyka diffu zależności ma brzmieć: `package.json` +2, `pnpm-lock.yaml` +36/−0.
- 2026-10-02 agent: po zastosowaniu plików `CI=true npx pnpm@10.30.3 install --frozen-lockfile` → exit 0; sha256 `pnpm-lock.yaml` po instalacji `c21a6020c3c867b7cdabfb0ee5a1365af59ab6527f6d6f33d586cdee6f86e13c`, identyczny z wygenerowanym; `git diff --stat`: package.json 2 ++, pnpm-lock.yaml 36 ++++. `node_modules` jest teraz zainstalowany przez pnpm 10.30.3 (`.modules.yaml`: `packageManager: pnpm@10.30.3`); ostrzeżenie „Failed to create bin … supabase” wynika z `ignoredBuiltDependencies` (skrypt budowania supabase zablokowany, jak w CI).
- 2026-10-02 agent: odczyt dokumentacji Vercel (context7, vercel.com/docs/headers/request-headers): `x-forwarded-for` jest na Vercelu nadpisywane i nie przekazuje IP z zewnątrz (brak podrabiania, chyba że klient Enterprise włączy trusted proxy); `x-real-ip` to IP wyliczone przez proxy Vercela (to je czyta `ipAddress()` z `@vercel/functions`); `x-vercel-forwarded-for` jest takie samo jak `x-forwarded-for`, ale nie jest nadpisywane, gdy przed Vercelem stoi własny proxy. Repo nie wspomina o proxy przed Vercelem (grep: brak `cloudflare`/`x-forwarded-for` poza `docs/04-open-questions.md`).
- 2026-10-02 agent: adapter Upstash używa `Ratelimit.fixedWindow`, nie `slidingWindow`. Powód (odczyt `node_modules/@upstash/ratelimit/dist/index.js`): skrypt okna stałego robi `PEXPIRE key window` przy pierwszym żądaniu koszyka — TTL równy oknu, jak zażądał tj; okno przesuwne ustawia `PEXPIRE currentKey window*2+1000` (TTL 2× okno + 1 s). Cena: licznik okna stałego pozwala na serię do 2× progu na styku dwóch koszyków (np. 5 + 5 żądań IP w kilkanaście sekund wokół granicy). Do decyzji tj, jeśli to ma znaczenie.
- 2026-10-02 agent: pierwsze `pnpm exec` (pnpm 12.4.2) po instalacji pnpm-em 10.30.3 uruchomiło samo instalację i padło na `ERR_PNPM_IGNORED_BUILDS`; `package.json` i `pnpm-lock.yaml` bez zmian (sha256 `c21a6020…86e13c` przed i po), kolejne `pnpm exec` działają. `node_modules` ma znacznik `pnpm@12.4.2`.
- 2026-10-02 agent: sprawdzenie `git diff main...HEAD -- .env.example | grep -nE '=\S'` NIE zostało wykonane przez agenta — polityka uprawnień odrzuca polecenia Bash i Read na ścieżkach `.env*`. Plik napisany przez agenta nie ma ani jednego znaku `=` (same nazwy i komentarze) — niezweryfikowane wykonaniem; tj uruchamia to polecenie sam (`! git diff origin/main...HEAD -- .env.example | grep -nE '=\S'`, brak trafień = OK).
- 2026-10-02 agent: dowody czerwono→zielono: A (bez implementacji) oba nowe zestawy padają na „Cannot find package '@/lib/rate-limit/memory'”; B (implementacja biblioteki, trasa z `origin/main` bez zmian) 6 z 9 testów trasy pada, w tym `expected 201 to be 429` dla 6. żądania z IP i 4. na e-mail; C (trasa podpięta) 35/35 zielone. Dodatkowo mutanty: klucz z surową wartością zamiast hasha → 3 testy czerwone; brak normalizacji e-maila → 2 testy czerwone.
- 2026-10-02 tj: okno stałe (`Ratelimit.fixedWindow`) zostaje — TTL licznika równy oknu; akceptujemy możliwą serię do 2× progu na styku koszyków. Bez zmian w kodzie.
- 2026-10-02 tj: nazwy zmiennych `UPSTASH_REDIS_REST_URL` i `UPSTASH_REDIS_REST_TOKEN` zostają; bazę tj zakłada ręcznie w konsoli Upstash w FA-1.45. Bez zmian w kodzie.
- 2026-10-02 tj: PR #122 zaakceptowany z uzupełnieniami (jedna krótka runda): (1) luka fail-open — nieudane utworzenie limitera nie może dawać 500; (2) dowody w opisie PR; (3) wiersz w `docs/deferred-tasks.md` o opóźnieniu przy awarii Upstasha + uwaga do FA-1.45 o adresie REST `https://`. Poza rundą: okno przesuwne, async klasyfikacja, obejście `*.vercel.app`, skracanie timeoutu.
- 2026-10-02 agent (uzupełnienie 1): sprawdzone na bibliotece — `@upstash/redis` 1.39.0 rzuca `UrlError` w konstruktorze dla `rediss://…`, spacji na początku/końcu i braku schematu (`http://` przechodzi); komunikat zawiera cały otrzymany adres, więc dla `rediss://default:<hasło>@…` także hasło. Przed poprawką `getRateLimiter()` wywoływane poza try/catch wyrzucało to z `POST /api/inquiries` (500). Poprawka w `factory.ts`: `try/catch` wokół utworzenia, jedna stała linia w logu bez tekstu błędu, wynik (null) zapamiętany. Czerwone na `8d22a70`: 7 testów (5 jednostkowych, 2 trasy: `UrlError` wyrzucony z `POST`), po poprawce 10/10 zielone. Błędy czasu wykonania (`UpstashError`) zawierają treść polecenia (nasz klucz-hash), nie adres ani token — bez zmian.
- 2026-10-02 tj: accepted after review of PR #122 — fail-open on client-creation failure fixed and covered (red on 8d22a70, green after b8dbf37); dependencies, .env.example (names only), .gitignore exception and deferred rows verified by reading the branch; the rest from the PR description.
