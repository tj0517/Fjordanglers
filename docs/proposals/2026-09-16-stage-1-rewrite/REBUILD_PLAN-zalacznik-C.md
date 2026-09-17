## Załącznik C — katalog typów zdarzeń (etap 1)

Minimalny zestaw pokrywający **to, co dziś naprawdę się dzieje**. Każde zdarzenie ma
`channel` (gdzie) i `source` (jak trafiło do bazy). Zdarzenie powstaje jako skutek akcji
w aplikacji — nigdy jako osobny krok „dopisz".

| Typ | Aktor | Kanał | Emitowany w | Zasila |
|---|---|---|---|---|
| `inquiry.created` | system / admin | app | `core.inquiries.create` | M5, M7, M9b |
| `inquiry.qualified_set` | agent / admin | app | klasyfikacja + korekta (FA-1.04) | M5, M6 |
| `message.sent` | admin (tekst: admin lub agent) | email / whatsapp / instagram | wysyłka z wątku; `payload.counterpart`, `payload.drafted_by` | M11, M12, czas odpowiedzi |
| `message.received` | angler / guide | email / whatsapp / instagram | webhooki + dopasowanie z `unmatched_messages` | czas odpowiedzi, M10 |
| `guide.contacted` | admin | j.w. | pierwsza wiadomość wychodząca do danego przewodnika w tym zapytaniu (pochodna `message.sent`) | M10 (start zegara przewodnika) |
| `guide.offer_received` | guide | j.w. | admin oznacza wiadomość przychodzącą od przewodnika jako „to jest oferta" (jedno kliknięcie w wątku, zapisuje cenę/termin) | M10 odcinek 2 |
| `offer.presented` | admin | j.w. | wiadomość wychodząca do klienta oznaczona „przedstawia ofertę" | M7, M10 |
| `offer.accepted` / `offer.declined` | angler | j.w. | admin oznacza odpowiedź klienta; `declined` → `inquiry.lost` | M7 |
| `payment.link_sent` | admin | stripe | link generowany **z aplikacji** (Stripe Payment Link API z `metadata.inquiry_id`) i wklejany do wiadomości w wątku | M11 |
| `payment.received` | system | stripe | webhook `checkout.session.completed` / `payment_link` z `metadata.inquiry_id`; awaryjnie `UnmatchedLinker` (source=app) | M1, M2, M3, M7 |
| `guide.notified_paid` | admin | j.w. | wiadomość do przewodnika oznaczona „poinformowano o wpłacie" | M11 |
| `contacts.exchanged` | admin | j.w. | wiadomości z numerami do obu stron (jedna akcja w wątku) | hand-over |
| `status.changed` | admin / system | app | `transition()` | lejek, `stage_reached` |
| `inquiry.lost` | admin | app | `transition(lost)` z `lost_reason_code` | powody przegranych |
| `trip.completed` | admin / system | app | data zakończenia | M14–M16 |

Zarezerwowane, bez emisji w etapie 1 (w `types.ts` z komentarzem `// stage N`):
`agent.round_completed`, `inquiry.brief_completed`, `guide.assigned`/`unassigned`,
`guide.accepted`/`declined`, `offer.viewed`, `review.requested`/`submitted`,
`incident.opened`/`resolved`.

Usunięte z katalogu (brak odpowiednika w rzeczywistym procesie): `offer.created`,
`offer.updated`, `offer.sent` (builder ofert i `sendOfferEmail` nie są używane),
`deposit.link_sent`/`deposit.paid` (zastąpione `payment.*`).

**Ręczne dotknięcie** = zdarzenie `actor_kind='admin'` typu `message.sent`,
`status.changed`, `payment.link_sent`, `contacts.exchanged`. M11 = liczba takich zdarzeń
na zapytanie zakończone wpłatą.
