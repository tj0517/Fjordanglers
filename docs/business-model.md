# FjordAnglers — Business Model

> Source: `head/one-pager.pdf` + `head/brand-bible.pdf`

---

## Problem

Anglers from Central Europe (Poland, Germany, Czech Republic, etc.) struggle with:
1. **Language barriers** — Scandinavian guides rarely speak English fluently online
2. **Complex license rules** — Fishing licenses in Norway/Sweden/Finland vary by zone, species, and season
3. **No unified discovery platform** — guides scattered across local Facebook groups, word of mouth

---

## Solution

A unified **English-speaking marketplace** connecting Central European anglers with Scandinavian fishing guides.

Two core features:
- **Guide profiles** — discover, contact, and book guides
- **License Map** — interactive map of zones with "where to buy" links

---

## Revenue Model

### Tier 1 — Listing (Contact Form)
- **20 EUR / month**
- Guide gets a public profile + contact form
- No booking management, no payments
- Best for: guides who prefer to handle bookings themselves

### Tier 2 — Bookable (Full Platform)
- **10% commission per booking** (no monthly fee)
- Full booking flow via Stripe Connect
- Platform handles payments + guide payouts
- Best for: guides wanting hands-off payment management

### Founding Guide Offer (First 50 signups)
- **3 months free**
- **8% lifetime commission** (instead of 10%)
- Goal: build supply-side credibility for launch

---

## Pricing Implementation Notes (for dev)

```
platform_fee = booking.total_eur * 0.10   // or 0.08 for founding guides
guide_payout = booking.total_eur - platform_fee
```

- Stripe Connect handles guide payouts automatically
- `guides.pricing_model` enum: `'flat_fee' | 'commission'`
- `guides.stripe_account_id` — required for Tier 2
- Founding guide status → custom field needed (TODO: add to DB)

---

## Target Market

**Primary:** Polish, German, Czech anglers aged 30–55
**Secondary:** UK and Scandinavian anglers

**Target guides:** Norwegian, Swedish, Finnish fishing guides, primarily found on Instagram (50%+ DM response rate confirmed in testing).
