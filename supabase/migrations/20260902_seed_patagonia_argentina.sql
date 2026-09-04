-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: Patagonia — Argentina, wave 1 (5 partners)
--
--   1. Juan Leobono          — Bariloche Fishing Services   (Río Negro)      RATES OK
--   2. Martín "Tincho" Chambó — Cordillera Fly              (Neuquén)        price on request
--   3. Pablo Zaleski          — Fly Fishing in Patagonia    (Neuquén)        price on request
--   4. Nicolás Rivero         — Guides Patagonia            (Río Negro)      price on request
--   5. Patagonia River Guides                               (Chubut/Neuquén) RATES OK
--
-- Source: guides/*.md (correspondence Aug 30 – Sep 1 2026). Only what partners
-- actually wrote. Nothing invented about waters, prices or inclusions.
--
-- Creates per partner: guides row + experience_pages row + experience_page_options.
-- Idempotent: guarded on guides.slug and experience_pages.slug.
--
-- ALL PAGES ARE SEEDED AS status = 'draft' — no partner has sent photos yet and
-- hero_image_url / gallery_image_urls are empty. Activate one page at a time:
--   UPDATE experience_pages SET status = 'active' WHERE slug = '<slug>';
--
-- Currency is USD. NOTE: TripOptionsAccordion.tsx hardcodes the € symbol in
-- formatPrice(); the page only prints a "Prices in USD" note. Fix that before
-- activating, or the client sees "from €550" for a USD price.
-- ─────────────────────────────────────────────────────────────────────────────

SET ROLE postgres;

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. JUAN LEOBONO — Bariloche Fishing Services
-- ═════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_guide_id UUID;
  v_exp_id   UUID;
BEGIN

  SELECT id INTO v_guide_id FROM guides WHERE slug = 'juan-leobono';

  IF v_guide_id IS NULL THEN
    INSERT INTO guides (
      user_id, slug, is_beta_listing, is_hidden,
      full_name, country, city, tagline, bio,
      languages, fish_expertise, years_experience,
      website_url, instagram_url, invite_email,
      pricing_model, status, verified_at
    ) VALUES (
      NULL, 'juan-leobono', true, false,
      'Juan Leobono',
      'Argentina',
      'Dina Huapi, Bariloche',
      'Owner-guide on the Upper Limay and Manso — every trip guided personally',
      'Juan Leobono runs Bariloche Fishing Services as a one-man operation out of Dina Huapi, just outside Bariloche, and guides every trip himself. Full days and multi-day programs, drift boat or on foot, across the Upper Limay, the Manso, and the smaller lakes and rivers of Nahuel Huapi National Park. He adapts the fishing to the angler rather than the other way round — complete beginners and advanced anglers both get a day built around what they can actually do. He also manages a small boutique hotel on the lakeshore, which means he can put together a complete package — airport pickup in Bariloche, accommodation, fishing and all local logistics — for clients who want a single point of contact on the ground.',
      ARRAY['Spanish', 'English'],
      ARRAY['Brown Trout', 'Rainbow Trout'],
      NULL,
      'https://www.barilochefishingservices.com/',
      'https://www.instagram.com/barilochefishingservices',
      'jfleobono@gmail.com',
      'commission', 'active', NOW()
    )
    RETURNING id INTO v_guide_id;
    RAISE NOTICE 'Created guide juan-leobono (id=%)', v_guide_id;
  ELSE
    RAISE NOTICE 'Guide juan-leobono already exists (id=%) — skipping guide insert', v_guide_id;
  END IF;

  IF EXISTS (SELECT 1 FROM experience_pages WHERE slug = 'fly-fishing-bariloche-limay-manso') THEN
    RAISE NOTICE 'Experience page fly-fishing-bariloche-limay-manso exists — skipping';
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
    'Fly Fishing the Upper Limay & Manso — Bariloche, Argentina',
    'fly-fishing-bariloche-limay-manso',
    'Argentina', 'Río Negro / Nahuel Huapi', 'draft',
    550, 'flat', 'USD',
    'Beginner–Expert', 'Low–Medium', false,
    ARRAY['Fly fishing', 'Drift boat', 'Wade fishing'],
    ARRAY['Brown Trout', 'Rainbow Trout'],
    ARRAY['River', 'Lake', 'National Park'],
    -- intro_text
    'Two rivers, one guide, and a choice that shapes the whole trip. The Upper Limay runs big and green out of Nahuel Huapi, holding migratory brown and rainbow trout that come up from Alicurá in autumn. The Manso and the small waters of the Pacific watershed inside the national park are the opposite: intimate, clear, and at their best under a dry fly in early summer. Juan Leobono guides both himself, from a drift boat or on foot, and picks the water to fit the month and the angler.',
    -- story_text
    'Bariloche is the easiest place in Argentine Patagonia to get to and one of the hardest to fish well without help. The water is spread across two watersheds, the seasons run in opposite directions on each, and the difference between a good day and a blank one is usually knowing which section to be on that week.

Juan has run Bariloche Fishing Services single-handed out of Dina Huapi for years. He guides every trip personally — there is no roster of staff guides, no chance of being handed to someone you have not spoken to. That matters more than it sounds: the person answering the brief is the person in the boat.

The Upper Limay is his headline water. It is divided into roughly four sections of about 15 km each, which is what makes a two- or three-day float possible: different stretches on consecutive days, with the option of one or two nights camping on the riverbank. From mid-March through May the river turns over to large migratory browns and rainbows moving up from the Alicurá reservoir. It is a technical fishery and Juan is direct about who it suits — intermediate and advanced anglers who can put a fly where it needs to go.

Late November through roughly the third week of January is the other half of the season, and a completely different kind of fishing. The Manso and the smaller lakes and rivers of the Pacific watershed inside Nahuel Huapi National Park fish best on dry flies then, in water clear enough to watch the take. Alicurá Lake itself — a large reservoir on the Limay system — makes a good add-on day for anyone who wants a change of scale.

Juan also manages a small boutique hotel on the lakeshore, which is the quiet advantage here: airport transfer, a bed, the fishing and every piece of local logistics can come from one person instead of four.',
    -- catches_text
    'Brown and rainbow trout on both watersheds. The Upper Limay holds large migratory fish that run up from Alicurá from mid-March onwards — the biggest trout of the season come from there, and they are earned. The Manso and the small national-park waters fish smaller on average but far more visually, with dry-fly takes in clear water through the early summer.',
    -- rod_setup
    'A 5- or 6-weight single-hand rod with a floating line covers the Manso and the small waters; a 6- or 7-weight with sink tips is the better tool for streamers on the Limay when the migratory fish are in. Dries, nymphs and streamers according to season and conditions. Juan provides all fishing gear if you need it — bring your own if you prefer to fish what you know.',
    -- best_months
    'Late November–January (dry fly) · mid-March–May (migratory browns on the Limay)',
    'November', 'May',
    ARRAY[11, 12, 1, 2, 3, 4, 5],
    ARRAY[12, 1, 4],
    -- species_details
    '[
      {
        "name": "Brown Trout",
        "description": "The main quarry on both systems. On the Upper Limay, large migratory browns move up from the Alicurá reservoir from around mid-March through May — a technical fishery best suited to intermediate and advanced anglers. On the Manso and the small waters of the Pacific watershed inside Nahuel Huapi National Park, resident browns come well to a dry fly from late November through the third week of January.",
        "image_url": "",
        "image_urls": [],
        "season_months": [11, 12, 1, 2, 3, 4, 5],
        "peak_months": [12, 1, 4, 5]
      },
      {
        "name": "Rainbow Trout",
        "description": "Present throughout the system and, like the browns, running migratory fish up the Upper Limay in autumn. Rainbows are the more aggressive of the two here and often the first fish of the day on a streamer.",
        "image_url": "",
        "image_urls": [],
        "season_months": [11, 12, 1, 2, 3, 4, 5],
        "peak_months": [12, 1, 4]
      }
    ]'::jsonb,
    ARRAY[
      'Private guide service — Juan guides personally',
      'Transportation from Bariloche',
      'All fishing gear if needed',
      'Drift boat where applicable',
      'Lunch, snacks and drinks'
    ],
    ARRAY[
      'Fishing licence',
      'Guide gratuities',
      'Accommodation (available separately through Juan''s lakeshore hotel)'
    ],
    ARRAY[
      'Polarised sunglasses',
      'Layered clothing — Patagonian weather turns fast',
      'Waterproof jacket',
      'Hat with a brim',
      'Sunscreen',
      'Camera'
    ],
    'Bariloche',
    'Pickup from Bariloche included. Airport transfer and accommodation can be arranged through Juan''s boutique hotel on the lakeshore.',
    -41.07, -71.16,
    'Guided Fly Fishing in Bariloche — Upper Limay & Manso | FjordAnglers',
    'Fish the Upper Limay and Manso with Juan Leobono, owner-guide in Bariloche. Drift boat and wade, migratory browns in autumn, dry fly in early summer. From USD 550 per day for two anglers.'
  )
  RETURNING id INTO v_exp_id;

  INSERT INTO experience_page_options (
    experience_page_id, sort_order, label, price_from, price_type,
    catches_text, target_species, season_months, peak_months,
    includes, excludes, what_to_bring, content_blocks
  ) VALUES
  (
    v_exp_id, 0, 'Full Day — Upper Limay River', 550, 'flat',
    'A full day on the Upper Limay, drift boat or wade depending on the section and the water level. From mid-March through May this is where the large migratory browns and rainbows are. Rate is for two anglers.',
    ARRAY['Brown Trout', 'Rainbow Trout'],
    ARRAY[11, 12, 1, 2, 3, 4, 5], ARRAY[4, 5],
    ARRAY['Private guide service', 'Transportation from Bariloche', 'All fishing gear if needed', 'Drift boat where applicable', 'Lunch, snacks and drinks'],
    ARRAY['Fishing licence', 'Guide gratuities'],
    ARRAY['Polarised sunglasses', 'Layered waterproof clothing', 'Hat with a brim', 'Sunscreen'],
    '[
      {
        "headline": "A Day on the Upper Limay",
        "text": "The Limay below Nahuel Huapi is big water — wide, green and pushing. Juan fishes it from a drift boat where the sections allow and on foot where they do not.\n\nFrom mid-March the river changes character completely: large brown and rainbow trout move up from the Alicurá reservoir, and the fishing becomes a hunt for a small number of very good fish. Juan is straight about it — this stretch of the season rewards intermediate and advanced anglers.\n\nUSD 550 per day for two anglers. Fishing licence not included.",
        "image_url": ""
      }
    ]'::jsonb
  ),
  (
    v_exp_id, 1, 'Full Day — Manso River & Small Lakes', 650, 'flat',
    'The Manso and the smaller lakes and rivers of the Pacific watershed inside Nahuel Huapi National Park. Clearer, more intimate water and the best dry-fly fishing of the season from late November through January. Rate is for two anglers.',
    ARRAY['Brown Trout', 'Rainbow Trout'],
    ARRAY[11, 12, 1, 2, 3, 4], ARRAY[12, 1],
    ARRAY['Private guide service', 'Transportation from Bariloche', 'All fishing gear if needed', 'Lunch, snacks and drinks'],
    ARRAY['Fishing licence', 'Guide gratuities'],
    ARRAY['Polarised sunglasses', 'Layered waterproof clothing', 'Wading boots', 'Sunscreen'],
    '[
      {
        "headline": "Dry Fly in the National Park",
        "text": "Late November, December and roughly the first three weeks of January are the dry-fly weeks here — the Manso and the small waters of the Pacific watershed inside Nahuel Huapi National Park, fished on foot in water clear enough to watch the fish come up.\n\nIt suits every level, including anglers who have never held a fly rod. Juan builds the day around what you can do rather than what the river theoretically offers.\n\nUSD 650 per day for two anglers. Fishing licence not included.",
        "image_url": ""
      }
    ]'::jsonb
  ),
  (
    v_exp_id, 2, 'Multi-Day Float — Upper Limay, 2 or 3 Days', 0, 'request',
    'The Upper Limay is divided into roughly four sections of about 15 km each, so a two- or three-day float covers different stretches on consecutive days, with the option of one or two nights camping on the riverbank. Quoted individually — the price depends on the sections, the number of days and the logistics.',
    ARRAY['Brown Trout', 'Rainbow Trout'],
    ARRAY[11, 12, 1, 2, 3, 4, 5], ARRAY[4, 5],
    ARRAY['Private guide service', 'Drift boat', 'Riverside camping where chosen', 'All meals on the river'],
    ARRAY['Fishing licence', 'Guide gratuities'],
    ARRAY['Polarised sunglasses', 'Sleeping bag or equivalent (confirm on booking)', 'Layered waterproof clothing', 'Headlamp'],
    '[
      {
        "headline": "Two or Three Days on the River",
        "text": "Because the Upper Limay breaks into four sections of roughly 15 km, consecutive days do not mean fishing the same water twice. Juan builds two- and three-day floats that move down the river, with one or two nights of riverside camping if you want them.\n\nThese trips are quoted per group — send us your dates, party size and whether you want to camp, and we come back with a figure.",
        "image_url": ""
      }
    ]'::jsonb
  ),
  (
    v_exp_id, 3, 'Add-On Day — Alicurá Lake', 0, 'request',
    'Alicurá is a large reservoir on the Limay system and a completely different environment to the rivers — big water, big fish, a change of pace. Works best as an add-on day inside a longer trip.',
    ARRAY['Brown Trout', 'Rainbow Trout'],
    ARRAY[11, 12, 1, 2, 3, 4, 5], ARRAY[12, 1, 4],
    ARRAY['Private guide service', 'Transportation', 'All fishing gear if needed', 'Lunch, snacks and drinks'],
    ARRAY['Fishing licence', 'Guide gratuities'],
    ARRAY['Polarised sunglasses', 'Windproof outer layer', 'Sunscreen'],
    '[]'::jsonb
  );

  RAISE NOTICE 'Created experience page + 4 options for juan-leobono (exp=%)', v_exp_id;

END $$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 2. MARTÍN "TINCHO" CHAMBÓ — Cordillera Fly
--    NO PRICES ON FILE. His "Premium Fishing Trips 2026-27" PDF (22 pages) never
--    uploaded. Options seeded as price_type = 'request' until it is extracted.
-- ═════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_guide_id UUID;
  v_exp_id   UUID;
BEGIN

  SELECT id INTO v_guide_id FROM guides WHERE slug = 'martin-chambo';

  IF v_guide_id IS NULL THEN
    INSERT INTO guides (
      user_id, slug, is_beta_listing, is_hidden,
      full_name, country, city, tagline, bio,
      languages, fish_expertise, years_experience,
      website_url, instagram_url, invite_email,
      pricing_model, status, verified_at
    ) VALUES (
      NULL, 'martin-chambo', true, false,
      'Martín "Tincho" Chambó',
      'Argentina',
      'Villa La Angostura',
      'Alicurá reservoir and the Limay system — boat and wade, fly and spin',
      'Martín, known to everyone as Tincho, runs Cordillera Fly from Villa La Angostura as a family operation. He fishes the Alicurá reservoir and the Limay system, from the boat and on foot, and takes both fly and spin anglers — which makes him one of the few good options for a mixed group where not everyone casts a fly rod. His programs are built as half-day or full-day blocks that combine into longer custom trips, and he is explicit that he will reshape them around a client''s schedule and preferences.',
      ARRAY['Spanish', 'English'],
      ARRAY['Brown Trout', 'Rainbow Trout'],
      NULL,
      'https://cordillerafly.com/',
      'https://www.instagram.com/cordillera_fly',
      'cordillerafly@gmail.com',
      'commission', 'active', NOW()
    )
    RETURNING id INTO v_guide_id;
    RAISE NOTICE 'Created guide martin-chambo (id=%)', v_guide_id;
  END IF;

  IF EXISTS (SELECT 1 FROM experience_pages WHERE slug = 'fly-fishing-alicura-villa-la-angostura') THEN
    RAISE NOTICE 'Experience page fly-fishing-alicura-villa-la-angostura exists — skipping';
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
    'Alicurá & the Limay System — Villa La Angostura, Argentina',
    'fly-fishing-alicura-villa-la-angostura',
    'Argentina', 'Neuquén / Villa La Angostura', 'draft',
    0, 'request', 'USD',
    'Beginner–Advanced', 'Low', true,
    ARRAY['Fly fishing', 'Spin fishing', 'Boat fishing', 'Wade fishing'],
    ARRAY['Brown Trout', 'Rainbow Trout'],
    ARRAY['Reservoir', 'River'],
    -- intro_text
    'Alicurá is a big reservoir on the Limay system, and it is Tincho Chambó''s home water. He fishes it from the boat and from the bank, with a fly rod or a spinning rod, in half-day and full-day blocks that stack into longer trips. For a group where one angler casts a fly line and another does not, this is one of the few places in Patagonia where nobody has to sit out.',
    -- story_text
    'Villa La Angostura sits between Bariloche and San Martín de los Andes, close enough to both to be overlooked by anglers heading for the famous rivers. Tincho Chambó has built Cordillera Fly around what is on his own doorstep: the Alicurá reservoir and the Limay system that feeds it.

Alicurá is a different animal to the freestone rivers most visitors come to Patagonia for. It is a large impoundment, fished from a boat as often as from the bank, and it holds brown and rainbow trout that grow well in a lot of water. Reading it is a matter of local knowledge — where the fish sit at which time of year, which arms fish in which wind. That is exactly the sort of thing a family operation that has fished one water for years knows and a visiting angler does not.

Cordillera Fly is deliberately day-based. Tincho does not run camps or overnight trips: every program is a half day or a full day, and longer trips are built by combining them. Accommodation is yours or arranged separately, which suits anyone already based in Villa La Angostura or Bariloche.

The other thing that sets him apart is that he takes spin anglers as readily as fly anglers. It sounds small. In practice it is the difference between a family or a mixed group of friends booking a day together or splitting up.',
    -- catches_text
    'Brown and rainbow trout on the Alicurá reservoir and the connected Limay water, fished on the fly or on light spinning tackle depending on what you prefer and what the conditions favour.',
    -- rod_setup
    'Fly: a 6-weight single-hand rod with floating and intermediate lines covers most of the reservoir fishing; streamers and nymphs do the bulk of the work, dries when there is something happening on top. Spin: a light spinning outfit with small lures. All fishing gear and fishing licences are included in Tincho''s programs.',
    'November–April',
    'November', 'April',
    ARRAY[11, 12, 1, 2, 3, 4],
    ARRAY[12, 1, 2],
    '[
      {
        "name": "Brown Trout",
        "description": "Resident browns in the Alicurá reservoir and the connected Limay water. Fished from the boat and from the bank, on the fly or on light spinning tackle.",
        "image_url": "",
        "image_urls": [],
        "season_months": [11, 12, 1, 2, 3, 4],
        "peak_months": [12, 1, 2]
      },
      {
        "name": "Rainbow Trout",
        "description": "Present through the same water and often the more willing fish of the two, which makes Alicurá a forgiving place to put a beginner or a spin angler.",
        "image_url": "",
        "image_urls": [],
        "season_months": [11, 12, 1, 2, 3, 4],
        "peak_months": [12, 1, 2]
      }
    ]'::jsonb,
    ARRAY[
      'All fishing gear',
      'Fishing licences',
      'Guiding and the services specified in each program',
      'Boat where the program includes it'
    ],
    ARRAY[
      'Accommodation — programs are day-based only, with no camping or overnight stays',
      'Guide gratuities'
    ],
    ARRAY[
      'Polarised sunglasses',
      'Windproof jacket — the reservoir is exposed',
      'Layered clothing',
      'Sunscreen',
      'Hat with a brim'
    ],
    'Villa La Angostura',
    'Meeting point in Villa La Angostura. Pickup radius still to be confirmed with the guide.',
    -40.76, -71.65,
    'Fly & Spin Fishing on Alicurá — Villa La Angostura | FjordAnglers',
    'Half and full days on the Alicurá reservoir and the Limay system with Tincho Chambó. Boat and wade, fly and spin, gear and licence included. Villa La Angostura, Argentina.'
  )
  RETURNING id INTO v_exp_id;

  INSERT INTO experience_page_options (
    experience_page_id, sort_order, label, price_from, price_type,
    catches_text, target_species, season_months, peak_months,
    includes, excludes, what_to_bring, content_blocks
  ) VALUES
  (
    v_exp_id, 0, 'Half Day — Alicurá & Limay', 0, 'request',
    'A half-day block on the reservoir or the river, fly or spin, boat or bank. The building block for everything Tincho runs, and a good way to add fishing to a day that already has something else in it.',
    ARRAY['Brown Trout', 'Rainbow Trout'],
    ARRAY[11, 12, 1, 2, 3, 4], ARRAY[12, 1, 2],
    ARRAY['All fishing gear', 'Fishing licence', 'Guiding'],
    ARRAY['Accommodation', 'Guide gratuities'],
    ARRAY['Polarised sunglasses', 'Windproof jacket', 'Sunscreen'],
    '[]'::jsonb
  ),
  (
    v_exp_id, 1, 'Full Day — Alicurá & Limay', 0, 'request',
    'A full day on the water, boat and bank, fly or spin. Rates exist for both one and two anglers.',
    ARRAY['Brown Trout', 'Rainbow Trout'],
    ARRAY[11, 12, 1, 2, 3, 4], ARRAY[12, 1, 2],
    ARRAY['All fishing gear', 'Fishing licence', 'Guiding', 'Boat where applicable'],
    ARRAY['Accommodation', 'Guide gratuities'],
    ARRAY['Polarised sunglasses', 'Windproof jacket', 'Layered clothing', 'Sunscreen'],
    '[]'::jsonb
  ),
  (
    v_exp_id, 2, 'Custom 2–3 Day Trip', 0, 'request',
    'Half- and full-day blocks combined into a two- or three-day trip, shaped around your schedule. No camping or overnight stays — accommodation in Villa La Angostura is yours or arranged separately.',
    ARRAY['Brown Trout', 'Rainbow Trout'],
    ARRAY[11, 12, 1, 2, 3, 4], ARRAY[12, 1, 2],
    ARRAY['All fishing gear', 'Fishing licences', 'Guiding across all fishing days'],
    ARRAY['Accommodation', 'Guide gratuities'],
    ARRAY['Polarised sunglasses', 'Windproof jacket', 'Layered clothing', 'Sunscreen'],
    '[
      {
        "headline": "Built Around Your Schedule",
        "text": "Tincho does not run a fixed multi-day product. He combines half days and full days into whatever length works, and adapts to when you are actually free.\n\nWhat he does not do is camp — every program is a day-based fishing experience, so you keep your own base in Villa La Angostura or Bariloche.",
        "image_url": ""
      }
    ]'::jsonb
  );

  RAISE NOTICE 'Created experience page + 3 options for martin-chambo (exp=%)', v_exp_id;

END $$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 3. PABLO ZALESKI — Fly Fishing in Patagonia
--    Programs only. He does NOT sell guiding-only days and has no daily rate.
--    Page is priced on request by design, not for lack of data.
-- ═════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_guide_id UUID;
  v_exp_id   UUID;
BEGIN

  SELECT id INTO v_guide_id FROM guides WHERE slug = 'pablo-zaleski';

  IF v_guide_id IS NULL THEN
    INSERT INTO guides (
      user_id, slug, is_beta_listing, is_hidden,
      full_name, country, city, tagline, bio,
      languages, fish_expertise, years_experience,
      website_url, invite_email,
      pricing_model, status, verified_at
    ) VALUES (
      NULL, 'pablo-zaleski', true, false,
      'Pablo Zaleski',
      'Argentina',
      'San Martín de los Andes',
      'Tailor-made programs on the classic San Martín rivers',
      'Pablo Zaleski works the classic San Martín de los Andes river system — the Malleo, Chimehuín, Collón Curá, Quilquihue and Traful. He does not sell guiding as a standalone service and does not work to a standard daily rate: his business is complete fishing programs that combine lodging, water access, guiding and transport, built around each group. Which lodge or private ranch a trip runs from depends on the group, the rivers they want and the kind of experience they are after. Contact is direct with the owner from the first brief to the last day.',
      ARRAY['Spanish', 'English'],
      ARRAY['Brown Trout', 'Rainbow Trout'],
      NULL,
      'https://www.flyfishinginpatagonia.com/',
      NULL,
      'commission', 'active', NOW()
    )
    RETURNING id INTO v_guide_id;
    RAISE NOTICE 'Created guide pablo-zaleski (id=%)', v_guide_id;
  END IF;

  IF EXISTS (SELECT 1 FROM experience_pages WHERE slug = 'fishing-programs-san-martin-de-los-andes') THEN
    RAISE NOTICE 'Experience page fishing-programs-san-martin-de-los-andes exists — skipping';
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
    'Tailor-Made Fishing Programs — San Martín de los Andes, Argentina',
    'fishing-programs-san-martin-de-los-andes',
    'Argentina', 'Neuquén / San Martín de los Andes', 'draft',
    0, 'request', 'USD',
    'Beginner–Expert', 'Low–Medium', true,
    ARRAY['Fly fishing', 'Wade fishing', 'Float fishing'],
    ARRAY['Brown Trout', 'Rainbow Trout'],
    ARRAY['River', 'Spring Creek', 'Estancia'],
    -- intro_text
    'The Malleo, the Chimehuín, the Collón Curá, the Quilquihue, the Traful — the rivers that made Argentine fly fishing''s reputation, all within reach of one town. Pablo Zaleski does not sell days on them. He builds complete programs: where you sleep, which water you get, who guides you and how you move between them, assembled around your group rather than pulled off a shelf.',
    -- story_text
    'San Martín de los Andes is the heart of Argentine trout fishing, and its rivers are famous enough that most anglers arrive with names already in their heads. The Chimehuín, where the modern Patagonian dry-fly tradition started. The Malleo, small, clear and demanding. The Collón Curá, big and floatable. The Quilquihue and the Traful for anyone who wants something quieter.

Pablo works all of them, and he is unusually clear about what his business is and is not. He does not offer guiding-only services and does not work to a standard daily rate. What he sells is a complete fishing program — lodging, fishing access, guiding, transportation and whatever else the itinerary needs — designed for the specific group booking it.

That means the lodges and the large private ranches he works with change from trip to trip, chosen for the group, the rivers they want and the kind of experience they are after. It also means the brief matters more than usual. Pablo needs the number of anglers, rooming requirements, preferred trip length and an approximate or flexible date range before he can put a shape on anything.

The upside of that structure is access. Private estancia water in this part of Neuquén is not something you find by turning up in town, and a program that includes it is a different trip to a rod on a public beat. The other upside is simple: you deal with the owner throughout, not a booking desk.',
    -- catches_text
    'Wild brown and rainbow trout across the classic Neuquén rivers, fished wade and float. The Malleo and the smaller water reward precision and a careful approach; the Collón Curá and the lower Chimehuín give bigger water and the chance at a heavier fish from a boat.',
    -- rod_setup
    'A 5-weight for the small water and a 6-weight for the bigger rivers and float days will cover most itineraries, floating lines throughout with sink tips for streamer work. Whether rods, reels and licences sit inside the program price is confirmed per itinerary — ask us and we will get it in writing before you book.',
    'November–April',
    'November', 'April',
    ARRAY[11, 12, 1, 2, 3, 4],
    ARRAY[12, 1, 2, 3],
    '[
      {
        "name": "Brown Trout",
        "description": "The classic fish of the Neuquén rivers — wild browns in the Malleo, Chimehuín, Collón Curá, Quilquihue and Traful, fished wade and from the boat. Precise presentation matters on the smaller water; the bigger rivers open up streamer fishing for heavier fish.",
        "image_url": "",
        "image_urls": [],
        "season_months": [11, 12, 1, 2, 3, 4],
        "peak_months": [12, 1, 2, 3]
      },
      {
        "name": "Rainbow Trout",
        "description": "Distributed through the same river system alongside the browns, and generally the more aggressive of the two — a good fish to find early in a day while you tune into the water.",
        "image_url": "",
        "image_urls": [],
        "season_months": [11, 12, 1, 2, 3, 4],
        "peak_months": [12, 1, 2, 3]
      }
    ]'::jsonb,
    ARRAY[
      'Lodging for the length of the program',
      'Fishing access, including private lodge and estancia water where the itinerary uses it',
      'Guiding on every fishing day',
      'Transportation throughout the program',
      'Other services required by the itinerary'
    ],
    ARRAY[
      'International and domestic airfare',
      'Guide gratuities',
      'Fishing licence and personal gear — confirmed per program'
    ],
    ARRAY[
      'Polarised sunglasses',
      'Waders and wading boots',
      'Layered clothing and a waterproof shell',
      'Hat with a brim',
      'Sunscreen'
    ],
    'San Martín de los Andes',
    'Programs are based out of San Martín de los Andes and the lodges and private ranches Pablo works with in the surrounding valleys. The base is chosen per group.',
    -40.16, -71.35,
    'Tailor-Made Fly Fishing Programs — San Martín de los Andes | FjordAnglers',
    'Complete fishing programs on the Malleo, Chimehuín, Collón Curá, Quilquihue and Traful with Pablo Zaleski. Lodging, private water access, guiding and transport built around your group.'
  )
  RETURNING id INTO v_exp_id;

  INSERT INTO experience_page_options (
    experience_page_id, sort_order, label, price_from, price_type,
    catches_text, target_species, season_months, peak_months,
    includes, excludes, what_to_bring, content_blocks
  ) VALUES
  (
    v_exp_id, 0, 'Short Program — 3 to 4 Days', 0, 'request',
    'A short tailor-made program on the San Martín rivers: lodging, water access, guiding and transport for three or four days, built around your group and your dates.',
    ARRAY['Brown Trout', 'Rainbow Trout'],
    ARRAY[11, 12, 1, 2, 3, 4], ARRAY[12, 1, 2, 3],
    ARRAY['Lodging', 'Fishing access', 'Guiding', 'Transportation'],
    ARRAY['Airfare', 'Gratuities'],
    ARRAY['Polarised sunglasses', 'Waders and boots', 'Waterproof shell'],
    '[]'::jsonb
  ),
  (
    v_exp_id, 1, 'Week Program', 0, 'request',
    'A full week across the classic Neuquén rivers, moving between waters and — where the itinerary calls for it — between lodges and private ranches. Priced per person once the brief is in.',
    ARRAY['Brown Trout', 'Rainbow Trout'],
    ARRAY[11, 12, 1, 2, 3, 4], ARRAY[12, 1, 2, 3],
    ARRAY['Lodging', 'Fishing access including private water', 'Guiding on every fishing day', 'Transportation throughout'],
    ARRAY['Airfare', 'Gratuities'],
    ARRAY['Polarised sunglasses', 'Waders and boots', 'Layered clothing and a waterproof shell'],
    '[
      {
        "headline": "What Pablo Needs to Quote",
        "text": "Every trip here is built rather than booked, so the first step is a brief: the number of anglers, rooming requirements, preferred trip length, and an approximate or flexible date range.\n\nFrom that Pablo picks the lodges or estancias, the rivers and the shape of the week, and comes back with a per-person price. Send us those four things and we will run it for you.",
        "image_url": ""
      }
    ]'::jsonb
  );

  RAISE NOTICE 'Created experience page + 2 options for pablo-zaleski (exp=%)', v_exp_id;

END $$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 4. NICOLÁS RIVERO — Guides Patagonia
--    Thinnest file in the set: one line of correspondence, no rates, no detail.
--    Seeded so the profile exists; page copy is deliberately conservative.
-- ═════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_guide_id UUID;
  v_exp_id   UUID;
BEGIN

  SELECT id INTO v_guide_id FROM guides WHERE slug = 'nicolas-rivero';

  IF v_guide_id IS NULL THEN
    INSERT INTO guides (
      user_id, slug, is_beta_listing, is_hidden,
      full_name, country, city, tagline, bio,
      languages, fish_expertise, years_experience,
      website_url, instagram_url, invite_email,
      pricing_model, status, verified_at
    ) VALUES (
      NULL, 'nicolas-rivero', true, true,
      'Nicolás Rivero',
      'Argentina',
      'Bariloche',
      'Drift boats and overnight river camps on the Limay and Manso',
      'Nicolás Rivero runs Guides Patagonia out of Bariloche and guides himself. The operation is built around drift boats on the Limay and the Manso, overnight river camps for longer trips, and two partner lodges for clients who would rather have a roof than a tent. Migratory brown trout on the Limay are the headline.',
      ARRAY['Spanish', 'English'],
      ARRAY['Brown Trout', 'Rainbow Trout'],
      NULL,
      'https://guidespatagonia.com/',
      'https://www.instagram.com/guides.patagonia',
      'info@guidespatagonia.com',
      'commission', 'active', NOW()
    )
    RETURNING id INTO v_guide_id;
    RAISE NOTICE 'Created guide nicolas-rivero (id=%) — is_hidden = true until the call happens', v_guide_id;
  END IF;

  IF EXISTS (SELECT 1 FROM experience_pages WHERE slug = 'drift-boat-fishing-limay-manso-bariloche') THEN
    RAISE NOTICE 'Experience page drift-boat-fishing-limay-manso-bariloche exists — skipping';
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
    'Drift Boats & River Camps on the Limay — Bariloche, Argentina',
    'drift-boat-fishing-limay-manso-bariloche',
    'Argentina', 'Río Negro / Bariloche', 'draft',
    0, 'request', 'USD',
    'Intermediate–Advanced', 'Medium', false,
    ARRAY['Fly fishing', 'Drift boat', 'Wade fishing'],
    ARRAY['Brown Trout', 'Rainbow Trout'],
    ARRAY['River', 'Wilderness Camp'],
    'Guides Patagonia fishes the Limay and the Manso from drift boats, and turns the longer trips into float expeditions with camps on the riverbank. Migratory brown trout are the reason to come. For anglers who would rather sleep under a roof, Nicolás works with two partner lodges.',
    'Bariloche has plenty of guides who will take you out for a day. Fewer will put you in a boat for three and camp you on a gravel bar in between.

Nicolás Rivero built Guides Patagonia around the float. The Limay and the Manso are both rivers that reward covering water — a boat gets you to bank the wading angler never reaches, and a multi-day float gets you to the stretches nobody fished yesterday. Migratory browns moving up the Limay are the fish the trips are designed around.

For clients who want the fishing without the tent, two partner lodges give a lodge-based version of the same water.

We are still filling in the detail on this one: rates, which lodges, and how much of the guiding Nicolás does personally versus his team. Send us a brief and we will get you exact answers before anything is confirmed.',
    'Brown and rainbow trout on the Limay and the Manso, with migratory browns the headline fish on the Limay.',
    'A 6-weight for general river work and a 7-weight with sink tips for streamer fishing to migratory browns. Gear policy still to be confirmed with the guide — assume you are bringing your own until we say otherwise.',
    'November–April',
    'November', 'April',
    ARRAY[11, 12, 1, 2, 3, 4],
    ARRAY[12, 1, 2, 3],
    '[
      {
        "name": "Brown Trout",
        "description": "Migratory browns on the Limay are what the drift-boat and float-camp trips are built around. Resident fish through the Manso as well.",
        "image_url": "",
        "image_urls": [],
        "season_months": [11, 12, 1, 2, 3, 4],
        "peak_months": [12, 1, 2, 3]
      },
      {
        "name": "Rainbow Trout",
        "description": "Present through both rivers alongside the browns.",
        "image_url": "",
        "image_urls": [],
        "season_months": [11, 12, 1, 2, 3, 4],
        "peak_months": [12, 1, 2, 3]
      }
    ]'::jsonb,
    ARRAY['Guiding', 'Drift boat'],
    ARRAY['Fishing licence', 'Gratuities'],
    ARRAY[
      'Polarised sunglasses',
      'Layered clothing and a waterproof shell',
      'Hat with a brim',
      'Sunscreen'
    ],
    'Bariloche',
    'Trips start from Bariloche. Exact meeting arrangements confirmed on booking.',
    -41.13, -71.31,
    'Drift Boat Fly Fishing on the Limay — Bariloche | FjordAnglers',
    'Guided drift-boat days and multi-day float camps on the Limay and Manso with Nicolás Rivero of Guides Patagonia, Bariloche. Migratory brown trout, lodge or camp.'
  )
  RETURNING id INTO v_exp_id;

  INSERT INTO experience_page_options (
    experience_page_id, sort_order, label, price_from, price_type,
    catches_text, target_species, season_months, peak_months,
    includes, excludes, what_to_bring, content_blocks
  ) VALUES
  (
    v_exp_id, 0, 'Guided Day — Drift Boat', 0, 'request',
    'A day on the Limay or the Manso from a drift boat, fishing water that cannot be reached on foot.',
    ARRAY['Brown Trout', 'Rainbow Trout'],
    ARRAY[11, 12, 1, 2, 3, 4], ARRAY[12, 1, 2, 3],
    ARRAY['Guiding', 'Drift boat'],
    ARRAY['Fishing licence', 'Gratuities'],
    ARRAY['Polarised sunglasses', 'Waterproof shell', 'Sunscreen'],
    '[]'::jsonb
  ),
  (
    v_exp_id, 1, 'Multi-Day Float with River Camps', 0, 'request',
    'A float expedition down the river with overnight camps on the bank — several days of water, none of it fished the day before.',
    ARRAY['Brown Trout', 'Rainbow Trout'],
    ARRAY[11, 12, 1, 2, 3, 4], ARRAY[12, 1, 2, 3],
    ARRAY['Guiding', 'Drift boat', 'Riverside camp'],
    ARRAY['Fishing licence', 'Gratuities'],
    ARRAY['Polarised sunglasses', 'Waterproof shell', 'Headlamp', 'Warm sleeping layers'],
    '[]'::jsonb
  ),
  (
    v_exp_id, 2, 'Lodge-Based Trip', 0, 'request',
    'The same rivers, based at one of Nicolás''s two partner lodges rather than a camp. Which lodges, and in what bracket, is still to be confirmed.',
    ARRAY['Brown Trout', 'Rainbow Trout'],
    ARRAY[11, 12, 1, 2, 3, 4], ARRAY[12, 1, 2, 3],
    ARRAY['Guiding', 'Lodge accommodation'],
    ARRAY['Fishing licence', 'Gratuities'],
    ARRAY['Polarised sunglasses', 'Waterproof shell', 'Sunscreen'],
    '[]'::jsonb
  );

  RAISE NOTICE 'Created experience page + 3 options for nicolas-rivero (exp=%)', v_exp_id;

END $$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 5. PATAGONIA RIVER GUIDES
--    Three properties under one contact (Manu Goya). Seeded as ONE page with
--    four options rather than three pages — a single partner, one commercial
--    relationship, one commission question outstanding.
-- ═════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_guide_id UUID;
  v_exp_id   UUID;
BEGIN

  SELECT id INTO v_guide_id FROM guides WHERE slug = 'patagonia-river-guides';

  IF v_guide_id IS NULL THEN
    INSERT INTO guides (
      user_id, slug, is_beta_listing, is_hidden,
      full_name, country, city, tagline, bio,
      languages, fish_expertise, years_experience,
      website_url, instagram_url, invite_email,
      pricing_model, status, verified_at
    ) VALUES (
      NULL, 'patagonia-river-guides', true, false,
      'Patagonia River Guides',
      'Argentina',
      'Trevelin',
      'A different river every day, from three lodges across Chubut and Neuquén',
      'Patagonia River Guides is the largest and best-known trout operation in Argentine Patagonia, running lodges in Chubut and Neuquén on a "fish a different river daily" philosophy. Three properties matter for our clients: the flagship five-star lodge at Trevelin, with twelve suites, an assistant guide for every angler and more than sixty miles of private spring creeks; Tres Valles Lodge on a large estancia near Río Pico, eight guests, with access to some of the largest brook trout in the world; and PRG North around San Martín de los Andes, where clients mix and match estancias — Tipiliuke, River House, Rinconada, Arroyo Verde, Tres Ríos — across the Chimehuín, Malleo, Collón Curá, Aluminé, Traful and Limay. Day trips are available for anglers not staying at a PRG lodge.',
      ARRAY['English', 'Spanish'],
      ARRAY['Brown Trout', 'Rainbow Trout', 'Brook Trout'],
      NULL,
      'https://www.patagoniariverguides.com/',
      'https://www.instagram.com/patagoniariverguides',
      'info@patagoniariverguides.com',
      'commission', 'active', NOW()
    )
    RETURNING id INTO v_guide_id;
    RAISE NOTICE 'Created guide patagonia-river-guides (id=%)', v_guide_id;
  END IF;

  IF EXISTS (SELECT 1 FROM experience_pages WHERE slug = 'patagonia-river-guides-argentina') THEN
    RAISE NOTICE 'Experience page patagonia-river-guides-argentina exists — skipping';
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
    'Patagonia River Guides — Lodges & Day Trips, Chubut and Neuquén',
    'patagonia-river-guides-argentina',
    'Argentina', 'Chubut & Neuquén', 'draft',
    900, 'flat', 'USD',
    'Beginner–Expert', 'Low–High', true,
    ARRAY['Fly fishing', 'Float fishing', 'Wade fishing', 'Spring creek fishing'],
    ARRAY['Brown Trout', 'Rainbow Trout', 'Brook Trout'],
    ARRAY['River', 'Spring Creek', 'Lake', 'Estancia', 'Lodge'],
    -- intro_text
    'Patagonia River Guides is the operation everyone else in Argentine trout fishing is measured against — three lodges, sixty-plus miles of private spring creeks, an assistant guide for every angler on wade days, and a philosophy of fishing a different river every day of the week. It also does something the other premium lodges mostly do not: sell single day trips to anglers who are not staying with them.',
    -- story_text
    'PRG runs on one idea, repeated across every property: you should not fish the same river twice in a week unless you want to.

The flagship at Trevelin, in Chubut, is a five-star property with twelve suites and no single supplement. Float days go to the Arrayanes, the Corcovado and the lakes; wade days to the Tecka, the Corcovado and the Percy, plus the Rivadavia and the Frey. Behind all of that sit more than sixty miles of private spring creeks. Every angler gets a guide *and* an assistant guide, which on a wade day means one-to-one attention on the water.

Tres Valles Lodge, two hours south of Esquel on a large estancia near Río Pico, takes eight guests. The Río Tigre, the Arroyo Campamento, spring creeks and stillwaters — and, season depending, access to some of the largest brook trout in the world. That last part is not marketing: Río Pico brookies are a genuine reason to plan a trip.

PRG North, around San Martín de los Andes and Junín in Neuquén, works differently again. It is an estancia program: clients mix and match between Tipiliuke — with nine miles of private Chimehuín — River House, Rinconada, Arroyo Verde and Tres Ríos, fishing the Chimehuín, Malleo, Collón Curá, Aluminé, Traful and Limay. Because the properties can be combined, short stays work here in a way they do not at a classic Saturday-to-Saturday lodge: three nights and two fishing days is a real product.

The week programs are all-inclusive in the honest sense — lodging, all meals, drinks, guiding with assistant guides, licences, transfers and private water. Clients cover airfare and gratuities, and that is genuinely it.

As of the end of August 2026 there was still space at most lodges for November, December and April, and day trips are easiest to arrange in November and December.',
    -- catches_text
    'Wild brown and rainbow trout across both provinces, on freestone rivers, spring creeks and lakes. Tres Valles adds brook trout — including, in the right season, some of the largest in the world. Sixty-plus miles of private spring creek at Trevelin means sight fishing to individual fish in water almost nobody else gets on.',
    -- rod_setup
    'A 5-weight and a 6-weight cover almost everything: the 5 for spring creeks and dry-fly work, the 6 for float days and wind. A 7-weight with sink tips is worth packing if streamers for big browns are your priority. Rods, reels and terminal tackle can be arranged through the lodge — confirm with us at booking.',
    -- best_months
    'November–December and April have the best availability; December–March fish hardest',
    'November', 'June',
    ARRAY[11, 12, 1, 2, 3, 4, 5],
    ARRAY[12, 1, 2, 3],
    '[
      {
        "name": "Brown Trout",
        "description": "The backbone of the fishing across all three properties — freestone rivers, spring creeks and lakes in Chubut, and the classic Neuquén rivers at PRG North including nine miles of private Chimehuín at Tipiliuke.",
        "image_url": "",
        "image_urls": [],
        "season_months": [11, 12, 1, 2, 3, 4, 5],
        "peak_months": [12, 1, 2, 3]
      },
      {
        "name": "Rainbow Trout",
        "description": "Throughout the Chubut and Neuquén systems, on float and wade days alike. Strong fish in cold, fast water.",
        "image_url": "",
        "image_urls": [],
        "season_months": [11, 12, 1, 2, 3, 4, 5],
        "peak_months": [12, 1, 2, 3]
      },
      {
        "name": "Brook Trout",
        "description": "The Tres Valles speciality. The estancia water around Río Pico gives access to some of the largest brook trout in the world, season depending — a fish that draws anglers to this corner of Chubut on its own.",
        "image_url": "",
        "image_urls": [],
        "season_months": [11, 12, 1, 2, 3, 4],
        "peak_months": [2, 3, 4]
      }
    ]'::jsonb,
    ARRAY[
      'Week programs: lodging, all meals, beverages, guiding with assistant guides, fishing licences, transfers and private water access',
      'Day trips: guiding, local transport to and from your hotel, lunch'
    ],
    ARRAY[
      'Airfare',
      'Gratuities (15% suggested)',
      'Laundry at USD 20 per load'
    ],
    ARRAY[
      'Polarised sunglasses',
      'Waders and wading boots',
      'Layered clothing and a waterproof shell',
      'Hat with a brim',
      'Sunscreen'
    ],
    'Esquel Airport (Trevelin & Tres Valles) · San Martín de los Andes (PRG North)',
    'Trevelin guests are met at Esquel Airport and transferred to the lodge. Tres Valles guests are met at Esquel Airport — or at Trevelin for extended stays — and driven two hours south. PRG North operates around San Martín de los Andes.',
    -43.09, -71.46,
    'Patagonia River Guides — Lodges and Day Trips in Argentina | FjordAnglers',
    'Argentina''s premier trout outfitter: three lodges in Chubut and Neuquén, 60+ miles of private spring creeks, brook trout at Río Pico. Day trips from USD 900 per boat; all-inclusive weeks from USD 7,000 per person.'
  )
  RETURNING id INTO v_exp_id;

  INSERT INTO experience_page_options (
    experience_page_id, sort_order, label, price_from, price_type,
    catches_text, target_species, season_months, peak_months,
    includes, excludes, what_to_bring, content_blocks
  ) VALUES
  (
    v_exp_id, 0, 'Day Trip — One or Two Anglers', 900, 'flat',
    'A guided day for anglers who are not staying at a PRG lodge. USD 900 per boat, whether that is one angler or two. Easiest to arrange in November and December.',
    ARRAY['Brown Trout', 'Rainbow Trout'],
    ARRAY[11, 12, 1, 2, 3, 4, 5], ARRAY[11, 12],
    ARRAY['Guiding', 'Local transportation to and from your hotel', 'Lunch'],
    ARRAY['Fishing licence', 'Gratuities'],
    ARRAY['Polarised sunglasses', 'Waders and boots', 'Waterproof shell', 'Sunscreen'],
    '[
      {
        "headline": "PRG Without the Lodge",
        "text": "Most premium Patagonian lodges will not sell you a single day. PRG will: USD 900 per boat for one or two anglers, including guiding, lunch, and local transport to and from your own hotel.\n\nIt is the cheapest way to fish with the best-known outfitter in Argentina, and the obvious add-on for anyone already spending a few days in the area.",
        "image_url": ""
      }
    ]'::jsonb
  ),
  (
    v_exp_id, 1, 'PRG North — Short Trip, 3 Nights / 2 Fishing Days', 1000, 'per_person',
    'The estancia program in Neuquén, at short-trip length. Clients mix and match between Tipiliuke, River House, Rinconada, Arroyo Verde and Tres Ríos, fishing the Chimehuín, Malleo, Collón Curá, Aluminé, Traful and Limay. From USD 1,000 to 1,300 per person per night on double occupancy, depending on the lodge — a three-night trip lands around USD 3,000–3,900 per person.',
    ARRAY['Brown Trout', 'Rainbow Trout'],
    ARRAY[11, 12, 1, 2, 3, 4], ARRAY[12, 1, 2, 3],
    ARRAY['Lodging', 'All meals', 'Guiding', 'Private water access', 'Transfers'],
    ARRAY['Airfare', 'Gratuities'],
    ARRAY['Polarised sunglasses', 'Waders and boots', 'Waterproof shell'],
    '[
      {
        "headline": "A Short Estancia Trip",
        "text": "PRG North is the one part of the operation where a short trip genuinely works. Because clients move between estancias rather than sitting in one lodge for a week, three nights and two fishing days is a real product, not a compromise.\n\nTipiliuke alone holds nine miles of private Chimehuín. Which estancia sits at the bottom of the price band and which at the top is a question we are putting to them — ask us before you choose.",
        "image_url": ""
      }
    ]'::jsonb
  ),
  (
    v_exp_id, 2, 'Trevelin or Tres Valles — All-Inclusive Week', 7000, 'per_person',
    'The standard product: a Saturday-to-Saturday week at the Trevelin flagship or at Tres Valles. USD 7,000 to 9,900 per person on double occupancy, depending on the lodge. Truly all-inclusive — the client covers airfare and gratuities and nothing else.',
    ARRAY['Brown Trout', 'Rainbow Trout', 'Brook Trout'],
    ARRAY[11, 12, 1, 2, 3, 4, 5], ARRAY[12, 1, 2, 3],
    ARRAY[
      'Lodging — twelve suites at Trevelin, single rooms complimentary',
      'All meals and beverages',
      'Guiding with an assistant guide for every angler',
      'Fishing licences',
      'Airport transfers',
      'Private water, including 60+ miles of spring creek at Trevelin'
    ],
    ARRAY['Airfare', 'Gratuities — 15% suggested', 'Laundry at USD 20 per load'],
    ARRAY['Polarised sunglasses', 'Waders and boots', 'Layered clothing and a waterproof shell', 'Hat with a brim'],
    '[
      {
        "headline": "A Different River Every Day",
        "text": "At Trevelin the week is built so you never repeat water unless you ask to. Float the Arrayanes, the Corcovado and the lakes; wade the Tecka, the Percy, the Rivadavia and the Frey; and step onto more than sixty miles of private spring creek that no one else can fish.\n\nEvery angler gets a guide and an assistant guide, which on wade days means one-to-one.\n\nTres Valles is the quieter alternative: eight guests on a large estancia two hours south of Esquel, with Río Tigre, Arroyo Campamento, spring creeks and stillwaters — and, season depending, some of the largest brook trout in the world.",
        "image_url": ""
      }
    ]'::jsonb
  );

  RAISE NOTICE 'Created experience page + 3 options for patagonia-river-guides (exp=%)', v_exp_id;

END $$;

RESET ROLE;
