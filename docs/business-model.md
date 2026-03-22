# FjordAnglers — Business Model

> Aktualizacja: 2026-03-20

---

## Problem

Wędkarze z Europy Środkowej (Polska, Niemcy, Czechy) napotykają:

1. **Bariera językowa** — skandynawscy przewodnicy rzadko mają angielskojęzyczną obecność online
2. **Skomplikowane zasady licencji** — licencje wędkarskie w Norwegii/Szwecji/Finlandii różnią się wg strefy, gatunku i sezonu
3. **Brak platformy discovery** — przewodnicy rozproszeni po lokalnych grupach Facebook i poczcie pantoflowej
4. **Brak zarządzania z jednego miejsca** — przewodnicy nie mają narzędzi do obsługi rezerwacji, kalendarza i komunikacji

---

## Rozwiązanie

Anglojęzyczny **marketplace** łączący wędkarzy z Europy Środkowej ze skandynawskimi przewodnikami.

Trzy filary:
- **Profile przewodników** — odkryj, porównaj i zweryfikuj przewodnika
- **Strony tripów** — przeglądaj bookable trips z opcjami długości i ceną
- **Inquiry flow** — zapytania o niestandardowe tripy z ofertowaniem przez przewodnika

---

## Pozycja prawna

**FjordAnglers to platforma reklamowa i discovery — NIE agencja turystyczna.**

- Umowa na usługę wędkarską jest **zawsze między wędkarzem a przewodnikiem** bezpośrednio
- FjordAnglers nie sprzedaje, nie organizuje ani nie pakietuje usług turystycznych
- FjordAnglers świadczy **widoczność + facilitację płatności** jako usługę B2B dla przewodników
- Pozycjonuje FjordAnglers poza zakresem **Dyrektywy UE o imprezach turystycznych (2015/2302)**

---

## Model przychodów

### Dwa strumienie: komisja od guide'a + service fee od anglera

Każdy guide na FjordAnglers ma bookable tripy. FjordAnglers pobiera komisję od przewodnika **oraz** service fee od wędkarza.

| | |
|---|---|
| **Komisja guide'a** | 10% wartości tripu (odliczane od wypłaty guide'a) |
| **Service fee anglera** | 5% doliczane do ceny widocznej przez wędkarza |
| **Mechanizm** | Stripe Connect — `application_fee_amount` (komisja + service fee) |
| **Guide jest** | Merchant of record (przez Stripe Connect Express) |
| **Wypłata** | Automatyczny transfer na konto Stripe guide'a (po odliczeniu komisji) |

---

### Founding Guide (pierwsze 50 rejestracji)

| | |
|---|---|
| **Komisja guide'a** | **8%** przez pierwsze 24 miesiące od rejestracji (service fee 5% bez zmian) |
| **Po 24 miesiącach** | Standardowe 10% automatycznie |
| **Cel** | Zbudowanie supply-side przed launche'm |

---

## Dwa typy bookingu

Przewodnik wybiera model dla każdego tripu (`experiences.booking_type`):

### `direct` — Instant Booking
- Wędkarz płaci od razu przez Stripe Elements
- Rezerwacja tworzy się automatycznie po płatności
- **Flow:** angler wybiera datę → płaci → booking `confirmed`

### `icelandic` — Price on Request
- Wędkarz wysyła zapytanie z detalami tripu
- Przewodnik przegląda i wysyła ofertę z ceną
- Wędkarz akceptuje i płaci przez Stripe Checkout
- **Flow:** inquiry → offer_sent → offer_accepted → payment → `confirmed`

### `both`
- Dostępne oba modele jednocześnie

---

## Kalkulacja ceny (implementacja)

```typescript
// src/lib/pricing.ts
const guideRate = Number(env.PLATFORM_COMMISSION_RATE)  // 0.10 lub 0.08
const serviceFeeRate = 0.05

const guideFeeEur = Math.round(tripPriceEur * guideRate * 100) / 100
const serviceFeeEur = Math.round(tripPriceEur * serviceFeeRate * 100) / 100
const anglerTotalEur = tripPriceEur + serviceFeeEur
const guidePayoutEur = tripPriceEur - guideFeeEur
const platformRevenueEur = guideFeeEur + serviceFeeEur
```

---

## Polityka anulowania

Przewodnik wybiera jeden preset podczas onboardingu:

| Polityka | Bezpłatne anulowanie | Po oknie |
|---|---|---|
| **Flexible** | 7 dni przed tripem | Brak zwrotu |
| **Moderate** | 14 dni przed tripem | Brak zwrotu |
| **Strict** | 30 dni przed tripem | Brak zwrotu |

**Weather Guarantee** (admin-triggered): pełny zwrot dla wędkarza.

---

## Rynek docelowy

**Strona popytowa (wędkarze):**
- Główna: polscy, niemieccy, czescy wędkarze w wieku 30–55 lat
- Wtórna: brytyjscy i skandynawscy wędkarze

**Strona podażowa (przewodnicy):**
- Norwescy, szwedzcy, fińscy i islandzcy przewodnicy wędkarscy
- Znajdowani głównie na Instagramie (potwierdzony wskaźnik odpowiedzi 50%+)

**Gatunki docelowe:** Łosoś, Troć, Szczupak, Okoń, Sandacz, Pstrąg arktyczny
