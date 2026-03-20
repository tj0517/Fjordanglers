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

Cztery filary:
- **Profile przewodników** — odkryj, porównaj i zweryfikuj przewodnika
- **Strony tripów** — przeglądaj bookable trips z opcjami długości i ceną
- **Inquiry flow** — zapytania o niestandardowe tripy z ofertowaniem przez przewodnika
- **License Map** — interaktywna mapa stref wędkarskich z linkami "gdzie kupić"

---

## Pozycja prawna

**FjordAnglers to platforma reklamowa i discovery — NIE agencja turystyczna.**

- Umowa na usługę wędkarską jest **zawsze między wędkarzem a przewodnikiem** bezpośrednio
- FjordAnglers nie sprzedaje, nie organizuje ani nie pakietuje usług turystycznych
- FjordAnglers świadczy **widoczność + facilitację płatności** jako usługę B2B dla przewodników
- Pozycjonuje FjordAnglers poza zakresem **Dyrektywy UE o imprezach turystycznych (2015/2302)**

---

## Model przychodów

### Jeden model: komisja od transakcji

Każdy guide na FjordAnglers ma bookable tripy. FjordAnglers pobiera komisję od każdej płatności.

| | |
|---|---|
| **Standardowa komisja** | 10% wartości tripu |
| **Mechanizm** | Stripe Connect — `application_fee_amount` automatycznie odliczany |
| **Guide jest** | Merchant of record (przez Stripe Connect Express) |
| **Wypłata** | Automatyczny transfer na konto Stripe guide'a |

---

### Founding Guide (pierwsze 50 rejestracji)

| | |
|---|---|
| **Komisja** | **8%** przez pierwsze 24 miesiące od rejestracji |
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
const rate = Number(env.PLATFORM_COMMISSION_RATE)  // 0.10 lub 0.08
const platformFeeEur = Math.round(totalEur * rate * 100) / 100
const guidePayoutEur = totalEur - platformFeeEur
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
- Norwescy, szwedzcy, fińscy przewodnicy wędkarscy
- Znajdowani głównie na Instagramie (potwierdzony wskaźnik odpowiedzi 50%+)

**Gatunki docelowe:** Łosoś, Troć, Szczupak, Okoń, Sandacz, Pstrąg arktyczny
