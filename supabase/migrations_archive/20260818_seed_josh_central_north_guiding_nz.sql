-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: Josh Hart — Central North Guiding, Tūrangi / Taupō, NZ
--
-- Source: guide submission form, 16 Aug 2026 — joshhart911@gmail.com
--
-- Creates:
--   1. guides row         (beta listing, invite pending)
--   2. experience_pages   (Fly Fishing — Taupō & Tongariro, Central North Island)
--   3. experience_page_options × 2  (Half Day NZD 550 / Full Day NZD 1,000)
--
-- Run once in the Supabase dashboard SQL editor.
-- Idempotent: checks for existing slug before inserting experience page.
-- ─────────────────────────────────────────────────────────────────────────────

SET ROLE postgres;

DO $$
DECLARE
  v_guide_id UUID;
  v_exp_id   UUID;
BEGIN

  -- ── 1. Guide profile ───────────────────────────────────────────────────────

  INSERT INTO guides (
    user_id,
    is_beta_listing,
    full_name,
    country,
    city,
    bio,
    languages,
    fish_expertise,
    years_experience,
    avatar_url,
    instagram_url,
    youtube_url,
    pricing_model,
    status,
    verified_at,
    invite_email
  ) VALUES (
    NULL,
    true,
    'Josh Hart',
    'New Zealand',
    'Tūrangi',
    'Josh Hart is the guide behind Central North Guiding, based in Tūrangi — the beating heart of New Zealand trout fishing. With 6 years of professional guiding experience and NZPFGA certification, he covers the full Taupō district and beyond: the Tongariro and Tauranga-Taupō rivers through to the wilder, less-pressured waters of the Whakapapa and Whanganui. The Taupō fishery is one of the few places in New Zealand open year-round, and Josh knows exactly when and where to be. In summer, expect backcountry sight fishing and dry fly work in clear, remote streams. From July through September, the Tongariro fills with hard-fighting spawning rainbows — what locals call "chromers" — and it is some of the finest river fly fishing anywhere in the world. Josh adapts every day to the fish, the conditions, and the angler in front of him. Half day, full day, or multi-day — all tailored to what you want from the trip.',
    ARRAY['English'],
    ARRAY['Rainbow Trout', 'Brown Trout'],
    6,
    NULL,
    NULL,
    NULL,
    'commission',
    'active',
    NOW(),
    'joshhart911@gmail.com'
  )
  RETURNING id INTO v_guide_id;

  RAISE NOTICE 'Created guide: % (id=%)', 'Josh Hart', v_guide_id;

  -- ── 2. Experience page ─────────────────────────────────────────────────────

  IF EXISTS (
    SELECT 1 FROM experience_pages
    WHERE slug = 'fly-fishing-taupo-tongariro-central-north-island'
  ) THEN
    RAISE NOTICE 'Experience page already exists — skipping.';
    RETURN;
  END IF;

  INSERT INTO experience_pages (
    guide_id,
    experience_name,
    slug,
    country,
    region,
    status,
    price_from,
    price_type,
    currency,
    difficulty,
    physical_effort,
    non_angler_friendly,
    technique,
    target_species,
    environment,
    intro_text,
    story_text,
    catches_text,
    rod_setup,
    best_months,
    season_months,
    peak_months,
    species_details,
    includes,
    excludes,
    what_to_bring,
    location_lat,
    location_lng,
    meta_title,
    meta_description
  ) VALUES (
    v_guide_id,
    'Fly Fishing — Taupō & Tongariro, Central North Island',
    'fly-fishing-taupo-tongariro-central-north-island',
    'New Zealand',
    'Central North Island',
    'active',
    550,
    'flat',
    'NZD',
    'Beginner–Expert',
    'Low–High',
    false,
    ARRAY['Fly fishing'],
    ARRAY['Rainbow Trout', 'Brown Trout'],
    ARRAY['River', 'Lake', 'Backcountry'],
    -- intro_text
    'The Taupō fishing district is one of the few places in New Zealand open to fly fishing year-round — and one of the world''s best places to do it. Centred on Lake Taupō and the world-famous Tongariro River, the region holds wild populations of rainbow and brown trout that fish hard across every season. Central North Guiding gives you local access to the full district: from the iconic Tongariro pools to the remote Whakapapa and Whanganui rivers, tailored to you and the conditions on the day.',
    -- story_text
    'The Tongariro River is legendary for a reason. Wild rainbows introduced in the 1880s have naturalised completely, shaped by cold volcanic water into fish that fight far above their weight. In winter — July through September — they run in from the lake to spawn, stacking in pools and running hard. Chromers, locals call them: bright, fresh, strong fish pushing 3–5 kg. On the right day on the Tongariro in winter, you will fish water most anglers never experience.

Summer brings a completely different kind of fishing. Backcountry streams run clear and low — ideal for sight fishing, hunting individual browns and rainbows feeding in pools and riffles, presenting a dry fly or nymph with precision. Cicada season sees fish on the surface in numbers. The remoter rivers Josh fishes beyond the Taupō district — the Whakapapa, the Whanganui, and others he does not name publicly — hold fewer anglers and more wary, well-fed fish.

Every day is planned around the conditions. Water level, temperature, hatch activity, time of year, and your experience all shape where Josh takes you and how you fish. Half day, full day, or a tailored multi-day itinerary — the Taupō district has enough variety to fill a week without repeating the same water twice.',
    -- catches_text
    'Rainbow trout are the signature species: wild, acrobatic, and powerful. Winter-run fish on the Tongariro regularly push 3–5 kg. Brown trout in the backcountry rivers and spring creeks grow large and selective, with good fish of 2–4 kg a realistic target. Both species are present year-round. The fishery is sustainable — clients may keep their catch if they choose, but catch-and-release is encouraged.',
    -- rod_setup
    '5-weight to 7-weight single-hand rod depending on technique and conditions. Josh brings rods, reels, waders, boots, and a full fly selection covering nymphs, dry flies, and streamers for every season. Bring your own gear if you prefer — just let Josh know in advance.',
    -- best_months
    'July–September (winter chromers) · December–March (dry fly & backcountry)',
    -- season_months — year-round
    ARRAY[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    -- peak_months — winter run + summer
    ARRAY[7, 8, 9, 12, 1, 2, 3],
    -- species_details
    '[
      {
        "name": "Rainbow Trout",
        "description": "The signature fish of the Taupō district — wild rainbows descended from the original 1880s stock, fully naturalised and shaped by cold volcanic rivers. River fish average 1.5–3 kg; winter-run fish on the Tongariro pushing 3–5 kg are a realistic expectation July through September. Acrobatic fighters that regularly clear the water on the take. Nymphing, streamers, and dry flies all effective depending on the season.",
        "image_url": "",
        "image_urls": [],
        "season_months": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        "peak_months": [7, 8, 9]
      },
      {
        "name": "Brown Trout",
        "description": "Found in the backcountry streams, spring creeks, and quieter tributaries of the wider Taupō region. Browns here grow large on a rich diet of invertebrates, with fish of 2–4 kg in good numbers. Wary and selective — best targeted with sight fishing techniques, dry flies in summer and early autumn, or carefully presented nymphs. The remoter rivers Josh covers hold some of the least-pressured brown trout fishing in New Zealand.",
        "image_url": "",
        "image_urls": [],
        "season_months": [1, 2, 3, 4, 5, 9, 10, 11, 12],
        "peak_months": [11, 12, 1, 2]
      }
    ]'::jsonb,
    -- includes
    ARRAY[
      'Fly rods, reels, and lines',
      'Full fly selection — nymphs, dry flies, and streamers for every season',
      'Tippet and leaders',
      'Waders and wading boots',
      'Lunch and water for the day',
      'Transport from meeting point'
    ],
    -- excludes
    ARRAY[
      'Fishing licence (purchased on the morning of the first day — Josh will guide you through the process)',
      'Suitable clothing for the day — bring warm, waterproof layers'
    ],
    -- what_to_bring
    ARRAY[
      'Polarised sunglasses — essential for sight fishing',
      'Warm thermal layers (temperature changes throughout the day)',
      'Waterproof jacket and rain shell',
      'Wide-brim hat',
      'Sunscreen and lip balm',
      'Warm socks for wading',
      'Camera'
    ],
    -- location: Tūrangi / Tongariro River, Lake Taupō south end
    -38.9908,
    175.8019,
    -- meta_title
    'Guided Fly Fishing — Tongariro River & Taupō, New Zealand | FjordAnglers',
    -- meta_description
    'Fish the Tongariro River and Taupō district year-round with Josh Hart of Central North Guiding. NZPFGA certified. Wild rainbows, winter chromers, backcountry browns. From NZD 550 half day.'
  )
  RETURNING id INTO v_exp_id;

  RAISE NOTICE 'Created experience page: % (id=%)', 'Fly Fishing — Taupō & Tongariro, Central North Island', v_exp_id;

  -- ── 3. Trip options ────────────────────────────────────────────────────────

  -- Option 1: Half Day
  INSERT INTO experience_page_options (
    experience_page_id,
    sort_order,
    label,
    price_from,
    price_type,
    catches_text,
    target_species,
    season_months,
    peak_months,
    includes,
    excludes,
    what_to_bring,
    content_blocks
  ) VALUES (
    v_exp_id,
    0,
    'Half Day',
    550,
    'flat',
    'Approx 4–5 hours on the water. Josh picks the right spot for current conditions — a Tongariro pool in winter, a backcountry run for sight fishing in summer, or the lake edge when the river is running high. Up to 2 anglers.',
    ARRAY['Rainbow Trout', 'Brown Trout'],
    ARRAY[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    ARRAY[7, 8, 9, 12, 1, 2, 3],
    ARRAY[
      'Fly rod, reel, and full fly selection',
      'Tippet and leaders',
      'Waders and wading boots',
      'Water and refreshments',
      'Transport from meeting point'
    ],
    ARRAY[
      'Fishing licence',
      'Suitable clothing for the conditions'
    ],
    ARRAY[
      'Polarised sunglasses',
      'Warm, waterproof layers',
      'Hat with brim',
      'Sunscreen'
    ],
    '[
      {
        "headline": "Half a Day on the Tongariro",
        "text": "The Taupō district fishes well in half a day — and Josh picks the right water for the conditions. Whether that''s nymphing a Tongariro pool in winter, dry fly work on a backcountry stream in summer, or lake-edge fishing when the river is running high, you''re on productive water from the first cast.\n\nNZD 550. Up to 2 anglers. Fishing licence and clothing not included.",
        "image_url": ""
      }
    ]'::jsonb
  );

  -- Option 2: Full Day
  INSERT INTO experience_page_options (
    experience_page_id,
    sort_order,
    label,
    price_from,
    price_type,
    catches_text,
    target_species,
    season_months,
    peak_months,
    includes,
    excludes,
    what_to_bring,
    content_blocks
  ) VALUES (
    v_exp_id,
    1,
    'Full Day',
    1000,
    'flat',
    'A full 8-hour day across the Taupō district and beyond. Josh covers river nymphing, dry fly, backcountry sight fishing, or lake fly fishing — often a combination of techniques and locations in a single day, always tailored to season and conditions. Up to 2 anglers.',
    ARRAY['Rainbow Trout', 'Brown Trout'],
    ARRAY[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    ARRAY[7, 8, 9, 12, 1, 2, 3],
    ARRAY[
      'Fly rods, reels, and full fly selection',
      'Tippet and leaders',
      'Waders and wading boots',
      'Lunch and water for the day',
      'Transport from meeting point'
    ],
    ARRAY[
      'Fishing licence',
      'Suitable clothing for the conditions'
    ],
    ARRAY[
      'Polarised sunglasses — essential for sight fishing',
      'Warm thermal layers',
      'Waterproof jacket and rain shell',
      'Wide-brim hat',
      'Sunscreen',
      'Camera'
    ],
    '[
      {
        "headline": "A Full Day Across the Taupō District",
        "text": "The full day shows the real range of the Taupō region. In winter — July through September — the Tongariro fills with spawning rainbows running in from the lake: bright, fresh, hard-fighting fish that locals call chromers. Nymphing and streamer fishing at its best. In summer, the focus shifts to backcountry streams and remote rivers, sight fishing for selective browns and rainbows in clear, low water.\n\nJosh reads the conditions, picks the right water, and adapts the approach to what''s working. Whether you''re an experienced fly angler or new to the sport, every full day is built around giving you the best possible chance.\n\nNZD 1,000 per day. Up to 2 anglers. Fishing licence and clothing not included.",
        "image_url": ""
      }
    ]'::jsonb
  );

  RAISE NOTICE 'Created 2 trip options for experience page %', v_exp_id;

END $$;
