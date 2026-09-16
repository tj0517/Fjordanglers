### Etap 1 — jedno miejsce na rozmowę + schemat mówi prawdę (gałąź `stage-1`, jeden push)

Cel: **aplikacja jest jedynym miejscem, z którego czyta się i wysyła komunikację z klientem
i przewodnikiem**, a każda wysyłka/odbiór/decyzja zostawia zdarzenie. Bez tego agent nie
ma kontekstu, a metryki czasu nie mają danych. Zero kroków „zaimportuj później".

Dostawa: cała praca na gałęzi `stage-1` i gałęzi podglądowej Supabase. Zadania to osobne
PR-y do `stage-1` z osobnym review. Produkcja dostaje **jedną paczkę** (`db push` +
deploy) po zakończeniu wszystkich zadań i przeszkoleniu zespołu. Hotfixy produkcji w tym
czasie: tylko z `main`, cherry-pick do `stage-1` w tym samym dniu.

1. `supabase db pull` → baseline (FA-1.01, done).
2. `drop_marketplace_leftovers` (FA-1.02).
3. **Maszyna stanów wg §4 + `inquiry_events` + `transition()`** (FA-1.03) — statusy
   „na kogo czekamy", luźne pętle, ścisła ścieżka pieniędzy.
4. **`messages` + wątek na karcie zapytania + e-mail w obie strony** (FA-1.12) — migracja
   `lead_messages`/`inquiry_messages`, wysyłka z wątku, oznaczanie wiadomości jako
   oferta/akceptacja/wpłata, link Stripe generowany z aplikacji.
5. **WhatsApp w obie strony + adapter Instagram bez kluczy** (FA-1.13) — Meta Cloud API,
   szablony na okno 24 h, dopasowanie nieznanych numerów.
6. **Agent w wątku** (FA-1.14) — propozycja odpowiedzi na podstawie całego wątku i bazy
   wiedzy (przewodnicy, oferty, lokacje); admin edytuje i wysyła; auto-wysyłka wyłączona.
7. `inquiries.qualified` (FA-1.04), backfill zdarzeń (FA-1.05), typy (FA-1.06 done),
   martwy kod (FA-1.07/1.08), legacy edytor (FA-1.09), przegląd tygodniowy (FA-1.10),
   CI (FA-1.11).

Tag `v1-clean` po pushu.

#### Dopisek do §9 (ścieżka minimalna do 30 IX)
Etap 1 w nowym kształcie nie zmieści się przed 30 IX i nie próbuje. Do 30 IX na
produkcji zostaje etap 0. `stage-1` idzie na produkcję jako paczka, gdy FA-1.03, 1.12,
1.13 są `done` i zespół przeszedł wdrożenie; FA-1.14 może dojechać w drugiej paczce.
