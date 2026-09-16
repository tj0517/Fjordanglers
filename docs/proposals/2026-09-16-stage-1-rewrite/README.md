# Propozycja: przepisanie etapu 1 pod rzeczywisty przepływ leada

Data: 2026-09-16. Autor: Claude (Cowork) na podstawie rozmowy z tj. Status: **wprowadzone 2026-09-16** po decyzjach tj (O-14, O-15 resolved; oferty jako `offers`+`offer_options`; klient dwutorowo mail+WA) —
pliki źródłowe zaktualizowane; ten folder zostaje jako zapis uzasadnienia.

## Dlaczego
Model z `01-architecture.md` §4 i FA-1.03 zakłada, że system wykonuje proces (wysyła oferty
z buildera, generuje checkout Stripe, przewodnik odpowiada w portalu). W praktyce (stan na
16 IX): zero ofert wysłanych przez `sendOfferEmail`, wszystkie wpłaty przez ręczne payment
linki ze Stripe (omijają webhook, bo brak `metadata.inquiry_id`), rozmowy z przewodnikami na
WhatsAppie/Instagramie, z klientami na mailu i WhatsAppie, każda wiadomość pisana z pomocą AI
na podstawie screenów. Rejestrator zdarzeń wpięty w nieużywane akcje zbierałby fikcję.

## Decyzje tj (16 IX)
- Cel etapu 1: **aplikacja jest jedynym miejscem, z którego czyta się i wysyła** komunikację
  z klientem i przewodnikiem. Żadnego kroku „zaimportuj/dopisz potem" — zdarzenia powstają
  jako skutek wysyłki i odbioru.
- Kanały: e-mail + WhatsApp działające; Instagram zbudowany jako adapter kanału, ale bez
  kluczy do czasu weryfikacji Meta — **nie jest blokerem**.
- Wątek wiadomości: **nowa tabela `messages`**, `lead_messages` i `inquiry_messages`
  migrowane do niej i dropowane (zgodne z `02-data-model.md` §docelowy).
- Dostawa: gałąź `stage-1` + gałąź podglądowa Supabase; zadania jako osobne PR-y do
  `stage-1`; **jeden `db push` i jeden deploy na końcu**, po przeszkoleniu zespołu.

## Co jest w tym folderze
| Plik | Zastępuje |
|---|---|
| `01-architecture-s3-s4.md` | `docs/01-architecture.md` §3 i §4 |
| `REBUILD_PLAN-etap-1.md` | `docs/REBUILD_PLAN.md` §8 „Etap 1" + dopisek do §9 |
| `REBUILD_PLAN-zalacznik-C.md` | `docs/REBUILD_PLAN.md` załącznik C |
| `tasks/FA-1.03.md` | `docs/tasks/FA-1.03.md` (przepisane) |
| `tasks/FA-1.12.md` … `FA-1.14.md` | nowe zadania |
| `tasks/INDEX-diff.md` | zmiany w `docs/tasks/INDEX.md` |
| `04-open-questions-add.md` | nowe wiersze O-14…O-16 |

## Do potwierdzenia przez tj przed wprowadzeniem
1. Nazwy statusów (`new, qualifying, waiting_guide, offer_presented, awaiting_payment, paid,
   handed_over, completed, lost, cancelled`) — czy to Wasze słownictwo? Zmiana nazw jest tania
   teraz, droga po migracji.
2. Czy stare statusy mapują się tak, jak w `01-architecture-s3-s4.md` (tabela mapowania).
3. Czy `handed_over` (kontakty wymienione) ma być statusem, czy tylko zdarzeniem.
