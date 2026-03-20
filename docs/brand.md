# FjordAnglers — Brand Identity

> Wersja: 1.1 · Aktualizacja: 2026-03-20

---

## Misja

**"Connecting anglers with the best fishing experiences in the world — starting from Scandinavia."**

Platforma zbudowana przez prawdziwych wędkarzy, nie korporację. Każda decyzja powinna odzwierciedlać autentyczność, nie polish.

---

## Wartości podstawowe

| Wartość | Zasada |
|---|---|
| **Freedom** | "Your trip, your rules." Żadnych pakietów z wymuszonym programem. |
| **Authenticity** | Zbudowane przez wędkarzy, którzy sami łowią. Nie startup-play. |
| **Simplicity** | Zaplanowanie tripu powinno zająć minuty, nie tygodnie. |

---

## Tone of Voice

Pisz jak **przyjaciel, który tam był** — konkretnie, przyjaźnie i bezpośrednio. Zero marketingowego bełkotu.

### Tak ✅
- "Find where you'll be fishing"
- "Book in 3 minutes"
- "Real guides, real locations"
- Krótkie zdania. Strona czynna.

### Nie ❌
- "Exclusive fishing experiences"
- "World-class professional anglers"
- Korporacyjny żargon lub język folderów turystycznych
- Niejasne superlatywy ("best", "amazing", "incredible")

---

## Visual Identity

### Paleta kolorów

| Nazwa | Hex | Użycie |
|---|---|---|
| **Fjord Blue** | `#0A2E4D` | Główny kolor marki, nagłówki, dark BG |
| **Salmon** | `#E67E50` | Akcent, highlights, przyciski CTA |
| **Ice White** | `#F8FAFB` | Tła, przestrzeń oddychająca |

**W kodzie — dwie konwencje:**
- Inline styles: używaj zawsze `#0A2E4D` / `#E67E50` (dokładne wartości brand)
- Tailwind: `text-[#0A2E4D]`, `bg-[#E67E50]`
- CSS tokeny w `globals.css`: `--color-fjord-blue: #1B4F72` / `--color-salmon: #E67E22` (lekko inne — używać tylko przez Tailwind klasy `text-fjord-blue`)

### Typografia

**Jedyna czcionka: DM Sans**

```css
/* W globals.css */
--font-dm-sans: 'DM Sans', sans-serif;
```

Klasy pomocnicze:
- `f-display` — nagłówki, duże teksty (font-family: DM Sans, zazwyczaj bold)
- `f-body` — body text, labele, przyciski, inputs

**Nigdy nie używaj:** `font-sans`, `Inter`, `system-ui` jako głównej czcionki.

### Logo assets (`public/brand/`)

| Plik | Użycie |
|---|---|
| `white-logo.png` | Ciemne tła (Fjord Blue header, dark sections) |
| `dark-logo.png` | Jasne tła (Ice White, białe sekcje) |
| `sygnet.png` | Ikona / favicon / mała reprezentacja |

Oryginały w `/Desktop/fjordAnglers/identity/`.

### Styl fotografii
- **Golden hour** preferowany
- **Autentyczna akcja** — nie stockowe pozowane zdjęcia
- **Skandynawski minimalizm** — dużo białej/negatywnej przestrzeni
- Prawdziwe ryby, prawdziwa woda, prawdziwi ludzie

---

## Komponenty UI — wytyczne

### Karty / Cards
```css
background: #FDFAF7;
border-radius: 20–24px;
border: 1px solid rgba(10,46,77,0.07–0.1);
box-shadow: 0 2px 16px rgba(10,46,77,0.05);
```

### Przyciski CTA (primary)
```css
background: #E67E50;
border-radius: 16px;
color: white;
font-weight: 600;
```

### Przyciski secondary / ghost
```css
background: rgba(10,46,77,0.06–0.08);
color: #0A2E4D;
border: none;
```

### Tab bar (segmented control)
```css
/* Container */
background: rgba(10,46,77,0.05);
border-radius: 14px;
padding: 4px;

/* Active tab */
background: white;
box-shadow: 0 1px 4px rgba(10,46,77,0.1);
border-radius: 10px;

/* Inactive tab */
color: rgba(10,46,77,0.5);
```

### Status badges
| Status | BG | Kolor tekstu |
|---|---|---|
| New/inquiry | `rgba(59,130,246,0.1)` | `#2563EB` |
| Reviewing | `rgba(139,92,246,0.1)` | `#7C3AED` |
| Offer sent | `rgba(230,126,80,0.12)` | `#E67E50` |
| Confirmed | `rgba(74,222,128,0.1)` | `#16A34A` |
| Cancelled | `rgba(239,68,68,0.1)` | `#DC2626` |

---

## Zespół

| Osoba | Rola |
|---|---|
| **Tymon** | CEO, Produkt, Dev (Next.js/Supabase/Stripe) |
| **Łukasz** | Head of Content, Visual Identity, Social Media |
| **Krzychu** | Head of Fishing & Knowledge, Weryfikacja przewodników, License Map |

---

## Gatunki docelowe
Łosoś · Troć morska · Pstrąg · Szczupak · Okoń · Sandacz · Pstrąg arktyczny · Lipień
