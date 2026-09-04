-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: Patagonia — Chile, wave 1 (5 partners)
--
--   1. Alex Prior        — Fly Fishing Coyhaique   (Aysén)       RATES OK
--   2. Adam Henderson    — Flywise Anglers         (Aysén)       RATES OK
--   3. Natales Fly Fishing                          (Magallanes)  RATES OK (public only)
--   4. Javier Leppe      — Pristine Waters         (Magallanes)  price on request
--   5. Sebastián Fernández — Flygonia              (Magallanes)  price on request
--
-- Source: guides/*.md (correspondence Aug 30 – Sep 1 2026). Only what partners
-- actually wrote. Nothing invented about waters, prices or inclusions.
--
-- ⚠ NATALES FLY FISHING: this file contains their PUBLIC/retail rates only.
--   Their net rates are contractually confidential to FjordAnglers and must
--   never reach the database, the site, or any client-facing document.
--
-- ALL PAGES ARE SEEDED AS status = 'draft' — no partner has sent usable photos
-- yet. Activate one page at a time:
--   UPDATE experience_pages SET status = 'active' WHERE slug = '<slug>';
--
-- Currency is USD. NOTE: TripOptionsAccordion.tsx hardcodes the € symbol in
-- formatPrice(). Fix before activating.
-- ─────────────────────────────────────────────────────────────────────────────

SET ROLE postgres;

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. ALEX PRIOR — Fly Fishing Coyhaique
-- ═════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_guide_id UUID;
  v_exp_id   UUID;
BEGIN

  SELECT id INTO v_guide_id FROM guides WHERE slug = 'alex-prior';

  IF v_guide_id IS NULL THEN
    INSERT INTO guides (
      user_id, slug, is_beta_listing, is_hidden,
      full_name, country, city, tagline, bio,
      languages, fish_expertise, years_experience,
      website_url, invite_email,
      pricing_model, status, verified_at
    ) VALUES (
      NULL, 'alex-prior', true, false,
      'Alex Prior',
      'Chile',
      'Coyhaique',
      'Owner-operator on the Aysén spring creeks since 1989 — everything included, down to the licence',
      'Alex Prior has been guiding the Aysén region out of Coyhaique since 1989 — spring creeks, freestone rivers and lakes, wade and boat. He is an owner-operator with a genuinely all-in day rate: bilingual guiding, the fishing licence, flies, boats when they are needed and transport are all inside the price, which makes his days some of the easiest in Patagonia to quote without surprises stacked on top.',
      ARRAY['Spanish', 'English'],
      ARRAY['Brown Trout', 'Rainbow Trout'],
      37,
      'https://www.flyfishingcoyhaique.com/',
      'alexfishchile@gmail.com',
      'commission', 'active', NOW()
    )
    RETURNING id INTO v_guide_id;
    RAISE NOTICE 'Created guide alex-prior (id=%)', v_guide_id;
  END IF;

  IF EXISTS (SELECT 1 FROM experience_pages WHERE slug = 'fly-fishing-coyhaique-aysen') THEN
    RAISE NOTICE 'Experience page fly-fishing-coyhaique-aysen exists — skipping';
    RETURN;
  END IF;

  INSERT INTO experience_pages (
    guide_id, experience_name, slug, country, region, status,
    price_from, price_type, currency,
    difficulty, physical_effort, non_angler_friendly,
    technique, target_species, environment,
    intro_text, story_text, catches_text, rod_setup,
    best_months, season_start, season_end, season_months, peak_months,
    species_details, includes, excludes, what_to_bring,
    meeting_point_name, meeting_point_description,
    location_lat, location_lng,
    meta_title, meta_description
  ) VALUES (
    v_guide_id,
    'Spring Creeks & Freestones of Aysén — Coyhaique, Chile',
    'fly-fishing-coyhaique-aysen',
    'Chile', 'Aysén / Coyhaique', 'draft',
    600, 'flat', 'USD',
    'Beginner–Expert', 'Low–Medium', false,
    ARRAY['Fly fishing', 'Wade fishing', 'Boat fishing'],
    ARRAY['Brown Trout', 'Rainbow Trout'],
    ARRAY['Spring Creek', 'River', 'Lake'],
    -- intro_text
    'Coyhaique sits at the centre of the best trout water in Chilean Patagonia, and Alex Prior has been guiding it since 1989. Spring creeks that run clear over gravel, freestone rivers that change with every rain, and lakes tucked into the hills behind town. His day rate is all-in — guide, licence, flies, boat when it is needed, transport, lunch — which in a region where the licence alone is usually an extra makes the arithmetic unusually simple.',
    -- story_text
    'Aysén is the part of Chilean Patagonia that anglers who have been to Patagonia keep coming back to. Coyhaique is its capital in every sense: the town most of the region''s fishing runs out of, sitting in the middle of a web of spring creeks, freestone rivers and lakes.

Alex Prior started guiding here in 1989. That is not a marketing number — it is the reason he can decide, at seven in the morning, which of three or four options is the right one for the day''s weather, and be right. Spring creeks demand a stalking approach and light tippet; the freestones want a boat and a streamer when the water is up; the lakes are the answer on a day of hard wind. Knowing which is which is most of what a guide is for.

He works as an owner-operator, and the day is straightforwardly all-inclusive: bilingual guiding in Spanish or English, lunch, boats where the water calls for them, flies, the fishing licence, and transport. Gratuities are the only thing left off.

One practical note, and Alex is upfront about it: February and March are largely full for the 2026/27 season. He asks that requests come in anyway — plans change — but November, December and April are where the open water is.',
    -- catches_text
    'Wild brown and rainbow trout throughout the Aysén watersheds. The spring creeks are the sight-fishing water — individual fish, careful presentation, light tippet. The freestone rivers give bigger, faster water where a streamer covers ground, and the regional lakes come into their own when the wind makes the rivers unfishable.',
    -- rod_setup
    'A 5-weight for the spring creeks and a 6-weight for the freestones and the lakes covers the region. Floating lines throughout, with a sink tip worth having for streamer work when the rivers are up. Flies are included in the day rate. Whether rods, reels and waders are provided is still being confirmed — assume you are bringing your own until we say otherwise.',
    'November, December and April (February–March largely full for 2026/27)',
    'November', 'April',
    ARRAY[11, 12, 1, 2, 3, 4],
    ARRAY[12, 1, 2, 3],
    '[
      {
        "name": "Brown Trout",
        "description": "The signature fish of the Aysén spring creeks — wary, sight-fished in clear water over gravel, and the reason to fish light. Also throughout the freestone rivers, where a streamer is often the better approach.",
        "image_url": "",
        "image_urls": [],
        "season_months": [11, 12, 1, 2, 3, 4],
        "peak_months": [12, 1, 2, 3]
      },
      {
        "name": "Rainbow Trout",
        "description": "Widespread across the region''s rivers and lakes, and generally the more willing of the two. Strong fish in cold, fast freestone water.",
        "image_url": "",
        "image_urls": [],
        "season_months": [11, 12, 1, 2, 3, 4],
        "peak_months": [12, 1, 2, 3]
      }
    ]'::jsonb,
    ARRAY[
      'Bilingual guiding — Spanish and English',
      'Fishing licence',
      'Flies',
      'Boats when needed',
      'Transportation',
      'Lunch'
    ],
    ARRAY[
      'Gratuities',
      'Accommodation in Coyhaique'
    ],
    ARRAY[
      'Polarised sunglasses — essential on the spring creeks',
      'Waders and wading boots',
      'Layered clothing and a waterproof shell',
      'Hat with a brim',
      'Sunscreen'
    ],
    'Coyhaique',
    'Alex collects clients in Coyhaique; transport for the day is included in the rate. Availability is checked per request.',
    -45.57, -72.07,
    'Guided Fly Fishing in Coyhaique, Chilean Patagonia | FjordAnglers',
    'Spring creeks, freestone rivers and lakes around Coyhaique with Alex Prior, guiding Aysén since 1989. Licence, flies, boat and transport included. From USD 600 per day.'
  )
  RETURNING id INTO v_exp_id;

  INSERT INTO experience_page_options (
    experience_page_id, sort_order, label, price_from, price_type,
    catches_text, target_species, season_months, peak_months,
    includes, excludes, what_to_bring, content_blocks
  ) VALUES
  (
    v_exp_id, 0, 'Full Day — One Angler', 600, 'flat',
    'A full guided day on the water Alex judges best for the conditions: spring creek, freestone river or lake. Everything included except gratuities.',
    ARRAY['Brown Trout', 'Rainbow Trout'],
    ARRAY[11, 12, 1, 2, 3, 4], ARRAY[12, 1, 2, 3],
    ARRAY['Bilingual guide', 'Fishing licence', 'Flies', 'Boat when needed', 'Transportation', 'Lunch'],
    ARRAY['Gratuities'],
    ARRAY['Polarised sunglasses', 'Waders and boots', 'Waterproof shell', 'Sunscreen'],
    '[
      {
        "headline": "One Angler, One Guide",
        "text": "A day fished one-to-one with someone who has been guiding this region since 1989. Alex picks the water in the morning based on the weather and the river levels — spring creek on a still day, freestone with a streamer when it is up, lakes when the wind makes everything else pointless.\n\nUSD 600 for the day, and that figure genuinely is the figure: guiding, licence, flies, boat where needed, transport and lunch are all inside it.",
        "image_url": ""
      }
    ]'::jsonb
  ),
  (
    v_exp_id, 1, 'Full Day — Two Anglers', 685, 'flat',
    'The same day, shared. USD 685 for the pair works out at roughly USD 343 each — the best value full day, licence included, anywhere in our Patagonia network.',
    ARRAY['Brown Trout', 'Rainbow Trout'],
    ARRAY[11, 12, 1, 2, 3, 4], ARRAY[12, 1, 2, 3],
    ARRAY['Bilingual guide', 'Fishing licences', 'Flies', 'Boat when needed', 'Transportation', 'Lunch'],
    ARRAY['Gratuities'],
    ARRAY['Polarised sunglasses', 'Waders and boots', 'Waterproof shell', 'Sunscreen'],
    '[
      {
        "headline": "Two Rods, One Day",
        "text": "USD 685 for two anglers, everything included down to the fishing licence. For a pair travelling together this is the cheapest complete guided day in Chilean Patagonia that we know of, and it comes with thirty-plus years of local knowledge attached.\n\nA 40% deposit confirms the booking.",
        "image_url": ""
      }
    ]'::jsonb
  );

  RAISE NOTICE 'Created experience page + 2 options for alex-prior (exp=%)', v_exp_id;

END $$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 2. ADAM HENDERSON — Flywise Anglers
-- ═════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_guide_id UUID;
  v_exp_id   UUID;
BEGIN

  SELECT id INTO v_guide_id FROM guides WHERE slug = 'flywise-anglers';

  IF v_guide_id IS NULL THEN
    INSERT INTO guides (
      user_id, slug, is_beta_listing, is_hidden,
      full_name, country, city, tagline, bio,
      languages, fish_expertise, years_experience,
      website_url, invite_email,
      pricing_model, status, verified_at
    ) VALUES (
      NULL, 'flywise-anglers', true, false,
      'Adam Henderson',
      'Chile',
      'Coyhaique',
      'Two lodges, six rods a week, and a portfolio of water that covers every kind of trout fishing',
      'Adam Henderson runs Flywise Anglers in Chilean Patagonia with two small lodges and a maximum of six anglers per week. The signature program is a split-destination week: seven nights, six days of guided fishing across two bases, with transfers, guiding, licence, all meals and liquor included. The portfolio is deliberately diverse — float fishing on rivers, walk-and-wade on creeks, and sight fishing the lake flats for large browns on dry flies — so a week gets built around what the angler actually wants, from numbers and action through to double-digit trophy browns that take a steelheader''s patience. All skill levels.',
      ARRAY['English', 'Spanish'],
      ARRAY['Brown Trout', 'Rainbow Trout'],
      NULL,
      'https://flywiseanglers.com/',
      'picachoadventure@gmail.com',
      'commission', 'active', NOW()
    )
    RETURNING id INTO v_guide_id;
    RAISE NOTICE 'Created guide flywise-anglers (id=%)', v_guide_id;
  END IF;

  IF EXISTS (SELECT 1 FROM experience_pages WHERE slug = 'flywise-anglers-aysen-lodge-week') THEN
    RAISE NOTICE 'Experience page flywise-anglers-aysen-lodge-week exists — skipping';
    RETURN;
  END IF;

  INSERT INTO experience_pages (
    guide_id, experience_name, slug, country, region, status,
    price_from, price_type, currency,
    difficulty, physical_effort, non_angler_friendly,
    technique, target_species, environment,
    intro_text, story_text, catches_text, rod_setup,
    best_months, season_start, season_end, season_months, peak_months,
    species_details, includes, excludes, what_to_bring,
    meeting_point_name, meeting_point_description,
    location_lat, location_lng,
    meta_title, meta_description
  ) VALUES (
    v_guide_id,
    'Split-Destination Lodge Week in Aysén — Flywise Anglers, Chile',
    'flywise-anglers-aysen-lodge-week',
    'Chile', 'Aysén / Coyhaique', 'draft',
    7250, 'per_person', 'USD',
    'Beginner–Expert', 'Low–High', false,
    ARRAY['Fly fishing', 'Float fishing', 'Wade fishing', 'Sight fishing'],
    ARRAY['Brown Trout', 'Rainbow Trout'],
    ARRAY['River', 'Spring Creek', 'Lake', 'Lodge'],
    -- intro_text
    'Six anglers a week, two lodges, and a week built around the kind of fishing you actually came for. Flywise Anglers runs a split-destination program in Aysén: seven nights, six guided days, moving between two bases so the week covers river floats, walk-and-wade creeks and sight fishing the lake flats for big browns on dry flies. Transfers, guiding, licence, all meals and liquor are inside the price.',
    -- story_text
    'Most lodge weeks put you in one building and drive you out from it. Flywise splits the week between two lodges in different parts of Aysén, which changes what a week can contain: instead of variations on one watershed you get genuinely different fishing at each end of the trip.

The portfolio is the point. The Río Simpson and the Ñirehuao for river work, small creeks for walk-and-wade, and Lago Misterioso and the other lake flats for the thing Adam is most enthusiastic about — sight fishing to large brown trout with dry flies in shallow water. Between them these cover the whole range, from a week of numbers and action for someone who wants to bend a rod, to a hunt for double-digit browns that, in his own words, requires a steelheader''s mentality to pursue.

Six anglers is the weekly maximum and guiding is based on two anglers sharing a guide, so nothing about the week feels industrial. All skill levels are welcome, and Adam means it — the week is shaped to the angler rather than the other way around.

Timing genuinely matters here and he is explicit about it. Rivers can be swollen with run-off in November, which sounds like a reason to avoid it until you know that November is exactly when sight fishing for trophy trout on the lakes is at its peak. Grasshopper fishing starts in mid-January. So the first question is not when you are free — it is what you want to catch and how.

Seven nights and six days is the minimum stay for 2026/27. Shorter stays are possible in the shoulder months — November, December and April — case by case, and cabins being added at each lodge should make short stays generally available from 2028.',
    -- catches_text
    'Brown and rainbow trout across rivers, creeks and lake flats — including double-digit trophy browns for anglers prepared to hunt for a small number of very good fish. Grasshopper fishing from mid-January; lake sight fishing at its best in the early season when the rivers are still carrying run-off.',
    -- rod_setup
    'A 6-weight covers most of the week; a 7-weight is the better tool for the big-fish lake work and for streamers when the rivers are up. Floating lines throughout for dry-fly and sight fishing, with sink tips for river streamer work. Rods, reels and flies are not included — bring your own.',
    'December–April, with November the peak for lake sight fishing and hoppers from mid-January',
    'December', 'April',
    ARRAY[12, 1, 2, 3, 4],
    ARRAY[1, 2, 3],
    '[
      {
        "name": "Brown Trout",
        "description": "The headline fish, and the reason to think carefully about dates. Double-digit trophy browns are sight-fished on the lake flats with dry flies — Adam describes the pursuit as requiring a steelheader''s mentality, meaning few chances and total commitment to each one. River browns on the Simpson and Ñirehuao offer a more conventional and higher-volume alternative in the same week.",
        "image_url": "",
        "image_urls": [],
        "season_months": [12, 1, 2, 3, 4],
        "peak_months": [1, 2, 3]
      },
      {
        "name": "Rainbow Trout",
        "description": "Through the river and creek systems of the region, and the fish that makes a week of numbers and action possible for anglers who do not want to spend six days hunting one trophy.",
        "image_url": "",
        "image_urls": [],
        "season_months": [12, 1, 2, 3, 4],
        "peak_months": [1, 2, 3]
      }
    ]'::jsonb,
    ARRAY[
      'All transfers to and from Balmaceda Airport (Coyhaique) and the lodges',
      'Accommodation based on two anglers sharing a room with a private bathroom',
      'Daily guided fly fishing, based on two anglers sharing one guide',
      'Fishing licence',
      'All meals',
      'Liquor'
    ],
    ARRAY[
      'Gratuities',
      'Personal gear',
      'Rods, reels and flies',
      'International and domestic airfare'
    ],
    ARRAY[
      'Rods and reels — 6-weight and 7-weight',
      'Your own flies',
      'Waders and wading boots',
      'Polarised sunglasses',
      'Layered clothing and a waterproof shell',
      'Hat with a brim and sunscreen'
    ],
    'Balmaceda Airport (BBA), Coyhaique',
    'Fly into Balmaceda Airport. Transfers to and from both lodges are included in the program price.',
    -45.57, -72.07,
    'Flywise Anglers — Split-Destination Lodge Week in Aysén, Chile | FjordAnglers',
    'Seven nights, six guided days across two small lodges in Chilean Patagonia. Six anglers a week, trophy browns on the lake flats, transfers, licence, meals and liquor included. From USD 7,250.'
  )
  RETURNING id INTO v_exp_id;

  INSERT INTO experience_page_options (
    experience_page_id, sort_order, label, price_from, price_type,
    catches_text, target_species, season_months, peak_months,
    includes, excludes, what_to_bring, content_blocks
  ) VALUES
  (
    v_exp_id, 0, '7 Nights / 6 Guided Days — Split Destination', 7250, 'per_person',
    'The signature week and the minimum stay for 2026/27. Seven nights, six days of guided fishing, split between two lodges so the week covers river floats, walk-and-wade creeks and lake sight fishing. Based on two anglers sharing a room and a guide.',
    ARRAY['Brown Trout', 'Rainbow Trout'],
    ARRAY[12, 1, 2, 3, 4], ARRAY[1, 2, 3],
    ARRAY['All airport transfers', 'Accommodation, double occupancy with private bathroom', 'Six guided fishing days, two anglers per guide', 'Fishing licence', 'All meals', 'Liquor'],
    ARRAY['Gratuities', 'Rods, reels and flies', 'Personal gear', 'Airfare'],
    ARRAY['Rods and reels', 'Flies', 'Waders and boots', 'Polarised sunglasses', 'Waterproof shell'],
    '[
      {
        "headline": "Two Lodges, One Week",
        "text": "The week moves between two lodges in different parts of Aysén, which is what lets it cover river floats, walk-and-wade creeks and sight fishing the lake flats without repeating itself.\n\nAdam builds each week around what the angler is actually after — strictly trophy hunting, float fishing only, creeks, lake sight fishing, or a combination — so tell us that before we hold dates. It changes which weeks are worth taking.\n\nUSD 7,250 per person. A 50% deposit within two weeks of booking secures the reservation; the balance is due 60 days before the trip.",
        "image_url": ""
      }
    ]'::jsonb
  ),
  (
    v_exp_id, 1, '13 Nights / 12 Guided Days', 13250, 'per_person',
    'Two weeks of fishing across both lodges, all-inclusive on the same basis as the seven-night program.',
    ARRAY['Brown Trout', 'Rainbow Trout'],
    ARRAY[12, 1, 2, 3, 4], ARRAY[1, 2, 3],
    ARRAY['All airport transfers', 'Accommodation, double occupancy', 'Twelve guided fishing days', 'Fishing licence', 'All meals', 'Liquor'],
    ARRAY['Gratuities', 'Rods, reels and flies', 'Airfare'],
    ARRAY['Rods and reels', 'Flies', 'Waders and boots', 'Polarised sunglasses'],
    '[]'::jsonb
  ),
  (
    v_exp_id, 2, '14 Nights / 13 Guided Days', 14250, 'per_person',
    'The longest standard program — thirteen guided days across the full portfolio of rivers, creeks and lakes.',
    ARRAY['Brown Trout', 'Rainbow Trout'],
    ARRAY[12, 1, 2, 3, 4], ARRAY[1, 2, 3],
    ARRAY['All airport transfers', 'Accommodation, double occupancy', 'Thirteen guided fishing days', 'Fishing licence', 'All meals', 'Liquor'],
    ARRAY['Gratuities', 'Rods, reels and flies', 'Airfare'],
    ARRAY['Rods and reels', 'Flies', 'Waders and boots', 'Polarised sunglasses'],
    '[]'::jsonb
  ),
  (
    v_exp_id, 3, 'Shoulder-Season Short Stay — November, December, April', 0, 'request',
    'Shorter than seven nights, considered case by case in the shoulder months only. November is the peak for sight fishing trophy browns on the lake flats even though the rivers may still be carrying run-off — which makes a short early-season stay a genuinely different product, not a compromise.',
    ARRAY['Brown Trout', 'Rainbow Trout'],
    ARRAY[11, 12, 4], ARRAY[11, 12],
    ARRAY['Transfers', 'Accommodation', 'Guided fishing', 'Fishing licence', 'All meals', 'Liquor'],
    ARRAY['Gratuities', 'Rods, reels and flies', 'Airfare'],
    ARRAY['Rods and reels', 'Flies', 'Waders and boots', 'Polarised sunglasses'],
    '[
      {
        "headline": "Why November Is Not the Off Season",
        "text": "Adam is blunt about timing: rivers can be swollen with run-off in November — and that is exactly when sight fishing for trophy trout on the lakes is at its peak. Grasshopper fishing starts mid-January. Different months are not better or worse here, they are different fisheries.\n\nShort stays outside the seven-night minimum are possible in November, December and April, case by case. Ask and we will put it to him.",
        "image_url": ""
      }
    ]'::jsonb
  );

  RAISE NOTICE 'Created experience page + 4 options for flywise-anglers (exp=%)', v_exp_id;

END $$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 3. NATALES FLY FISHING
--    PUBLIC RATES ONLY. Net rates stay out of the database — contractual.
-- ═════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_guide_id UUID;
  v_exp_id   UUID;
BEGIN

  SELECT id INTO v_guide_id FROM guides WHERE slug = 'natales-fly-fishing';

  IF v_guide_id IS NULL THEN
    INSERT INTO guides (
      user_id, slug, is_beta_listing, is_hidden,
      full_name, country, city, tagline, bio,
      languages, fish_expertise, years_experience,
      website_url, instagram_url, invite_email,
      pricing_model, status, verified_at
    ) VALUES (
      NULL, 'natales-fly-fishing', true, false,
      'Natales Fly Fishing',
      'Chile',
      'Puerto Natales',
      'Orvis-endorsed outfitter with permitted access to Torres del Paine',
      'Natales Fly Fishing is an Orvis Endorsed Outfitter working out of Puerto Natales, with certified guides, authorised transport and access to a range of exclusive private waters. The operation complies with SERNATUR, CONAF and Torres del Paine National Park requirements — the permits matter, because they open water most operators in the region cannot legally fish. Two multi-day products sit alongside standalone guided days: hotel-based programs out of Puerto Natales, and a ranch program at Estancia Río Penitente.',
      ARRAY['English', 'Spanish'],
      ARRAY['Sea-run Brown Trout', 'Brown Trout', 'Brook Trout', 'Chinook Salmon'],
      NULL,
      'https://www.natalesflyfishing.com/',
      'https://www.instagram.com/natalesflyfishing',
      'info@natalesflyfishing.com',
      'commission', 'active', NOW()
    )
    RETURNING id INTO v_guide_id;
    RAISE NOTICE 'Created guide natales-fly-fishing (id=%)', v_guide_id;
  END IF;

  IF EXISTS (SELECT 1 FROM experience_pages WHERE slug = 'fly-fishing-torres-del-paine-puerto-natales') THEN
    RAISE NOTICE 'Experience page fly-fishing-torres-del-paine-puerto-natales exists — skipping';
    RETURN;
  END IF;

  INSERT INTO experience_pages (
    guide_id, experience_name, slug, country, region, status,
    price_from, price_type, currency,
    difficulty, physical_effort, non_angler_friendly,
    technique, target_species, environment,
    intro_text, story_text, catches_text, rod_setup,
    best_months, season_start, season_end, season_months, peak_months,
    species_details, includes, excludes, what_to_bring,
    meeting_point_name, meeting_point_description,
    location_lat, location_lng,
    meta_title, meta_description
  ) VALUES (
    v_guide_id,
    'Torres del Paine & the Magallanes Rivers — Puerto Natales, Chile',
    'fly-fishing-torres-del-paine-puerto-natales',
    'Chile', 'Magallanes / Torres del Paine', 'draft',
    600, 'flat', 'USD',
    'Beginner–Expert', 'Low–Medium', true,
    ARRAY['Fly fishing', 'Wade fishing', 'Sight fishing'],
    ARRAY['Sea-run Brown Trout', 'Chinook Salmon', 'Brook Trout', 'Brown Trout'],
    ARRAY['River', 'Spring Creek', 'National Park', 'Estancia'],
    -- intro_text
    'Sea-run brown trout on the Río Penitente, Chinook salmon on the Serrano, brook trout on private water, and permitted access to fish inside Torres del Paine National Park — the last of which almost nobody else in the region has. Natales Fly Fishing is an Orvis Endorsed Outfitter, and the paperwork behind that is the reason its clients get on water others cannot legally touch.',
    -- story_text
    'Puerto Natales is where people go to walk Torres del Paine. It is also, quietly, one of the best-placed fishing bases in southern Chile — and the operation that has done the most with that position is Natales Fly Fishing.

What sets them apart is not a secret pool. It is compliance. The operation meets SERNATUR, CONAF and Torres del Paine National Park requirements, with certified professional guides, authorised transportation and access to a range of exclusive private fishing waters. In a region where a great deal of the best water sits inside a national park or behind an estancia gate, being allowed to fish it is the whole game.

The water itself covers most of what southern Patagonia offers. The Río Penitente holds sea-run brown trout and also serves as the base for the ranch program. The Río Serrano runs Chinook salmon. Brook trout and resident browns fill in the private waters and spring creeks around them. And the park water is park water — scenery that does not need describing and pressure that is a fraction of what its fame would suggest.

Three ways to fish it. A standalone guided day, priced per trip for one to three anglers, which makes it easy to bolt onto a Torres del Paine trekking trip. A hotel-based program of three to six nights out of Puerto Natales, staying at Hotel Kawi. Or the ranch program at Estancia Río Penitente, three to six nights on the water itself.

They are an Orvis Endorsed Outfitter for 2026, and the season runs October through April with availability open across 2026/27.',
    -- catches_text
    'Sea-run brown trout on the Río Penitente are the regional prize — fresh fish from the sea, fought in cold water. Chinook salmon run the Río Serrano. Brook trout and resident brown trout populate the spring creeks and exclusive private waters, and the Torres del Paine park water adds fishing most visitors to the park never realise is possible.',
    -- rod_setup
    'A 7- or 8-weight for sea-run browns and Chinook, with sinking or intermediate lines and a floating line for the calmer days; a 5- or 6-weight for the brook trout and spring-creek work. Wind is the constant in Magallanes — bring a rod you can drive into it. Full inclusions per program are being extracted from their 2026/27 brochures.',
    'October–April, availability open across the 2026/27 season',
    'October', 'April',
    ARRAY[10, 11, 12, 1, 2, 3, 4],
    ARRAY[12, 1, 2, 3],
    '[
      {
        "name": "Sea-run Brown Trout",
        "description": "The Río Penitente is the water these are built around — brown trout that have run to sea and returned, silver, heavy and hard-fighting. The same river hosts the estancia that the ranch program is based on.",
        "image_url": "",
        "image_urls": [],
        "season_months": [10, 11, 12, 1, 2, 3, 4],
        "peak_months": [12, 1, 2, 3]
      },
      {
        "name": "Chinook Salmon",
        "description": "Introduced Chinook — king salmon — run the Río Serrano. A big, powerful fish in a river running out of the Torres del Paine massif, and a fishery very few international anglers have on their list.",
        "image_url": "",
        "image_urls": [],
        "season_months": [1, 2, 3, 4],
        "peak_months": [2, 3]
      },
      {
        "name": "Brook Trout",
        "description": "Found on the exclusive private waters the outfitter has access to. A different, gentler day to the sea-run fishing and a good option when wind shuts down the bigger water.",
        "image_url": "",
        "image_urls": [],
        "season_months": [10, 11, 12, 1, 2, 3, 4],
        "peak_months": [12, 1, 2]
      },
      {
        "name": "Brown Trout",
        "description": "Resident browns through the spring creeks and private waters around Puerto Natales, including water inside Torres del Paine National Park where the outfitter''s permits allow it.",
        "image_url": "",
        "image_urls": [],
        "season_months": [10, 11, 12, 1, 2, 3, 4],
        "peak_months": [12, 1, 2, 3]
      }
    ]'::jsonb,
    ARRAY[
      'Certified professional guides',
      'Authorised transportation',
      'Access to exclusive private fishing waters and permitted Torres del Paine water'
    ],
    ARRAY[
      'Airfare',
      'Gratuities',
      'Full per-program inclusions to be confirmed from the 2026/27 brochures'
    ],
    ARRAY[
      'Polarised sunglasses',
      'Waders and wading boots',
      'A genuinely windproof shell — Magallanes wind is not a formality',
      'Warm layers',
      'Hat with a brim and sunscreen'
    ],
    'Puerto Natales',
    'All programs run out of Puerto Natales, with authorised transport to the water. The ranch program is based at Estancia Río Penitente; hotel programs use Hotel Kawi in town.',
    -51.73, -72.49,
    'Fly Fishing Torres del Paine & Puerto Natales, Chile | FjordAnglers',
    'Orvis-endorsed outfitter with permitted access inside Torres del Paine. Sea-run browns on the Penitente, Chinook on the Serrano, brook trout on private water. Guided days from USD 600.'
  )
  RETURNING id INTO v_exp_id;

  INSERT INTO experience_page_options (
    experience_page_id, sort_order, label, price_from, price_type,
    catches_text, target_species, season_months, peak_months,
    includes, excludes, what_to_bring, content_blocks
  ) VALUES
  (
    v_exp_id, 0, 'Guided Day — 1 to 3 Anglers', 600, 'flat',
    'A single guided day, priced per trip rather than per rod: USD 600 for one angler, USD 900 for two, USD 1,200 for three. The easiest way to add a day''s fishing to a Torres del Paine trip.',
    ARRAY['Sea-run Brown Trout', 'Brown Trout', 'Brook Trout', 'Chinook Salmon'],
    ARRAY[10, 11, 12, 1, 2, 3, 4], ARRAY[12, 1, 2, 3],
    ARRAY['Certified guide', 'Authorised transportation', 'Access to private and permitted waters'],
    ARRAY['Airfare', 'Gratuities'],
    ARRAY['Polarised sunglasses', 'Waders and boots', 'Windproof shell', 'Warm layers'],
    '[
      {
        "headline": "A Day Inside the Park",
        "text": "Natales Fly Fishing holds the SERNATUR, CONAF and Torres del Paine permissions that let them fish water inside the park — something most operators in the region simply cannot offer.\n\nThe day is priced per trip, not per rod: USD 600 for one angler, USD 900 for two, USD 1,200 for three. Bring a friend and the per-person figure drops sharply.",
        "image_url": ""
      }
    ]'::jsonb
  ),
  (
    v_exp_id, 1, 'Hotel Kawi Program — 3 to 6 Nights', 2130, 'per_person',
    'A hotel-based program out of Puerto Natales, staying at Hotel Kawi. Three nights with two fishing days from USD 2,130 per person on double occupancy, up to six nights with five fishing days at USD 4,260. Single occupancy is available at a supplement.',
    ARRAY['Sea-run Brown Trout', 'Brown Trout', 'Brook Trout'],
    ARRAY[10, 11, 12, 1, 2, 3, 4], ARRAY[12, 1, 2, 3],
    ARRAY['Accommodation at Hotel Kawi', 'Certified guides on every fishing day', 'Authorised transportation', 'Access to private and permitted waters'],
    ARRAY['Airfare', 'Gratuities', 'Full inclusions to be confirmed from the 2026/27 brochure'],
    ARRAY['Polarised sunglasses', 'Waders and boots', 'Windproof shell', 'Warm layers'],
    '[
      {
        "headline": "Based in Town",
        "text": "Three to six nights at Hotel Kawi in Puerto Natales, fishing a different water each day — the Penitente for sea-run browns, private spring creeks, park water where the permits allow.\n\nFrom USD 2,130 per person for three nights and two fishing days on double occupancy, rising to USD 4,260 for six nights and five fishing days. Solo travellers pay a single supplement.",
        "image_url": ""
      }
    ]'::jsonb
  ),
  (
    v_exp_id, 2, 'Estancia Río Penitente Ranch Program — 3 to 6 Nights', 3300, 'per_person',
    'Based on the ranch, on the river. Three nights with two fishing days from USD 3,300 per person on double occupancy, up to six nights with five fishing days at USD 6,600. Single occupancy at a supplement.',
    ARRAY['Sea-run Brown Trout', 'Brown Trout'],
    ARRAY[10, 11, 12, 1, 2, 3, 4], ARRAY[12, 1, 2, 3],
    ARRAY['Accommodation at Estancia Río Penitente', 'Certified guides on every fishing day', 'Authorised transportation', 'Access to the estancia water'],
    ARRAY['Airfare', 'Gratuities', 'Full inclusions to be confirmed from the 2026/27 brochure'],
    ARRAY['Polarised sunglasses', 'Waders and boots', 'Windproof shell', 'Warm layers'],
    '[
      {
        "headline": "Sleeping on the Penitente",
        "text": "The ranch program puts you on the estancia the sea-run brown trout river runs through — no drive to the water in the morning, and the option of fishing the evening as well as the day.\n\nFrom USD 3,300 per person for three nights and two fishing days, double occupancy, to USD 6,600 for six nights and five fishing days.",
        "image_url": ""
      }
    ]'::jsonb
  );

  RAISE NOTICE 'Created experience page + 3 options for natales-fly-fishing (exp=%)', v_exp_id;

END $$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 4. JAVIER LEPPE — Pristine Waters
--    Rates outstanding. Page exists for the Chinook story, priced on request.
-- ═════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_guide_id UUID;
  v_exp_id   UUID;
BEGIN

  SELECT id INTO v_guide_id FROM guides WHERE slug = 'javier-leppe';

  IF v_guide_id IS NULL THEN
    INSERT INTO guides (
      user_id, slug, is_beta_listing, is_hidden,
      full_name, country, city, tagline, bio,
      languages, fish_expertise, years_experience,
      website_url, instagram_url, invite_email,
      pricing_model, status, verified_at
    ) VALUES (
      NULL, 'javier-leppe', true, false,
      'Javier Leppe',
      'Chile',
      'Punta Arenas',
      'Chinook salmon and sea-run browns in Chilean Tierra del Fuego — walk and wade, small private groups',
      'Javier Leppe is the founder and guide behind Pristine Waters, working out of Punta Arenas across Magallanes and Chilean Tierra del Fuego. He fishes walk-and-wade with small private groups, run by run. His most distinctive offer is Chinook — king — salmon in the Río Grande area of Chilean Tierra del Fuego, a fishery almost nobody sells to international clients, alongside sea-run brown trout in the same region and resident browns in the Magallanes spring creeks.',
      ARRAY['Spanish', 'English'],
      ARRAY['Chinook Salmon', 'Sea-run Brown Trout', 'Brown Trout'],
      NULL,
      'https://www.pristinewaters.cl/',
      'https://www.instagram.com/pristinewaters_flyfishing',
      'info@pristinewaters.cl',
      'commission', 'active', NOW()
    )
    RETURNING id INTO v_guide_id;
    RAISE NOTICE 'Created guide javier-leppe (id=%)', v_guide_id;
  END IF;

  IF EXISTS (SELECT 1 FROM experience_pages WHERE slug = 'chinook-sea-run-browns-chilean-tierra-del-fuego') THEN
    RAISE NOTICE 'Experience page chinook-sea-run-browns-chilean-tierra-del-fuego exists — skipping';
    RETURN;
  END IF;

  INSERT INTO experience_pages (
    guide_id, experience_name, slug, country, region, status,
    price_from, price_type, currency,
    difficulty, physical_effort, non_angler_friendly,
    technique, target_species, environment,
    intro_text, story_text, catches_text, rod_setup,
    best_months, season_start, season_end, season_months, peak_months,
    species_details, includes, excludes, what_to_bring,
    meeting_point_name, meeting_point_description,
    location_lat, location_lng,
    meta_title, meta_description
  ) VALUES (
    v_guide_id,
    'Chinook Salmon & Sea-Run Browns — Chilean Tierra del Fuego',
    'chinook-sea-run-browns-chilean-tierra-del-fuego',
    'Chile', 'Magallanes / Tierra del Fuego', 'draft',
    0, 'request', 'USD',
    'Intermediate–Expert', 'Medium–High', false,
    ARRAY['Fly fishing', 'Wade fishing', 'Spey casting'],
    ARRAY['Chinook Salmon', 'Sea-run Brown Trout', 'Brown Trout'],
    ARRAY['River', 'Spring Creek'],
    -- intro_text
    'Everyone knows the Argentine side of Tierra del Fuego. Almost nobody fishes the Chilean one. Javier Leppe guides the Río Grande area of Chilean Tierra del Fuego for Chinook salmon in October and November, and for sea-run brown trout in the same water from November through April — walk and wade, small private groups, run by run.',
    -- story_text
    'The Río Grande is one of the most famous names in fly fishing, and what that name usually means is the Argentine side: the great sea-trout lodges, the beat rotations, the price bracket that goes with them.

The Chilean side of Tierra del Fuego is a different proposition, and it is where Javier Leppe wants the conversation. He guides the Río Grande area on the Chilean side for two things. From October into November, Chinook salmon — king salmon, running fish, in a fishery that is barely sold to international anglers at all. From November through April, sea-run brown trout in the same region.

Outside Tierra del Fuego he fishes the Magallanes spring creeks for resident brown trout, from October through April, which gives a softer, more technical day for anyone who wants variety or who draws a week of hard wind.

Javier works walk-and-wade, in small private groups, moving run by run rather than sitting a beat. He runs Pristine Waters himself: the person you speak to is the person who guides you.

This is the newest partnership in our Patagonia network and the logistics are still being pinned down — how clients reach Tierra del Fuego, where they sleep, and what a sensible minimum trip length looks like. Send us a brief and we will get you concrete answers before anything is held.',
    -- catches_text
    'Chinook salmon in the Río Grande area of Chilean Tierra del Fuego through October and November — big, fresh, aggressive fish. Sea-run brown trout in the same region from November through April. Resident brown trout in the Magallanes spring creeks from October through April, for a lighter and more technical day.',
    -- rod_setup
    'An 8-weight single-hand or a switch rod for Chinook and sea-run browns, with sinking tips and a floating line for the flat-calm mornings; a 5- or 6-weight for the spring creeks. Wind dictates everything in Magallanes. Whether gear, waders and licences are provided is still to be confirmed.',
    'October–November for Chinook · November–April for sea-run browns',
    'October', 'April',
    ARRAY[10, 11, 12, 1, 2, 3, 4],
    ARRAY[10, 11, 12, 1],
    '[
      {
        "name": "Chinook Salmon",
        "description": "The reason to look at this trip. Chinook — king salmon — run the Río Grande area of Chilean Tierra del Fuego through October and November. It is a fishery almost nobody sells to international clients, which means water without a rotation of rods on it. Catch rates, average size and whether the fishing is from the bank or a boat are still being confirmed with Javier.",
        "image_url": "",
        "image_urls": [],
        "season_months": [10, 11],
        "peak_months": [10, 11]
      },
      {
        "name": "Sea-run Brown Trout",
        "description": "From November through April the same region turns over to sea-run browns — the fish Tierra del Fuego is famous for, on the side of the island that does not carry the famous price tag.",
        "image_url": "",
        "image_urls": [],
        "season_months": [11, 12, 1, 2, 3, 4],
        "peak_months": [12, 1, 2]
      },
      {
        "name": "Brown Trout",
        "description": "Resident browns in the Magallanes spring creeks around Punta Arenas, October through April. Lighter tackle, more technical fishing, and the sensible alternative on a day when the wind makes the big water unfishable.",
        "image_url": "",
        "image_urls": [],
        "season_months": [10, 11, 12, 1, 2, 3, 4],
        "peak_months": [12, 1, 2]
      }
    ]'::jsonb,
    ARRAY['Private guiding in small groups', 'Walk-and-wade access, run by run'],
    ARRAY['Fishing licence — to be confirmed', 'Accommodation on Tierra del Fuego trips — to be confirmed', 'Gratuities'],
    ARRAY[
      'An 8-weight rod, or a switch rod, for the sea-run and Chinook water',
      'Waders and wading boots',
      'A genuinely windproof shell',
      'Polarised sunglasses',
      'Warm layers'
    ],
    'Punta Arenas',
    'Trips start from Punta Arenas. Tierra del Fuego programs carry their own logistics — access, accommodation and a sensible minimum length are being confirmed with the guide.',
    -53.16, -70.91,
    'Chinook Salmon & Sea-Run Brown Trout, Chilean Tierra del Fuego | FjordAnglers',
    'Fish the Chilean side of Tierra del Fuego with Javier Leppe of Pristine Waters — Chinook salmon in October and November, sea-run browns through April. Walk and wade, small private groups.'
  )
  RETURNING id INTO v_exp_id;

  INSERT INTO experience_page_options (
    experience_page_id, sort_order, label, price_from, price_type,
    catches_text, target_species, season_months, peak_months,
    includes, excludes, what_to_bring, content_blocks
  ) VALUES
  (
    v_exp_id, 0, 'Chinook Program — Río Grande Area, Chilean Tierra del Fuego', 0, 'request',
    'October and November, targeting Chinook salmon in the Río Grande area of Chilean Tierra del Fuego. A fishery that is essentially unsold internationally.',
    ARRAY['Chinook Salmon'],
    ARRAY[10, 11], ARRAY[10, 11],
    ARRAY['Private guiding', 'Walk-and-wade access'],
    ARRAY['Licence and accommodation — to be confirmed', 'Gratuities'],
    ARRAY['8-weight or switch rod', 'Waders and boots', 'Windproof shell'],
    '[]'::jsonb
  ),
  (
    v_exp_id, 1, 'Sea-Run Brown Trout — November to April', 0, 'request',
    'The same Tierra del Fuego water, from November through April, for sea-run brown trout.',
    ARRAY['Sea-run Brown Trout'],
    ARRAY[11, 12, 1, 2, 3, 4], ARRAY[12, 1, 2],
    ARRAY['Private guiding', 'Walk-and-wade access'],
    ARRAY['Licence and accommodation — to be confirmed', 'Gratuities'],
    ARRAY['8-weight or switch rod', 'Waders and boots', 'Windproof shell'],
    '[]'::jsonb
  ),
  (
    v_exp_id, 2, 'Guided Day — Magallanes Spring Creeks', 0, 'request',
    'A day on the spring creeks around Punta Arenas for resident brown trout, October through April. Lighter, more technical, and the right call when the wind is up.',
    ARRAY['Brown Trout'],
    ARRAY[10, 11, 12, 1, 2, 3, 4], ARRAY[12, 1, 2],
    ARRAY['Private guiding', 'Walk-and-wade access'],
    ARRAY['Licence — to be confirmed', 'Gratuities'],
    ARRAY['5- or 6-weight rod', 'Waders and boots', 'Polarised sunglasses'],
    '[]'::jsonb
  );

  RAISE NOTICE 'Created experience page + 3 options for javier-leppe (exp=%)', v_exp_id;

END $$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 5. SEBASTIÁN FERNÁNDEZ — Flygonia
--    Instagram-only contact, no rates, no website. Guide hidden until the call.
-- ═════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_guide_id UUID;
  v_exp_id   UUID;
BEGIN

  SELECT id INTO v_guide_id FROM guides WHERE slug = 'sebastian-fernandez';

  IF v_guide_id IS NULL THEN
    INSERT INTO guides (
      user_id, slug, is_beta_listing, is_hidden,
      full_name, country, city, tagline, bio,
      languages, fish_expertise, years_experience,
      instagram_url,
      pricing_model, status, verified_at
    ) VALUES (
      NULL, 'sebastian-fernandez', true, true,
      'Sebastián Fernández',
      'Chile',
      'Punta Arenas',
      'Three Magallanes regions in one season, matched month by month',
      'Sebastián Fernández guides across three distinct areas of Chilean Patagonia — Punta Arenas, Puerto Natales and Torres del Paine, and Tierra del Fuego — with different fishing on offer depending on the month. Walk and wade. His season is sharply defined: 16 October to 14 April.',
      ARRAY['Spanish', 'English'],
      ARRAY['Brown Trout', 'Sea-run Brown Trout', 'Brook Trout'],
      NULL,
      'https://www.instagram.com/watifly90',
      'commission', 'active', NOW()
    )
    RETURNING id INTO v_guide_id;
    RAISE NOTICE 'Created guide sebastian-fernandez (id=%) — is_hidden = true until the call happens', v_guide_id;
  END IF;

  IF EXISTS (SELECT 1 FROM experience_pages WHERE slug = 'walk-and-wade-magallanes-punta-arenas') THEN
    RAISE NOTICE 'Experience page walk-and-wade-magallanes-punta-arenas exists — skipping';
    RETURN;
  END IF;

  INSERT INTO experience_pages (
    guide_id, experience_name, slug, country, region, status,
    price_from, price_type, currency,
    difficulty, physical_effort, non_angler_friendly,
    technique, target_species, environment,
    intro_text, story_text, catches_text, rod_setup,
    best_months, season_start, season_end, season_months, peak_months,
    species_details, includes, excludes, what_to_bring,
    meeting_point_name, meeting_point_description,
    location_lat, location_lng,
    meta_title, meta_description
  ) VALUES (
    v_guide_id,
    'Walk & Wade Across Magallanes — Punta Arenas, Chile',
    'walk-and-wade-magallanes-punta-arenas',
    'Chile', 'Magallanes / Torres del Paine / Tierra del Fuego', 'draft',
    0, 'request', 'USD',
    'Beginner–Advanced', 'Medium', false,
    ARRAY['Fly fishing', 'Wade fishing'],
    ARRAY['Brown Trout', 'Sea-run Brown Trout', 'Brook Trout'],
    ARRAY['River', 'Spring Creek', 'Lake', 'National Park'],
    'Three regions, one guide, one sharply defined season. Sebastián Fernández fishes Punta Arenas, Puerto Natales and Torres del Paine, and Tierra del Fuego, and the month decides which. Walk and wade, 16 October to 14 April.',
    'Magallanes is not one fishery. It is several, spread across hundreds of kilometres, and which one is worth your time depends almost entirely on when you arrive.

Sebastián Fernández works all three of the main areas. Around Punta Arenas: the Río Penitente, Laguna Parrillar and the spring creeks. North to Puerto Natales and Torres del Paine. And across to Tierra del Fuego. Walk and wade throughout — no boats, just water covered on foot.

His season is unusually precise, and the reason is unglamorous and reassuring: 16 October to 14 April, because outside those dates he works at a ski centre. When a guide tells you exactly when his season starts and ends, he is telling you he is not going to take your money for a week that does not fish.

We are still building out the detail on this one — day rates, what is included, and above all which area fishes best in which month, which is the whole value of working with someone who covers all three. Ask us and we will get answers before you commit to dates.',
    'Brown trout, sea-run brown trout and brook trout across the three Magallanes areas. The full species list per area is still being confirmed with the guide.',
    'A 6-weight for the spring creeks and lakes and an 8-weight for the sea-run water is a safe pair for a Magallanes trip. A windproof shell matters more here than any rod choice. Gear and licence policy still to be confirmed.',
    '16 October – 14 April, with the best area varying by month',
    'October', 'April',
    ARRAY[10, 11, 12, 1, 2, 3, 4],
    ARRAY[11, 12, 1, 2],
    '[
      {
        "name": "Brown Trout",
        "description": "Resident browns in the spring creeks and lakes around Punta Arenas, including Laguna Parrillar, and through the Puerto Natales and Torres del Paine waters.",
        "image_url": "",
        "image_urls": [],
        "season_months": [10, 11, 12, 1, 2, 3, 4],
        "peak_months": [11, 12, 1, 2]
      },
      {
        "name": "Sea-run Brown Trout",
        "description": "On the Río Penitente and the Tierra del Fuego water, depending on the month.",
        "image_url": "",
        "image_urls": [],
        "season_months": [11, 12, 1, 2, 3, 4],
        "peak_months": [12, 1, 2]
      },
      {
        "name": "Brook Trout",
        "description": "Present in parts of the Magallanes system. Full distribution by area still being confirmed.",
        "image_url": "",
        "image_urls": [],
        "season_months": [10, 11, 12, 1, 2, 3, 4],
        "peak_months": [12, 1, 2]
      }
    ]'::jsonb,
    ARRAY['Private walk-and-wade guiding'],
    ARRAY['Licence, gear and transport — to be confirmed', 'Accommodation', 'Gratuities'],
    ARRAY[
      'Polarised sunglasses',
      'Waders and wading boots',
      'A genuinely windproof shell',
      'Warm layers',
      'Hat with a brim'
    ],
    'Punta Arenas',
    'Based in Punta Arenas, working north to Puerto Natales and Torres del Paine and across to Tierra del Fuego depending on the month.',
    -53.16, -70.91,
    'Walk & Wade Fly Fishing in Magallanes — Punta Arenas, Chile | FjordAnglers',
    'Punta Arenas, Torres del Paine and Tierra del Fuego with Sebastián Fernández — walk-and-wade guiding across three Magallanes regions, 16 October to 14 April.'
  )
  RETURNING id INTO v_exp_id;

  INSERT INTO experience_page_options (
    experience_page_id, sort_order, label, price_from, price_type,
    catches_text, target_species, season_months, peak_months,
    includes, excludes, what_to_bring, content_blocks
  ) VALUES
  (
    v_exp_id, 0, 'Guided Day — Punta Arenas Area', 0, 'request',
    'A walk-and-wade day on the Río Penitente, Laguna Parrillar or the spring creeks around Punta Arenas.',
    ARRAY['Brown Trout', 'Sea-run Brown Trout'],
    ARRAY[10, 11, 12, 1, 2, 3, 4], ARRAY[11, 12, 1, 2],
    ARRAY['Private walk-and-wade guiding'],
    ARRAY['Licence, gear and transport — to be confirmed', 'Gratuities'],
    ARRAY['Waders and boots', 'Windproof shell', 'Polarised sunglasses'],
    '[]'::jsonb
  ),
  (
    v_exp_id, 1, 'Multi-Area Itinerary Across the Season', 0, 'request',
    'Several days built across Punta Arenas, Puerto Natales and Torres del Paine, and Tierra del Fuego, ordered so each area is fished in the month it fishes best.',
    ARRAY['Brown Trout', 'Sea-run Brown Trout', 'Brook Trout'],
    ARRAY[10, 11, 12, 1, 2, 3, 4], ARRAY[11, 12, 1, 2],
    ARRAY['Private walk-and-wade guiding across all areas'],
    ARRAY['Licence, gear, transport and accommodation — to be confirmed', 'Gratuities'],
    ARRAY['Waders and boots', 'Windproof shell', 'Warm layers'],
    '[]'::jsonb
  );

  RAISE NOTICE 'Created experience page + 2 options for sebastian-fernandez (exp=%)', v_exp_id;

END $$;

RESET ROLE;
