---
id: FA-0.06
title: requireAdmin() we wszystkich mutujących server actions (dziś 28 akcji w inquiries.ts bez sprawdzenia)
stage: 0
status: todo
difficulty: M
model: sonnet
model_approved:
effort: high
agent: fa-core
branch: fix/require-admin-actions
depends_on: []
blocked_by_questions: []
touches_db: false
touches_prod: false
estimate_h: 5
owner: tj
---

# FA-0.06 — Autoryzacja w server actions

## Kontekst — przeczytaj przed startem
- `CLAUDE.md` reguła 4, `docs/01-architecture.md` §2 „Guards before service role"
- `docs/audit/rebuild-audit-app-aug-2026.md` §5 — tabela audytu autoryzacji per moduł
- `src/actions/admin.ts` — wzorzec sprawdzania roli, który już działa (13 miejsc); z niego wyciągamy helper
- `src/actions/inquiries.ts` (1621 linii, 0 sprawdzeń) — trzy akcje są **guide-facing** (`respondToAssignment`, `saveGuideOfferEta`, `saveGuideOfferResponse`) i już używają `auth.getUser()`; reszta jest admin-only
- `src/actions/{ads,finances,experience-pages,messages,reviews,ai,offer-photos,review-media}.ts` — 0 sprawdzeń
- `src/actions/{availability,dashboard,guide-photos}.ts` — guide-facing; sprawdź, czy weryfikują, że `guides.user_id = user.id`
- Akcje wołane ze stron tokenowych (`acceptOffer`, `declineOffer`, `submitOfferAnswers`, `submitReview`, intake) — autoryzują **tokenem**, nie sesją; nie wolno im dodać `requireAdmin`

## Cel
Server actions są publicznie adresowalnymi endpointami. Dziś `deleteInquiry`, `updateInquiryStatus`, `saveInternalDeal`, `sendMessageToAngler`, `addAdCampaign`, `createExperiencePage` i kilkadziesiąt innych wykonuje zapisy service-role bez sprawdzenia, kto woła — ochroną jest wyłącznie layout. Po zadaniu każda mutacja zaczyna się od guarda odpowiedniego dla swojego aktora: admin, przewodnik (właściciel rekordu) albo token.

## Zakres
- [ ] Odczyt bieżącego stanu: dla każdego pliku w `src/actions/` — lista eksportowanych funkcji z oznaczeniem `admin | guide | token | public` (tabela w notatkach). Bez tej tabeli nie ruszaj kodu.
- [ ] `src/lib/auth/guards.ts`: `requireAdmin()` (z `admin.ts`), `requireGuide()` zwracający `{ user, guide }` po `guides.user_id`, `requireToken(kind, token)` dla ofert/recenzji/intake (sprawdza istnienie i `*_expires_at`). Każdy rzuca `UnauthorizedError`, nie zwraca `null`.
- [ ] Wstawienie właściwego guarda jako pierwszej linii każdej mutacji wg tabeli z odczytu. Guide-facing: guard ma też sprawdzać, że `inquiry.assigned_guide_id === guide.id` (albo odpowiedni klucz własności).
- [ ] Odczyty w server actions używane przez strony publiczne — bez zmian (nie zaszkodzić stronom wypraw i profilom).
- [ ] Testy Vitest: dla każdego pliku akcji co najmniej jedna mutacja wywołana bez sesji rzuca `UnauthorizedError` (**na czerwono**); jedna guide-facing z sesją innego przewodnika rzuca; jedna tokenowa z wygasłym tokenem rzuca.
- [ ] `docs/deferred-tasks.md`: wszystko, co przy okazji wygląda na martwe albo źle nazwane — zapisać, nie ruszać.

## Gotowe, gdy
- [ ] Skrypt/grep w raporcie: każda `export async function` w `src/actions/*.ts`, która zawiera `createServiceClient` lub `.insert|.update|.delete|.upsert`, ma w pierwszych 5 liniach ciała `await require(Admin|Guide|Token)` — lista wyjątków pusta albo uzasadniona jednym zdaniem każdy.
- [ ] Testy z zakresu przechodzą, przypadki „bez sesji / cudzy przewodnik / wygasły token" pokazane jako błędy.
- [ ] Ręcznie: admin nadal może zmienić status i wysłać ofertę; przewodnik nadal może zaakceptować przypisanie; strona `/offers/[token]` nadal działa (trzy zrzuty lub logi).
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` zielone.

## Poza zakresem
- Refaktor `inquiries.ts` na moduły — etap 2.
- Zmiany RLS w bazie — guardy są w warstwie akcji; RLS osobno (etap 1/4).
- Usuwanie martwych akcji (`bookings.ts`, `accommodations.ts`, `stripe-connect.ts`) — FA-1.07; tu ich **nie dotykaj**, nawet żeby dodać guard.
Jeśli coś z tej listy blokuje postęp, zatrzymaj się i zapytaj.

## Bramki STOP
brak (bez bazy). Jeśli odkryjesz akcję, której aktora nie da się ustalić z kodu — STOP, zapytaj, nie zgaduj.

## Weryfikacja
```
pnpm test -- guards actions
pnpm typecheck && pnpm lint && pnpm build
# tabela: plik · funkcja · aktor · guard obecny (T/N) — w raporcie
```

## Notatki z realizacji

