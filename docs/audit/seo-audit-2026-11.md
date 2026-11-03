# SEO audit — fjordanglers.com (2026-11-03)

Read-only audit. No code, config, content or database was changed. This is **not** a
`docs/tasks` item. Candidate tasks are listed in §3; tj turns them into task files via `/wf-plan`.

## 0. Method and limits

- **Code:** `origin/main` at `77e419b` (Next 16.1.6, React 19.2.3 — `package.json:36-37`).
- **Production HTTP:** GET/HEAD only, against `https://www.fjordanglers.com` (the apex host redirects there — finding F1). Nothing was submitted; `/api/inquiries` was not touched. Raw outputs are in the session scratchpad, not in the repo.
- **Production DB (`uwxrstbplaoxfghrchcy`):** `SELECT` only, read now, not from notes or the types file.
- **Lighthouse:** `npx lighthouse` (v13.6.0 fetched on demand) works, but its Chrome launcher fails on this WSL box (`mkdtemp 'undefined:/Users/undefined/AppData/Local/lighthouse.XXXXXX'`). Worked around by starting Chrome 154 by hand and passing `--port`. **One run per page**, mobile, simulated throttling, from a laptop in Poland — indicative, not field data.
- **Not available to me:** Search Console beyond the numbers in the brief, CrUX/field data, Vercel dashboard (domain/redirect settings, build output), GA4. Anything that depends on them is marked *unverified*.

## 1. Findings

Impact: H/M/L for organic traffic or for the 15 Nov content package. Effort: S ≤ 1 day, M a few days, L a week or more.

| # | Area | Problem | Evidence | Impact | Proposed fix | Effort |
|---|---|---|---|---|---|---|
| F1 | Host / canonical | Every canonical, OG url, JSON-LD url, sitemap URL and the `Sitemap:` line use the **apex** `https://fjordanglers.com`, but the apex answers **307** (temporary) to `https://www.fjordanglers.com`. All 70 sitemap URLs are redirects; every canonical points at a URL that redirects back to the page it sits on. | `curl -sI https://fjordanglers.com/trips` → `HTTP/2 307 location: https://www.fjordanglers.com/trips`; `http://fjordanglers.com/trips` → 308 to the apex, then 307 to www. Sitemap host count: `70 https://fjordanglers.com`. Code: `src/app/layout.tsx:27,43,97`, `src/app/sitemap.ts:8`, `src/app/robots.ts:21`; 58 hardcoded occurrences in 22 files (`grep -rn "https://fjordanglers.com" src`). | H | Pick one host (D1). Then either make it the Vercel primary with a 308 for the other, or move all hardcoded URLs behind one `SITE_URL` constant. | M |
| F2 | Sitemap | GSC sitemap report is empty (brief). Even once submitted, GSC would report every entry as "redirected" until F1 is fixed. | See F1. `https://www.fjordanglers.com/sitemap.xml` → 200, 13 033 B, 70 URLs. | H | Fix F1 first, then tj submits the sitemap (GSC is outside this audit). | S |
| F3 | Rendering / caching | Every public page is rendered per request and served `private, no-cache, no-store`, `x-vercel-cache: MISS`, on two consecutive requests — including the blog article (has `generateStaticParams`) and the hub (`revalidate = 60`). Declared `revalidate`/SSG has no effect. Offer page TTFB 1.33 s in Lighthouse. | `curl -s -D - -o /dev/null` on `/blog/fishing-regulations-norway-2026`, `/iceland`, `/` ×2 each → `age: 0 cache-control: private, no-cache, no-store, max-age=0, must-revalidate x-vercel-cache: MISS`. Lighthouse offer: TTFB 1331 ms. **Cause is a hypothesis (the same one already in `docs/deferred-tasks.md` FA-1.52):** `src/app/(public)/layout.tsx` renders `NavWithUser`, which calls `createClient()` → `cookies()` (`src/components/layout/nav-with-user.tsx:13-14`). I did not test it. `docs/deferred-tasks.md` (FA-1.52) lists `/` and `/trips` among the pages that render the nav; both show the same headers. | H | Take the session read out of the public render tree (client-side nav state or a small client island), then re-check headers on prod. | M |
| F4 | Core Web Vitals (lab) | Offer and blog hero images are the LCP element with no `fetchpriority=high`; large unused JS. Lab LCP is poor in simulation, acceptable in the observed trace (see §2.10). | Lighthouse mobile, 1 run: home perf 88 / LCP 1.1 s; hub 91 / 1.0 s; offer **61 / 9.0 s**; blog **67 / 6.8 s**. `lcp-discovery-insight`: `priorityHinted: false` on offer and blog. `unused-javascript`: 519 KiB (offer), 310 KiB (blog), 458 KiB (hub). Observed LCP breakdown offer: TTFB 1332 + load delay 15 + load 515 + render 56 ms. | M | After F3, re-measure; add priority hint on the first gallery/hero image; trim client JS on offer pages. Do not tune before F3. | M |
| F5 | Guides — UUID URLs | 6 active, visible guides have `slug IS NULL`; their UUID is used in the sitemap (6 URLs), in listing links, in canonicals and JSON-LD. The three UUIDs from GSC: two (`5a1ae028…` → `toni-corenius-finnmark`, `64677705…` → `joakim-aberg-sweden`) already 308 to a slug; `cd8f48f1…` has no slug and serves **200** with a UUID canonical. | SQL: `select status,is_hidden,(slug is null),count(*) from guides group by 1,2,3` → `active/false/no_slug=true: 6`, `active/false/no_slug=false: 23`. curl: `/guides/5a1ae028-…` → 308 `/guides/toni-corenius-finnmark`; `/guides/64677705-…` → 308 `/guides/joakim-aberg-sweden`; `/guides/cd8f48f1-…` → 200. Code: `src/app/(public)/guides/page.tsx:268`, `src/app/page.tsx:431`, `src/app/sitemap.ts:65`, `src/app/(public)/guides/[id]/page.tsx:66,105-109`. The redirect has been in code since `d22adca` (2026-06-29); why those two UUIDs are still in Google's index is **unverified** (likely historical, from before their slugs existed — I cannot see when slugs were set). | H | Backfill slugs for the 6 (DB write — STOP-gated task); make a slug mandatory when a guide goes `active`; remove the `?? guide.id` fallbacks. | S–M |
| F6 | Guides — thin and duplicate profiles | Of the 6 slugless guides, 3 have **no active offer**, one has an empty `country`, and one is a second "Josh Hart" profile. All are in the sitemap and indexable. | SQL (active offers per guide): `Emanuel Cosic` country `''`, 0 offers; `Lucky Lure Fishing` (Finland) 0; `Josh Hart cd8f48f1…` 0 — and `Josh Hart 1a30602e…` has 1. Also `Patagonia River Guides` (slug set) 0 offers. Metadata for the empty-country row would read "Fishing Guide in ". | M | Decide per profile: complete, merge (301 `cd8f48f1…` → `1a30602e…`'s slug), or hide. Keep profiles with no offer out of the sitemap or `noindex` them until complete. | S |
| F7 | Offers — retired slugs | The GSC slug `fly-fishing-across-magallanes-torres-del-paine--tierra-del-fuego` returns **404**; there is no alias for it. The other GSC pair is handled: `fly-fishing-taupo-tongariro-central-north-island` → 308 `fly-fishing---taup--tongariro-central-north-island`. Only one version of each pair is active. | curl: `…/magallanes-torres-del-paine--tierra-del-fuego` → 404; alias → 308. SQL: `experience_slug_aliases` has 7 rows, none for the 404 slug; `experience_pages` has exactly one row for each Taupō/Magallanes lookup. Alias mechanism: `src/app/experiences/[slug]/page.tsx:50-52`, `src/lib/supabase/queries.ts:509-549`. | M | Add the missing alias — **which of the 3 Chilean pages it should point to is a content decision** (D3). | S |
| F8 | Offers — slug quality | Canonical slugs contain `--` or `---` (non-ASCII and `&` stripped): 4 of 24 active — `fly-fishing---taup--tongariro-…` (the clean spelling is the *alias*, the ugly one is canonical), `…-chilean-tierra-del-fuego--magallanes`, `…-punta-arenas-tierra-del-fuego--torres-del-paine`, `…-southern-patagonia--torres-del-paine`. Cause in the slug generator not checked. | Sitemap list; SQL on `experience_pages.slug`. | L | Fix the generator; for the 4 existing ones swap canonical and alias (DB write, keeps the old URL as alias). Low urgency — URLs are indexed; only do it with aliases in place. | S–M |
| F9 | Sitemap content | 5 of 6 blog URLs in the sitemap are `noindex, nofollow` stubs ("Full article coming soon"). `lastModified` is `new Date()` for static pages, hubs and blog posts. | `src/app/sitemap.ts:11,16,24,35` vs `src/app/(public)/blog/[slug]/page.tsx:32,38`. curl `/blog/pike-fishing-beginners` → `robots: noindex, nofollow`. The stub still carries Article + BreadcrumbList JSON-LD. | M | Sitemap lists only indexable posts; `lastModified` from real dates (post date, `updated_at`). | S |
| F10 | Blog metadata | Article `dateModified` always equals `datePublished`, built from a display string (`"March 17, 2026"`) through `new Date()`. The Norway-regulations article and one stub share the same stock fish PNG as hero/OG image (`FISH_IMG['Salmon']`). Titles 91 chars (Norway article), over the ~60-char display length. | `src/app/(public)/blog/[slug]/page.tsx:78-79`; `src/lib/blog-data.ts:21,30`; extractor: title 91 chars, description 175 chars. | M | Typed ISO `publishedAt`/`updatedAt`; per-article image; title ≤ 60, description ≤ 155. | S |
| F11 | Offers v2 — structured data | The v2 template emits **no** `TouristTrip`/`Offer`, `BreadcrumbList` or `FAQPage` JSON-LD and no `og:url`/`og:type`; v1 emits all of them. v2 is the target template, so the v1→v2 migration silently removes structured data from every offer. 7 of 24 active offers are v2 (all Patagonia/NZ). | Prod HTML `/experiences/fly-fishing-south-island-new-zealand`: JSON-LD = `WebSite`, `Organization+LocalBusiness` only; v1 `/experiences/fiskedan-stockholm-fishing`: + `TouristTrip`, `BreadcrumbList`. Code: v1 `ExperienceV1.tsx:283-357`; v2 `ExperienceV2.tsx` has no `ld+json` (grep: 0 hits), metadata at `:76-82`. SQL: `page_version=1: 17, =2: 7`. | H | Add the same three schemas to v2 **before** more offers migrate; make it part of the v2 "Done when". | M |
| F12 | Offers — meta text | 22 of 24 active offers have `meta_description` > 160 chars (v1 16/17, v2 6/7), so the tail is cut in results. `fiskedan-stockholm-fishing`: 3 612 impressions, CTR 0.2%; description is 211 chars and the price ("From €950/pp") sits at the very end; title 67 chars. The page shows two `<h1>` (mobile + desktop copies). **Cause of the low CTR is unverified** — I have no queries/positions from GSC. | SQL: `desc_over_160`: 16 + 6. Extractor on `/experiences/fiskedan-stockholm-fishing`. Code `ExperienceV1.tsx:414,474`. | M | Pull queries/positions for the three pages in the brief from GSC, then rewrite title/description for the top ~10 offers. Collapse the duplicate `h1`. | S |
| F13 | Listings — canonical and pagination | `/trips?page=2`, `/trips?country=Norway`, `/guides?page=2` all canonicalise to page 1. Offers 13–24 and guide profiles beyond page 1 are therefore reachable only via the sitemap and hubs. `/trips?country=Norway` has its own title and H1 ("Guided Fishing Trips in Norway") and is not indexable — it competes with nothing because no Norway hub exists (F15). `/trips` description says "20+ … Norway, Sweden, Iceland and Finland" and omits Patagonia and NZ (24 active offers, 7 countries). | curl: `/trips?country=Norway` canonical `https://fjordanglers.com/trips`; same for `?page=2`. Code `src/app/trips/page.tsx:94-116`, `src/app/(public)/guides/page.tsx:111`. | M | Self-canonical for paginated pages (or one "all offers" crawlable list), accurate `/trips` copy, and leave country intent to hubs. | S |
| F14 | Hubs — missing | Only 3 hubs exist (Patagonia, Iceland, New Zealand). Nordic group is narrowed to `countries: ['Iceland']`. Norway (4 active offers), Sweden (5), Finland (3) have **no landing page**; the footer falls back to `/trips?country=…`, which is canonicalised away (F13). | `src/lib/destinations.ts:33-74`; `src/components/layout/footer.tsx:71-74`; SQL: active offers by country — Sweden 5, Chile 4, Iceland 4, Norway 4, NZ 3, Finland 3, Argentina 1. | H | Add `norway`, `sweden`, `finland` hubs (see §2.9). | M |
| F15 | Hubs — thin content | All three hub editorial fields are empty (`seasonMonths`, `peakMonths`, `species`, `faq` = `[]`, marked `TODO tj`), so the page renders only a 2–3 sentence intro, a list and a map. No `FAQPage`, no `BreadcrumbList`; the only JSON-LD is `ItemList` of `TouristTrip` without `offers`. Hub → guide links: 0; hub → blog links: 0. | `src/lib/destinations.ts:41-45,55-59,68-72`; `src/app/(public)/[destination]/page.tsx:55-78`; prod HTML `/iceland`: `/experiences/` 4 links, `/guides/` 0, `/blog/` 0; JSON-LD `ItemList` only. Editorial lives in code (O-42 (c)), so the 15 Nov content cannot be entered by Krzysztof. | H | Fill the fields (content), emit `FAQPage` when FAQ exists, add `BreadcrumbList`, link guides and articles from the hub. Decide where editorial lives (D2). | M |
| F16 | Internal linking | Home → blog: 0 links. Blog index and blog article → offers/guides/hubs: 0 links (only global nav/footer). Offer → guide ≤ 1; guide → offer ≤ 1. No sitemap URL is fully orphaned once pagination is followed (0 of 70 across 18 crawled pages), but up to 17 guide profiles (29 visible minus 12 on page 1) and 12 offers (page 2 of `/trips`) sit behind paginated listings whose canonical is page 1. | `python` link extractor over 18 downloaded pages (counts in §2.7). `NorwayRegulationsContent` has 1 `href=` (`blog-content/norway-regulations-2026.tsx:370`), none to offers. | M | Related-offers/guides block on articles and hubs; "latest from the journal" on home and hubs; articles link to the matching hub. | M |
| F17 | Organic attribution | `inquiries.source` is `web_form` for 51 of 52 inquiries in 60 days — no channel. 44 carry a `gclid`, 10 a `utm` (9 `google/cpc`, 1 `ig/social`), 6 have neither (organic, direct and unlabelled social are indistinguishable). Neither referrer nor landing page is stored on the inquiry. `web_events.referrer_host` is 4 069 of 4 093 page views = `www.fjordanglers.com`: it records the `Referer` of the beacon request, not of the visit. | SQL (60 days): `source` → `web_form 51 / manual 1`; `gclid not null 44`; `no_ads_signal 6`; `utm_source` → `google 9, ig 1`; `web_events` referrer groups → `www.fjordanglers.com 4069, google.com 1, baidu.com 1`. Code `src/app/api/events/route.ts:66-70,115`; `src/lib/utm.ts:4-30` (stores only five `utm_*` fields). `inquiries.page_slug` exists (FA-1.60) but is null on 41 of 52. | H | Capture `document.referrer` + landing path at first touch next to the UTM store, send both with the inquiry and with events, derive `channel` in a view. Without it organic cannot be measured in our own data. | M |
| F18 | Index hygiene | Token pages for an invalid token return **200** with `index, follow` and the default title (soft 404): `/offers/test-token` → h1 "Offer not found"; `/guide-intake/test-token` → "Form not found". `/reviews/test-token` → 404 (correct). No `robots` metadata or `X-Robots-Tag` on `offers`, `reviews`, `guide-intake`, `inquiry/*/confirmed`; `robots.txt` does not disallow them. Not linked publicly, so risk is low. | curl status + extractor on both; `grep -rn "index: false" src/app/offers …` → only `experiences/[slug]/preview/page.tsx:22`. | L | `noindex` + 404 status for unknown tokens; optionally `Disallow` in robots. | S |
| F19 | Misc. markup | `/blog` and `/guides` have no `og:image` (page-level `openGraph` replaces the layout default). Map pins are `<img>` strings without `alt` (Lighthouse `image-alt`, SEO 92 on hub and offer). Site-wide `WebSite.SearchAction` targets `/trips?country=` which is a filter, not a search. | Extractor `og:image: None` for `/blog`, `/guides`; Lighthouse SEO 92 ← `src/app/trips/exp-page-map-view.tsx:199,219,242`; `src/app/layout.tsx:98-105`. | L | Add default `images` to those pages; `alt=""` on decorative pins; drop `SearchAction` (Google retired the sitelinks search box — general knowledge, not checked here). | S |

No problems found in these areas (so nobody re-checks them): `robots.txt` content is sane and returns 200 on `www` (`Disallow` for dashboard, admin, api, auth, login, register, reset); single `<h1>` on home, hub, guide, listing, blog; `lang="en"` set and no `hreflang` — correct, there is one language (`layout.tsx:42` comment); the `Article`, `BreadcrumbList`, `Person`, `ItemList`, `TouristTrip`, `Organization` JSON-LD blocks that exist all parse as JSON; content images go through `next/image` (the only raw `<img>` are 24 flag SVGs from `cdn.jsdelivr.net` on home).

## 2. Checklist results (brief §Zakres)

### 2.1 Stack and rendering
Next 16.1.6, React 19.2.3. Public routes (`find src/app -name page.tsx`): `/`, `/trips`, `/guides`, `/guides/[id]`, `/[destination]` (3 static params), `/blog`, `/blog/[slug]` (6 static params), `/experiences/[slug]` (+ hidden `/preview`), `/legal/*` (4), token pages `/offers/[token]`, `/reviews/[token]`, `/guide-intake/[token]`, `/inquiry/[id]/confirmed`, auth pages. Declared `revalidate`: `/` 300, `/trips` 60, `/guides` 300, hub 60, `/experiences/[slug]` 3600, sitemap 3600. **Observed on production: none of them is cached** (F3). `/experiences/[slug]` is already documented as `ƒ` in `docs/deferred-tasks.md`.

### 2.2 Production indexation
`/robots.txt` and `/sitemap.xml` on the apex: 307 to `www`. On `www`: both 200. Sitemap = 70 URLs: 30 guides, 24 experiences, 7 blog (incl. `/blog`), 4 legal, `/trips`, 3 hubs, `/`. HTTP status of all 70 on `www` (GET): **70 × 200**. Contents: 6 UUID guide URLs; 5 noindex blog stubs; 24 experience URLs = all 24 active offers, no draft in the sitemap (SQL: 24 active, 5 draft); no 3xx/404 once on `www`. One transient observation: the very first HEAD request for `/guides/patagonia-river-guides` returned **404**; the next 7 requests (GET and HEAD) returned 200. Not reproduced, cause unknown — *unverified*.

### 2.3 Guides
See F5, F6. `href` builders that fall back to the UUID: `guides/page.tsx:268`, `page.tsx:431`, `sitemap.ts:65`; admin links at `admin/guides/page.tsx:291`, `admin/guides/[id]/page.tsx:215`, `edit-guide-form.tsx:284`.

### 2.4 Offers
`experience_pages` active: 24 (17 v1, 7 v2), draft: 5. Both lookups from the brief resolve to a single active row (F7). Canonical present on v1 and v2 (`ExperienceV1.tsx:84`, `ExperienceV2.tsx:79`), always on the apex host (F1).

### 2.5 Metadata per page type (one prod example each)

| Type | URL | title (chars) | description (chars) | canonical | robots | og:image | H1 | JSON-LD (beyond WebSite + Organization) |
|---|---|---|---|---|---|---|---|---|
| Home | `/` | 46 | 167 | apex | index | default | 1 | — |
| Trips | `/trips` | 53 | 145 | apex | index | default | 1 | ItemList |
| Guides | `/guides` | 92 | 143 | apex | index | **none** | 1 | ItemList |
| Hub | `/iceland` | 40 | 145 | apex | index | hero photo | 1 | ItemList |
| Guide | `/guides/toni-corenius-finnmark` | 54 | 120 | apex | index | cover | 1 | Person, BreadcrumbList |
| Offer v1 | `/experiences/fiskedan-stockholm-fishing` | 67 | **211** | apex | index | photo | **2** | TouristTrip, BreadcrumbList |
| Offer v2 | `/experiences/fly-fishing-south-island-new-zealand` | 59 | 184 | apex | index | photo | 1 | **none** |
| Blog index | `/blog` | 67 | 92 | apex | index | **none** | 1 | — |
| Blog article | `/blog/fishing-regulations-norway-2026` | **91** | 175 | apex | index | stock PNG | 1 | Article, BreadcrumbList |
| Blog stub | `/blog/pike-fishing-beginners` | 76 | 105 | apex | **noindex,nofollow** | stock PNG | 1 | Article, BreadcrumbList |

`og:type` is missing on hub, guide and both offer types. `hreflang`: none anywhere (one language).

### 2.6 Structured data
Generated: `WebSite` + `Organization/LocalBusiness` (layout, every page), `ItemList` (trips, guides, hub), `TouristTrip` + `BreadcrumbList` (+ `FAQPage` when the offer has FAQ — v1 only), `Person` + `BreadcrumbList` (guide), `Article` + `BreadcrumbList` (blog). All blocks on the 11 downloaded pages parse. Missing: offer v2 (F11), hub `FAQPage`/`BreadcrumbList` (F15), `Offer` price on hub items, `BreadcrumbList` on `/trips`, `/guides`, hubs. Not assessed against Google's rich-result validator (no network tool for it) — syntax and field presence only.

### 2.7 Internal linking (crawl of 18 pages, unique internal hrefs)
Home: 8 offers, 6 guides, **0 blog**, 3 hubs. Hub `/iceland`: 4 offers, **0 guides, 0 blog**. Offer: 2–3 other offers, 0–1 guide. Guide: 0–1 offer. Blog index: 6 posts, **0 offers/guides**. Blog article: **0 offers/guides/posts**. Orphans: 0 of 70 once paginated listings are included; the 5 guide profiles `0f6e5a30…`, `marcin-go-fishing-norway`, `inge-ronning-norway`, `martin-chambo`, `pablo-zaleski` are reachable only via `/guides?page=N`, whose canonical is page 1.

### 2.8 Blog as a publishing system
**Today:** an article = one entry in `src/lib/blog-data.ts` (slug, title, excerpt, display-date string, read time, category, image from `FISH_IMG`) **plus** a React component in `src/lib/blog-content/` **plus** an entry in two maps in `src/app/(public)/blog/[slug]/page.tsx:11-17`; any slug without a component becomes a `noindex` stub. Publishing = a code change, a PR and a deploy. The existing article is 570 lines of JSX. A non-technical author cannot do any of it; nothing exists for images, drafts, scheduling, preview, or dates.

**Needed for a non-technical author:** structured fields (title, slug, excerpt, body, hero image + alt, category, publish/update date, status, related hub), draft/published, preview, image upload, and the page must emit correct metadata and schema from those fields.

| | A. Table in Supabase + editor in `/admin` | B. MDX files in the repo, via PR | C. External headless CMS |
|---|---|---|---|
| Who publishes | Krzysztof in the browser | Krzysztof only through GitHub (or tj/agent on his behalf) | Krzysztof in the CMS UI |
| Build cost | M–L: table + RLS + migration (STOP-gated), admin screen (editor, image upload to Storage, preview), public reader, sitemap/RSS from table, migrate the existing article | S–M: MDX pipeline, frontmatter schema, components for CTA/offer cards, move 1 article, sitemap from files | M: pick/pay a CMS, webhook → revalidate, content model, API client, secrets, move 1 article |
| Ongoing cost | none (own stack); editor maintenance | none, but every article is a PR + deploy | subscription + a third system to secure |
| Risks | Rich-text editor choice (XSS/sanitising on public pages), image handling, we own the editor forever; rule 3 (`.from` only in data layer) and events (rule 5) apply to the admin writes | Author cannot self-serve → defeats the stated goal; merge conflicts; deploy per article | Vendor lock-in; images and slugs live outside our DB; another credential; GDPR processor |
| SEO | Good if the public page is cached (needs F3) with `revalidateTag` on publish; slug/metadata/schema from columns; scheduled publish needs a cron | Best by default: fully static (SSG), reviewed diffs | Good with ISR + webhook; metadata fields depend on the CMS model |
| Fits our rules | Yes: same stack, same auth (`requireAdmin`) | Yes | New vendor — needs a decision record |

Recommendation (D4): **A**, in two steps — first the table + public reader + slug/metadata/schema/sitemap with content entered by tj or an agent, then the editor — because the stated goal is self-serve publishing and everything else already lives in Supabase. B is the cheapest only if Krzysztof can use GitHub; he cannot. C is the heaviest and adds a vendor. **Dependency:** whichever is chosen, F3 should land first, otherwise ISR/`revalidateTag` on blog pages has no effect.

### 2.9 Country hubs for Norway, Sweden, Finland
A hub is one object in `DESTINATION_HUBS` (`src/lib/destinations.ts`) with `slug`, `group`, optional `countries`, `h1`, `intro`, `metaTitle`, `metaDescription` and the editorial fields. `getDestinationHub` (`src/lib/supabase/queries.ts:1130`) pulls offers with `.in('country', getHubCountries(hub))`; routing, `generateStaticParams`, sitemap and footer links derive from the same array. So three new entries `{ slug: 'norway', group: 'Nordic', countries: ['Norway'] }` (and the same for Sweden, Finland) produce the pages, sitemap entries and footer links with no other code change — provided Iceland's `countries: ['Iceland']` stays as is. **Missing:** (1) editorial content — O-42 (c) put it in code ("(b) returns when Norway actually enters"), so this is exactly the trigger for D2; (2) the quality items in F15 (FAQ schema, breadcrumbs, links to guides/articles); (3) two-hub overlap rules, e.g. the Finnmark/Finnish Lapland offer.

**Rivers and regions:** nothing public exists. The DB already has `regions` (16 rows, all `status = 'draft'`, `intro` empty, columns `slug, name, intro, status, sort_order, country_id`) and `waters` (3 rows). No route like `/[destination]/[region]` exists, `experience_pages.region` is free text and not a foreign key to `regions`. To add region/river pages: a route segment, a link from `experience_pages` to `regions`/`waters`, content, canonical rules between region and hub, and sitemap entries. That is a design task, not a quick extension (D5).

### 2.10 Performance and images
Lighthouse mobile, single run each, simulated throttling, `https://www.fjordanglers.com`:

| Page | Perf | SEO | LCP | FCP | TBT | CLS | Transfer |
|---|---|---|---|---|---|---|---|
| `/` | 88 | 100 | 1.1 s | 1.1 s | 490 ms | 0 | 1 483 KiB |
| `/iceland` | 91 | 92 | 1.0 s | 1.0 s | 360 ms | 0 | 1 671 KiB |
| `/experiences/fiskedan-stockholm-fishing` | **61** | 92 | **9.0 s** | 1.0 s | 460 ms | 0 | 1 936 KiB |
| `/blog/fishing-regulations-norway-2026` | **67** | 100 | **6.8 s** | 0.9 s | 400 ms | 0 | 1 070 KiB |

The unthrottled LCP breakdown from the same traces sums to about 1.9 s (offer) and 1.0 s (blog) — so the 9.0/6.8 s are slow-4G simulation figures, and TTFB (1.33 s on the offer) is the largest single part. No CrUX data — *field performance unverified*. Content images use `next/image` (home 100 of 124 `<img>`, the rest are flags); no `<img>` without `alt` attribute in the HTML, a few with empty alt (decorative). Source images in `public/` are very large — `iceland.jpg` 21 MB, `norway.jpg` 14 MB, `hero.jpg` 7.9 MB (`ls -S`); `hero.jpg` is used by home and `/guides` through `next/image`; `iceland.jpg`, `norway.jpg`, `sweden.jpg`, `finland.jpg` have no filename match in `src` (dynamic references not ruled out) — already noted in `docs/deferred-tasks.md` (FA-1.53).

### 2.11 Organic analytics
See F17. GTM and Google Ads are present with Consent Mode defaults `denied` (`layout.tsx:77-87`), so GA4 will under-count until consent; I had no GA4 access, so organic sessions in GA4 are *unverified*.

## 3. Proposed tasks (candidates for FA-1.79+, ordered by impact)

None of these exists as a task file. Dependencies are logical, not enforced.

| Order | Title | Goal | Effort | Depends on | Touches DB |
|---|---|---|---|---|---|
| 1 | Single canonical host | Choose one host, move every hardcoded URL (58 in 22 files) behind one constant, make the other host a 308 at the edge, then re-verify sitemap/canonical/robots. | M | D1 | No (Vercel settings are tj's) |
| 2 | Public pages cacheable | Remove the per-request session read from the public render tree so `revalidate`/SSG take effect; verify `cache-control` and TTFB on prod before/after. | M | — | No |
| 3 | Offer v2: structured data parity | Add `TouristTrip`/`Offer`, `BreadcrumbList`, `FAQPage`, `og:url/type` to the v2 template; make it a gate for migrating more offers. | M | — | No |
| 4 | Nordic hubs: Norway, Sweden, Finland | Add three hub entries plus hub quality fixes (FAQ schema, breadcrumbs, guide and article links). Content comes from tj/Krzysztof. | M | D2; content | No (D2 option b: yes) |
| 5 | Blog publishing system | Implement the option chosen in D4: table, public reader with correct metadata/schema/sitemap, then editor in `/admin`. Replace the stub mechanism. | L | D4, task 2 | Yes |
| 6 | Guide slugs and thin profiles | Backfill the 6 missing slugs, require a slug on activation, merge or hide the duplicate/empty profiles, drop `?? guide.id` fallbacks, keep incomplete profiles out of the sitemap. | S–M | D3 | Yes |
| 7 | Organic attribution | Store first-touch referrer and landing path with UTM; send with inquiry and events; add a `channel` derivation; fix `referrer_host`. | M | — | Possibly (column or `utm` jsonb keys) |
| 8 | Sitemap and blog metadata hygiene | Only indexable posts in the sitemap, real `lastModified`, ISO article dates, per-article images, title/description length, `og:image` defaults. | S | — | No |
| 9 | Offer snippets and slugs | Add the missing alias for the 404 slug, rewrite title/description for the top offers using GSC queries, collapse the duplicate `h1`, fix the slug generator and swap the 4 `--` slugs. | S–M | D3; GSC queries from tj | Yes (aliases) |
| 10 | Listing canonicals and copy | Self-canonical for paginated `/trips` and `/guides`, accurate `/trips` description. | S | — | No |
| 11 | Internal linking pass | Related offers/guides on articles and hubs, journal block on home and hubs. | M | 4, 5 | No |
| 12 | Utility-page index hygiene | `noindex` and real 404 for unknown tokens, `alt` on map pins, drop `SearchAction`. | S | — | No |
| 13 | Image weight and LCP | Compress `public/` originals, priority hint on LCP images, trim client JS on offer pages; re-measure after task 2. | M | 2 | No |

## 4. Decisions for tj

**D1 — Which host is canonical: `www` or the apex?**
Facts: today the apex 307-redirects to `www`; all our metadata says apex; I do not know which Search Console property you verified or which host the Google Ads links use.
- (a) `www` canonical — keeps the live behaviour, so Google already sees `www` as the served host; requires changing the 58 hardcoded URLs. *Consequence:* GSC must have a `www` (or domain) property.
- (b) Apex canonical — switch the Vercel redirect direction (apex primary, `www` → 308 apex); no code change for URLs, but every page served today changes host. *Consequence:* a host migration on a site with 143 clicks in 90 days — low risk but not zero; ad URLs must be checked.
- **Recommendation: (a)**, and make the redirect permanent (308). Check first which GSC property holds the 3 546 impressions.

**D2 — Where does hub (and country) editorial content live once Norway/Sweden/Finland enter?**
O-42 resolved to "(c) in `destinations.ts`; (b) table + admin returns when Norway enters". Now it does.
- (a) Stay in code — fastest, but Krzysztof cannot publish; every text edit is a PR.
- (b) `destination_hubs` table + admin editor — self-serve, needs a migration (STOP-gated) and an editor screen; reuse in the blog editor (D4 option A).
- (c) Code for the three new hubs now, table later — ships hubs for 15 Nov, defers the editor.
- **Recommendation: (c) if the hubs must exist on 15 Nov, otherwise (b) together with the blog editor.** Your decision; this reopens O-42.

**D3 — Profiles and slugs that need a human judgement.**
- Which Chilean offer should the retired slug `…magallanes-torres-del-paine--tierra-del-fuego` redirect to? Candidates: `fly-fishing-across-punta-arenas-tierra-del-fuego--torres-del-paine` (region "Magallanes / Torres del Paine / Tierra del Fuego" — closest by name), `fly-fishing-in-chilean-tierra-del-fuego--magallanes`, `fly-fishing-in-southern-patagonia--torres-del-paine`. **Recommendation: the first**, but I cannot prove it was the page behind that URL.
- What happens to the duplicate Josh Hart profile `cd8f48f1…`, `Emanuel Cosic` (empty country) and `Lucky Lure Fishing` (no offer)? Options: complete, merge/redirect, hide. **Recommendation: merge Josh Hart, hide the other two until complete.**
- Rename the four `--` slugs? **Recommendation: not now** — indexed URLs, low gain; only with the slug-generator fix.

**D4 — Blog publishing system (brief item 8).** Options A (Supabase table + `/admin` editor), B (MDX in repo via PR), C (headless CMS) in §2.8. **Recommendation: A, in two steps** (public reader first, editor second). If Krzysztof will not have a working editor by 15 Nov, he needs an interim path: I suggest tj or an agent enters his text through step 1, rather than shipping B.

**D5 — Region and river pages: in scope for this content push or later?** The DB has 16 draft `regions` rows and 3 `waters`, no public route, and offers are not linked to them. **Recommendation: later** — finish country hubs and the blog first, then design the region layer once there is content.

**D6 — Order of work before 15 Nov.** The content package will land on a site whose canonical host is inconsistent (F1) and whose pages are uncached (F3). **Recommendation:** tasks 1 and 3 (host, v2 schema) before 15 Nov; task 2 in parallel; hubs (task 4) with content. Blog editor after.

## 5. Not verified

- Search Console: why the two UUID guides are still indexed; which queries and positions sit behind the low CTR on `fiskedan-stockholm-fishing`, `/trips` and the Norway regulations article; which property is verified (all D1).
- Field performance (CrUX); the Lighthouse numbers are single lab runs.
- The cause of F3 (hypothesis, not tested); the cause of the one-off 404 on `/guides/patagonia-river-guides`; the slug generator behind F8; Vercel domain settings.
- GA4 organic sessions (no access); Google's rich-result validator (not run, syntax and fields only).
- Production behaviour after the next deploy; ISR pages may serve a pre-deploy render until their TTL expires (see `docs/03-conventions.md` "Production verification") — in this case F3 means nothing is cached, so no stale render was observed.
