# FjordAnglers — Daily Progress Tracker

> Aktualizuj ten plik każdego dnia przed zakończeniem sesji.
> **Ostatnia aktualizacja:** 2026-03-07

---

## ⚡ ZACZNIJ OD TEGO JUTRO

```bash
cd ~/Desktop/fjordAnglers/web/fjordanglers
```

**Krytyczne przed kodowaniem:**
1. `pnpm supabase db push` — wypchnij migrację kalendarza dostępności (`20260307194815`)
2. Supabase Dashboard → SQL Editor → uruchom `supabase/migrations/20260308000000_fix_storage_guide_upload.sql` (fix RLS uploady przewodników)
3. `pnpm supabase:types && pnpm typecheck` — upewnij się że zero błędów

**Następny naturalny krok:** Phase 5 — booking flow po stronie anglera

---

## 📊 Stan ogólny

| Faza | Opis | Status |
|------|------|--------|
| Phase 1 | Publiczne strony (home, listing, guide profile) | ✅ Gotowe |
| Phase 2 | Auth (login, register, reset password) | ✅ Gotowe |
| Phase 3 | Dashboard przewodnika | ✅ Gotowe |
| Phase 4 | Experience CRUD (tworzenie/edycja) | ✅ Gotowe |
| Phase 5 | Booking flow — angler side + Stripe | ❌ Nie zaczęte |
| Phase 6 | Stripe webhooks + payouty | ❌ Nie zaczęte |
| Phase 7 | Panel admina | 🟡 Częściowo (brak: weryfikacja, invite email) |
| Phase 8 | Emaile transakcyjne (Resend) | ❌ Nie zaczęte |

---

## 🗂️ SEKCJE STRONY — szczegółowy stan

---

### 🏠 `/` — Strona główna
**Agent:** `experience-listings-agent`

#### ✅ Zrobione
- Hero: pełnoekranowa karta wideo (96vh), kremowy margines, search bar glassmorphism
- Nav: kapsuła pill (zawsze widoczna, ciemna nad video / kremowa po scrolu), hamburger na wszystkich rozmiarach, "Join as Guide" zawsze widoczne, dropdown wewnątrz kapsuły
- Featured Experiences: równa siatka 4 kart (real DB)
- Species Picker: 6-kolumnowa siatka z zdjęciami (real DB)
- How it Works: ciemna sekcja z 3 krokami
- Guide CTA: sekcja wideo "Are you a fishing guide?"
- Footer: 4-kolumnowy (Brand, Explore, Destinations, For Guides)

#### ❌ Brakuje
- SEO: structured data (JSON-LD), meta OG tags
- Animacje wejścia (opcjonalne)
- Mapa poglądowa Skandynawii (opcjonalne)

---

### 🎣 `/experiences` — Listing doświadczeń
**Agent:** `experience-listings-agent`

#### ✅ Zrobione
- Listing kart z filtrami (kraj, gatunek, cena, trudność)
- Nav: sticky 96px, Fjord Blue glass, centrowana pill-wyszukiwarka
- Filters modal z `createPortal` (fix: CSS stacking context z backdrop-filter)
- Modal zawiera: Sort, Price, Skill Level
- URL search params (country, fish, price, difficulty)
- Real DB queries

#### ❌ Brakuje
- Filtr "Duration" (half day / full day / multi-day)
- Paginacja (aktualnie brak)
- Map view (przełącznik lista ↔ mapa)
- Sortowanie po dacie dostępności

---

### 🗺️ `/experiences/[id]` — Szczegóły doświadczenia
**Agent:** `booking-flow-agent`

#### ✅ Zrobione
- Galeria zdjęć, opis, informacje o przewodniku
- Draft preview dla przewodnika (pomarańczowy baner "draft")
- Zabezpieczenie: nieopublikowane → 404 dla publicznych

#### ❌ Brakuje
- **Booking sidebar** (wybór daty, liczba osób, CTA → Stripe) ← **Phase 5**
- Sekcja "More from this guide"
- Sekcja reviews (post-MVP)
- SEO structured data (TouristAttraction, AggregateRating)

---

### 👤 `/guides` — Listing przewodników
**Agent:** `experience-listings-agent`

#### ✅ Zrobione
- Karty przewodników z filtrami (kraj, ryba, język)
- Real DB queries

#### ❌ Brakuje
- Mapa z pinezkami przewodników
- Filtr "Available now"

---

### 👤 `/guides/[id]` — Profil przewodnika
**Agent:** `experience-listings-agent`

#### ✅ Zrobione
- Profil z doświadczeniami, bio, zdjęciami
- Real DB queries

#### ❌ Brakuje
- Contact form (dla tier Listing bez bookingu)
- SEO: Person structured data

---

### 🗺️ `/license-map` — Mapa licencji
**Agent:** (brak dedykowanego — Krzychu dostarcza dane)

#### ❌ Brakuje (cała strona)
- Interaktywna mapa Skandynawii (Mapbox lub Leaflet)
- Strefy wędkarskie per kraj
- Info: gdzie kupić licencję, gatunki, sezony
- **Kluczowa strona SEO** — "fishing license Norway tourist"

---

### 📅 `/dashboard/calendar` — Kalendarz przewodnika
**Agent:** `booking-flow-agent`

#### ✅ Zrobione
- Miesięczna siatka (pn–nd) z kolorowaniem dni
- Multi-pick: tryb "Select days" → blokowanie wielu dni naraz
- Pending (bursztynowy) vs Confirmed (niebieski) bookings
- 5-elementowa legenda, ESC chain (multi-modal → day modal → exit)

#### ❌ Brakuje
- Podpięcie pod real DB (bookings)
- Blokowanie dat przez availability config

---

### ⚙️ `/dashboard/experiences/[id]/availability`
**Agent:** `booking-flow-agent`

#### 🟡 Gotowe w DB, brakuje UI
- Migracja `20260307194815` — tabele `experience_availability_config` + `experience_blocked_dates`
- RLS policies, trigger, TypeScript types
- **⚠️ Migracja jeszcze nie na Supabase** — `pnpm supabase db push`

#### ❌ Brakuje (cały UI)
- `availability-form.tsx` — miesiące dostępne (pill 1-12), dni tygodnia (Mon-Sun), advance notice, slots/day, start_time
- `addBlockedDateRange()` / `removeBlockedDateRange()` actions
- Integracja z kalendarzem dashboard

---

### 🔐 `/login`, `/register`, `/forgot-password`, `/reset-password`
**Agent:** `guide-onboarding-agent`

#### ✅ Gotowe (kompletne)

---

### 📊 `/dashboard/*` — Dashboard przewodnika
**Agent:** `guide-onboarding-agent`

#### ✅ Zrobione
- Overview: stats (revenue, bookings), upcoming bookings, quick list experiences
- Profil: wyświetlanie + edycja (zdjęcia, bio, expertise, social)
- Experiences: lista kart + statystyki
- Bookings: pełna tabela + statystyki
- Earnings: stats + 6-miesięczny wykres + per-experience breakdown
- Onboarding wizard (2-step) dla nowych przewodników
- Upload zdjęć z auto-kompresją Canvas API (telefon 12MB → ~400KB)

#### ❌ Brakuje
- Stripe Connect onboarding (wypłaty) ← Phase 5/6
- Powiadomienia o nowych rezerwacjach

---

### 🛒 Booking flow (angler side)
**Agent:** `booking-flow-agent`

#### ❌ Brakuje (cały Phase 5)
- Strona experience → booking sidebar (data, osoby, cena)
- Wybór daty z kalendarza dostępności
- Stripe Checkout lub Elements
- Potwierdzenie po płatności
- Email confirmation (Resend)

---

### 💳 Stripe webhooks
**Agent:** `booking-flow-agent`

#### ❌ Brakuje (Phase 6)
- `/api/stripe/webhook` — obsługa `payment_intent.succeeded`
- Auto-transfer do przewodnika (Stripe Connect)
- Obsługa anulowania + refundy
- Kalkulacja: flat fee vs 10% komisja vs 8% Founding

---

### 🔧 `/admin/*` — Panel admina
**Agent:** `guide-onboarding-agent`

#### ✅ Zrobione
- Overview, lista przewodników (z is_beta_listing), lead pipeline
- Szczegóły przewodnika + tworzenie experiences dla beta listings
- Tworzenie beta guide z uplodem zdjęć
- Lead bridge: DM lead → "Create Listing" → auto-pre-fill formularza

#### ❌ Brakuje
- `/admin/guides/pending` — weryfikacja przewodników
- Invite email przez Resend (gdy guide się rejestruje)
- Publish toggle na listingach z poziomu admina

---

### 📧 Emaile (Resend)
**Agent:** `guide-onboarding-agent`

#### ❌ Brakuje (Phase 8)
- Welcome email po rejestracji
- Email potwierdzający booking (angler + guide)
- Invite email do beta listings
- Przypomnienie o bookingu (24h przed)

---

## 🏃 Proponowana kolejność pracy

```
1. [KRYTYCZNE] db push + fix storage RLS
2. Phase 5 — booking flow (/experiences/[id] sidebar + Stripe)
3. Phase 6 — Stripe webhooks
4. /admin/guides/pending — weryfikacja
5. Phase 8 — emaile (Resend)
6. /license-map — mapa licencji (Krzychu dostarcza dane)
7. SEO pass — structured data, sitemap, meta OG
8. Dostępność UI (/dashboard/experiences/[id]/availability)
```

---

## 📁 Kluczowe pliki

| Plik | Opis |
|------|------|
| `src/app/page.tsx` | Strona główna |
| `src/app/experiences/page.tsx` | Listing experiences |
| `src/app/experiences/[id]/page.tsx` | Szczegóły experience |
| `src/app/guides/[id]/page.tsx` | Profil przewodnika |
| `src/app/dashboard/layout.tsx` | Layout dashboard (onboarding guard) |
| `src/app/admin/layout.tsx` | Layout admin (role guard) |
| `src/middleware.ts` | Session refresh + ochrona /dashboard i /admin |
| `src/lib/supabase/queries.ts` | Wszystkie publiczne query |
| `src/actions/experiences.ts` | CRUD doświadczeń |
| `src/actions/auth.ts` | signIn, signUp, signOut, resetPassword |
| `src/actions/admin.ts` | createBetaGuide, updateLeadStatus |
| `src/components/home/home-nav.tsx` | Kapsuła nawigacyjna homepage |
| `supabase/migrations/` | Wszystkie migracje DB |
