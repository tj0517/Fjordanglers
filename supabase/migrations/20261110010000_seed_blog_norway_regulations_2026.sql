-- FA-1.83 — the Norway article, moved from code into `blog_posts`
--
-- Why: `/blog/fishing-regulations-norway-2026` is the one indexed article, and it lived in
-- src/lib/blog-content/norway-regulations-2026.tsx. The blog now reads published rows of
-- `blog_posts` (migration 20261110000000), so this row is what keeps the URL alive. It is
-- applied to production BEFORE the code that reads it is merged (decision D2, 2026-11-10).
--
-- What: one row, same slug, converted from the JSX to Markdown + the four named blocks
-- (:::info, :::warning, :::stat, ::photo — see src/lib/blog/article-markdown.ts). Differences
-- from the old page, on purpose: the SEO title and description are new text that fits the
-- limits (title ≤ 60, description ≤ 155 — the old ones were 91 characters with the site suffix
-- and 175), and `published_at` / `updated_at` are the article's own date, 2026-03-17 UTC.
-- The text of the article is unchanged.
--
-- Idempotent: ON CONFLICT (slug) DO NOTHING — a row already there (edited in the admin later)
-- is never overwritten by a re-run.

INSERT INTO public.blog_posts
  (slug, title, seo_title, description, body_md, image_url, image_alt, category, country,
   status, published_at, created_at, updated_at)
VALUES (
  'fishing-regulations-norway-2026',
  'Fishing in Norway 2026: Regulations, Licenses, and Limits – A Complete Guide',
  'Fishing in Norway 2026: Regulations, Licenses & Limits',
  'Norway fishing rules for 2026: licenses (fiskekort, fiskeravgift), export limits, gear disinfection, and what applies at sea, in lakes and salmon rivers.',
  $md$Norway is an absolute paradise for anglers. From deep fjords and wild lakes to rushing rivers full of powerful salmon – the possibilities are endless. However, Norwegian law is very strict when it comes to nature conservation. Before you cast your line, you need to know the current **fishing regulations in Norway applicable in 2026**.

In this article, you will find everything you need to know before your trip: from information about licenses (*fiskekort*, *fiskeravgift*), through export limits, to mandatory equipment disinfection.

## Sea Angling in Norway – Free, but with Rules

Fishing in Norwegian fjords and the open sea is the most popular activity among tourists. Most importantly – it is very accessible.

### Do you need a license for the sea?

No. **A license is not required** for recreational sea angling from the shore or a boat. However, you must remember that fishing must be done exclusively using recreational methods (rod, spinning, fly fishing).

### Minimum sizes and angler's duties

No license does not mean no rules. Norway has strict **minimum size limits** for specific fish species (e.g., cod, halibut, or saithe).

- Fish below the minimum size must be carefully and immediately released back into the water.
- You must strictly comply with local seasonal restrictions and fishing bans specified for a given species.

### Where can you fish from the shore and boat?

Fishing is permitted on most of the coastline. The exceptions where **fishing is prohibited** include:

- Military areas
- Commercial ports
- Private piers (without explicit permission from the owner)
- Marine nature reserves

:::info
You must also keep a safe distance from fish farms, according to local markings on the water.
:::

::photo{src="/fish_catalog/cod.png" alt="Atlantic cod" caption="Cod, halibut, and saithe are among the saltwater species with strict minimum size requirements."}

## Freshwater Fishing – Lakes and Rivers

If you prefer peaceful fishing for trout, pike, or perch in lakes, you need to prepare for different rules than at sea. Here, the water always has an owner or manager.

### The Fiskekort License – Your entry ticket

**Fiskekort** (a local fishing license) is mandatory on most freshwater bodies. Remember that this license is not universal – it is assigned to a specific body of water or even a specific stretch of a river.

You can conveniently buy it online (e.g., via the Inatur portal) or locally from vendors (often at gas stations or fishing tackle shops).

### Local regulations

Water owners have the right to set their own rules. Always check the following before you start fishing:

- Minimum size limits
- Daily bag limits
- Conservation periods for specific species
- Any bans (e.g., using live bait or combustion engines on boats)

During an inspection by the fishing guard, you must present your **fiskekort** (in paper form or electronically on your phone) and a piece of ID.

::photo{src="/fish_catalog/trout.png" alt="Brown trout" caption="Trout, pike, and perch are popular freshwater targets — each with their own licensing requirements."}

## Salmon Rivers – The Kingdom of Salmon and Sea Trout

Fishing for salmon and sea trout (*sjørøye*) in rivers is the most prestigious, but also the most heavily regulated category of fishing in Norway.

### Fiskeravgift (National fee)

To even consider legally fishing for anadromous (migratory) fish in rivers, adults must first pay the **fiskeravgift**, which is an annual national state fee. You must always have proof of payment with you by the water.

### Local Fiskekort for the river

The national fee itself is not enough. In addition to it, you must purchase a local **fiskekort** for a specific river or its designated section (so-called *beat*). Due to high demand, licenses for the best rivers need to be booked well in advance.

### Mandatory equipment disinfection

This is a crucial point that many tourists forget! Norwegian rivers are protected against the *Gyrodactylus salaris* parasite, which is deadly to salmon.

- Your equipment (rods, lines, landing nets, waders) must be disinfected before entering the water.
- Disinfection is carried out at authorized points along the rivers (often at campsites or gas stations).
- After the procedure, you will receive a disinfection certificate, which is checked during inspections.

:::warning
Every salmon river has its own very strict regulations — mandatory use of barbless hooks, mandatory release of female fish during specific periods. Always check before your first cast.
:::

::photo{src="/fish_catalog/salmon.png" alt="Atlantic salmon" caption="Atlantic salmon – Norway's most regulated and most coveted catch."}

## Exporting Caught Fish from Norway in 2026

The rules for taking fish out of Norway are very strict and regularly checked by customs officials at borders (including ferries).

In 2026, to export fish fillets from Norway, you must meet two conditions:

1. Stay within the **tourist weight limit** (limits are updated by the Norwegian Customs authorities – check them before your trip).
2. Have documented proof of origin. This means that you can only export fish if you fished at a **registered tourist fishing camp**.

During a customs check, you must present an official document issued by the camp, confirming your catch. Exporting fish caught on your own, outside of registered fishing bases, is illegal.

:::stat{value="15 kg" label="marine fish per person"}
Maximum twice per calendar year. Dropping to 10 kg from January 1, 2027.
:::

## Quick Comparison: Which Rules Apply to You?

| Type of Fishing | License required? | Where can you fish? | Key Responsibilities |
| --- | --- | --- | --- |
| **Sea** | No | Coastline, fjords (outside protected zones, ports, and military areas). | Knowing minimum sizes; having a document from a registered camp for export. |
| **Freshwater** | Yes — fiskekort | Lakes and rivers for which you hold a license. | Having a license (fiskekort) and ID; obeying local regulations. |
| **Salmon** | Yes — National fiskeravgift + local fiskekort | Only designated river sections with a purchased license. | Having the national fee, local license, disinfection certificate; strictly obeying river regulations. |

## FAQ – Frequently Asked Questions (2026)

### Exactly how many kilograms of fish can I export from Norway in 2026?

In 2026, the tourist limit is exactly **15 kg** of marine fish or processed products (e.g., fillets) per person. You can use this limit a maximum of twice per calendar year. Remember that the condition for export is staying at a registered tourist fishing camp and having a personalized certificate issued by them. *Important note:* From January 1, 2027, this limit will become stricter and drop to 10 kg!

### Do fish from lakes and rivers count towards the export limit?

No. Freshwater and anadromous species (e.g., salmon, trout, Arctic char, pike) are completely excluded from the 15 kg marine limit. You also do not need to catch them at a registered camp, but in the event of a customs inspection, you must show proof of a legal catch (e.g., a paid *fiskekort* for a given lake or river).

### How far from fish farms am I allowed to fish?

Norwegian law sets strict boundaries. When fishing, you must keep an absolute minimum distance of **100 meters** from the nearest fish farm. If you are not fishing and merely passing by in a boat, you must maintain a distance of at least 20 meters from the cages and mooring elements.

### Are there any fish species I am not allowed to catch or keep?

Yes, Norway has exceptions to protect specific populations:

- **Cod in the Oslofjord:** There is a total, year-round ban on catching cod in this area due to stock depletion.
- **Halibut:** Any specimen measuring **over 2 meters** in length must be strictly and carefully released back into the water unharmed.
- **King crab and bluefin tuna:** Tourists are not allowed to catch them on their own (you can only go for crabs as part of organized tours with set quotas in the Finnmark province). Tourists are strictly prohibited from selling any recreationally caught fish.

### I only fish from the shore in the sea. Do I need to disinfect my equipment?

No. The requirement to disinfect equipment, clothing, and waders (most often with a Virkon S solution) applies exclusively to fishing in fresh waters – rivers and lakes. This is to protect against the transmission of infectious diseases and parasites, such as *Gyrodactylus salaris*.

### Where and how can I buy a lake fishing license (fiskekort)?

The easiest way is to do it online through the Inatur portal (inatur.no), which gathers most Norwegian fisheries. You can also buy paper licenses locally – at nearby grocery stores, fishing tackle shops, campsites, or gas stations.

## Useful Links (Official Resources)

All the links below lead to official, verified websites of Norwegian state institutions:

### Sea Angling & Minimum Sizes

- [Directorate of Fisheries – Sea angling rules](https://www.fiskeridir.no/english/sea-angling-in-norway)
- [Minimum sizes for saltwater species](https://www.fiskeridir.no/English/Fishing-in-Norway/Minimum-sizes)
- [Interactive map of zones & protected areas](https://kart.fiskeridir.no)

### Licenses & Freshwater

- [Inatur – Buy Fiskekort online](https://inatur.no/fiske)
- [National fee (Fiskeravgift)](https://fiskeravgift.miljodirektoratet.no)
- [Salmon river register & regulations](https://www.miljodirektoratet.no/lakseregisteret)

### Export & Health

- [Norwegian Customs – Fish export rules](https://www.toll.no/en/goods/fish/quota)
- [Veterinary Institute – Gyrodactylus salaris](https://www.vetinst.no/sykdom-og-agens/gyrodactylus-salaris)
- [Food Safety Authority (Mattilsynet)](https://www.mattilsynet.no)
$md$,
  '/fish_catalog/salmon.png',
  'Atlantic salmon',
  'Planning',
  'Norway',
  'published',
  '2026-03-17T00:00:00Z',
  '2026-03-17T00:00:00Z',
  '2026-03-17T00:00:00Z'
)
ON CONFLICT (slug) DO NOTHING;
