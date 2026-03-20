# FjordAnglers — Business Model (v3)

> Updated: 2026-03-13 · Removed Tier 1 (contact-only). Every guide gets booking. Two payment options.

---

## Problem

Anglers from Central Europe (Poland, Germany, Czech Republic) struggle with:

1. **Language barriers** — Scandinavian guides rarely have English-friendly online presence
2. **Complex license rules** — Fishing licenses in Norway/Sweden/Finland vary by zone, species, and season
3. **No unified discovery platform** — guides are scattered across local Facebook groups and word of mouth
4. **Booking flow work on mailing** - there is a little options for guides to mannage all fro. one place and for custommer to compare and bookg fast offers

---

## Solution

A unified **English-speaking marketplace** connecting Central European anglers with Scandinavian fishing guides.

Three core features:
- **Guide profiles** — discover, compare, and trust-verify guides (with external reviews from Google, etc.)
- **Trip pages** — browse bookable trips with duration options and group-size pricing
- **License Map** — interactive map of fishing zones with "where to buy" links
- **Acount system**- dashboards with calendar for guides and booking dash for anglers with chat for guides.


---

## Legal Foundation

**FjordAnglers is an advertising and discovery platform — not a travel agency.**

This distinction is critical for EU/EEA compliance:

- The fishing service contract is **always between the angler and the guide** directly.
- FjordAnglers never sells, organizes, or packages travel services.
- FjordAnglers provides **visibility + booking facilitation** as a B2B service to guides.
- This positions FjordAnglers outside the scope of the **EU Package Travel Directive (2015/2302)**, which would otherwise impose significant liability for cancellations, refunds, and insolvency protection.

All platform Terms of Service must clearly state:

> "FjordAnglers is an advertising and payment facilitation platform. Any agreement for fishing guide services is made directly between the angler and the guide. FjordAnglers is not a party to this agreement and bears no liability for the fishing service itself."

---

## Revenue Model

### Every guide gets booking — no contact-only tier

All guides on FjordAnglers have bookable trip pages. The guide chooses one of two payment options:

---

### Option A — Full Platform Pay (Stripe Connect)

| | |
|---|---|
| **Commission** | 10% of total trip price |
| **How it works** | Angler pays via Stripe. 30% deposit at booking, 70% balance 14 days before trip. |
| **Guide setup** | Stripe Connect Express account required |
| **Guide is** | Merchant of record (via Stripe Connect) |
| **FjordAnglers takes** | 10% application fee via Stripe |
| **Refunds** | Full refund possible (deposit + balance). Platform handles processing. |
| **Weather Guarantee** | Full trip refund (admin-triggered) |

**Best for:** Guides who want hands-off payment processing and maximum trust signals for anglers.

**Payment flow:**
1. Angler books → pays 30% deposit via Stripe → guide's Stripe Connect account
2. 14 days before trip → 70% balance auto-charged → guide's Stripe Connect account
3. FjordAnglers' 10% deducted automatically as Stripe application fee

---

### Option B — Booking Fee (No Stripe for Guide)

| | |
|---|---|
| **Fee** | 15% of trip price (8% commission + 7% service fee) |
| **How it works** | Angler pays 15% booking fee to FjordAnglers at booking. Full trip price paid directly to guide (cash/bank transfer on trip day). |
| **Guide setup** | No Stripe needed |
| **Guide is** | Seller — receives full payment directly from angler |
| **FjordAnglers takes** | 15% booking fee (kept entirely by FjordAnglers) |
| **Refunds** | Booking fee refundable per cancellation policy. Trip price is between angler and guide — not platform's responsibility. |
| **Weather Guarantee** | Booking fee refund only. Trip price refund is guide's responsibility. |

**Best for:** Guides who prefer cash/transfer payments, or who don't want to set up Stripe. Lower onboarding barrier.

**Payment flow:**
1. Angler books → pays 15% booking fee to FjordAnglers via Stripe (FjordAnglers is merchant)
2. Angler pays full trip price directly to guide on trip day (cash or bank transfer)
3. FjordAnglers keeps the entire 15% booking fee

**Key difference:** In Option B, the booking fee is NOT a deposit on the trip price. It's a separate service fee for using the platform. The angler pays the full trip price to the guide on top of the booking fee.

---

### Founding Guide Offer (First 50 Signups)

| | |
|---|---|
| **Offer** |  **8% commission** (instead of 10%) for Option A
| **Duration** | Reduced rate applies for the **first 24 months** from signup date |
| **After 24 months** | Standard rates apply automatically |
| **Goal** | Build supply-side credibility for launch |

**Why time-boxed (not "lifetime"):**
- Avoids open-ended financial commitment that's hard to change later
- 24 months is generous — covers the full growth phase
- Clear end date simplifies accounting and legal obligations
- Guides still get a meaningful, long-term benefit

---

## Cancellation Policy

Guides choose one preset during onboarding:

| Policy | Free cancellation window | After window |
|---|---|---|
| **Flexible** | 7 days before trip | No refund |
| **Moderate** | 14 days before trip | No refund |
| **Strict** | 30 days before trip | No refund |

**Weather Guarantee** (platform-level, admin-triggered):
- Option A: Full refund of deposit + balance
- Option B: Booking fee refund only. Trip price refund is guide's responsibility.

---

## Pricing Implementation Notes (for dev)

```
// Option A — Full Platform Pay
platform_fee = trip_price * guide.commission_rate  // 0.10 standard, 0.08 founding
guide_payout = trip_price - platform_fee
// Stripe Connect handles split via application_fee_amount

// Option B — Booking Fee
booking_fee = trip_price * guide.booking_fee_rate  // 0.15 standard, 0.12 founding
// FjordAnglers charges booking_fee directly (FjordAnglers is merchant)
// Guide receives full trip_price from angler directly (cash/transfer)
```

### Database fields

```sql
guides.payment_mode           TEXT CHECK ('full_platform', 'booking_fee') DEFAULT 'booking_fee'
guides.commission_rate        DECIMAL(3,2)  -- 0.10 or 0.08 (Option A)
guides.booking_fee_rate       DECIMAL(3,2)  -- 0.15 or 0.12 (Option B)
guides.has_stripe_connected   BOOLEAN DEFAULT false
guides.stripe_account_id      TEXT          -- required for full_platform only
guides.is_founding_guide      BOOLEAN
guides.founding_date          TIMESTAMP     -- used to calculate 24-month window
guides.founding_expires_at    TIMESTAMP     -- auto-calculated: founding_date + 24 months
```

### Commission rate logic

```typescript
function getCommissionRate(guide: Guide): number {
  const isFounding = guide.is_founding_guide && new Date() < guide.founding_expires_at;

  if (guide.payment_mode === 'full_platform') {
    return isFounding ? 0.08 : 0.10;
  } else {
    // booking_fee mode
    return isFounding ? 0.12 : 0.15;
  }
}
```

---

## Target Market

**Demand side (anglers):**
- Primary: Polish, German, Czech anglers aged 30–55
- Secondary: UK and Scandinavian anglers

**Supply side (guides):**
- Norwegian, Swedish, Finnish fishing guides
- Found primarily on Instagram (50%+ DM response rate confirmed in testing)

**Target species:** Salmon, Trout, Pike, Perch, Zander, Arctic Char

---

## Key Legal To-Dos (Pre-Launch)

- [ ] Draft platform Terms of Service establishing FjordAnglers as advertising/discovery platform
- [ ] Draft Guide Agreement (B2B service contract covering both payment options)
- [ ] Include clear "FjordAnglers is not a party to the booking" language in all user-facing copy
- [ ] Set up Stripe Connect Express with guides as merchant of record (Option A)
- [ ] Set up FjordAnglers as direct Stripe merchant for booking fee collection (Option B)
- [ ] Consult with accountant on VAT obligations for cross-border B2B services (EU + Norway)
- [ ] Define and publish cancellation/refund policy framework (3 presets + Weather Guarantee)
- [ ] Clarify Weather Guarantee terms for Option B (booking fee refund only vs full refund)
