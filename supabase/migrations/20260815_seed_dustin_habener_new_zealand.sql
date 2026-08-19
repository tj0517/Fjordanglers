-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: Dustin Habener — Wild Waters Fly, New Zealand
--
-- Creates:
--   1. guides row         (beta listing, no auth account yet)
--   2. experience_pages   (Guided Fly Fishing — Central North Island)
--   3. experience_page_options × 2  (River Day Trip / Lake Boat Day Trip)
--
-- Run once in the Supabase dashboard SQL editor.
-- Idempotent: checks for existing slug before inserting.
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
    pricing_model,
    status,
    verified_at,
    invite_email
  ) VALUES (
    NULL,
    true,
    'Dustin Habener',
    'New Zealand',
    'Taupo',
    'Dustin Habener is the founder of Wild Waters Fly, based in New Zealand''s Central North Island. With 8 years of professional guiding experience on the rivers and lakes around Taupo, Rotorua, and Hawke''s Bay, he offers access to some of the most productive wild trout fisheries in the Southern Hemisphere. A certified skipper, Dustin is equally at home wading a remote backcountry stream or running the boat across a still-water lake. He has led the Victorian Fly Fishers'' Association''s annual group week for three consecutive years — a track record that speaks to repeat clients and serious fly fishers.',
    ARRAY['English', 'German'],
    ARRAY['Rainbow trout', 'Brown trout', 'Kingfish'],
    8,
    NULL,
    'https://www.instagram.com/dustin_habanero',
    'commission',
    'active',
    NOW(),
    'info@wildwatersfly.com'
  )
  RETURNING id INTO v_guide_id;

  RAISE NOTICE 'Created guide: % (id=%)', 'Dustin Habener', v_guide_id;

  -- ── 2. Experience page ─────────────────────────────────────────────────────

  -- Guard against duplicate slug
  IF EXISTS (
    SELECT 1 FROM experience_pages
    WHERE slug = 'guided-fly-fishing-central-north-island-new-zealand'
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
    'Guided Fly Fishing — Central North Island, New Zealand',
    'guided-fly-fishing-central-north-island-new-zealand',
    'New Zealand',
    'Central North Island',
    'active',
    1250,
    'flat',
    'NZD',
    'Intermediate',
    'Medium',
    false,
    ARRAY['Fly fishing'],
    ARRAY['Rainbow Trout', 'Brown Trout'],
    ARRAY['River', 'Lake', 'Backcountry'],
    -- intro_text
    'New Zealand''s Central North Island holds some of the world''s most productive wild trout fisheries. Dustin Habener of Wild Waters Fly has spent 8 years guiding anglers through the crystal-clear rivers and lake systems of the Taupo region — where 4-pound rainbows are routine and browns pushing double digits are a real possibility.',
    -- story_text
    'The Taupo Fishing District is legendary for a reason. Its rivers run cold and clear off the volcanic plateau, carrying wild populations of rainbow and brown trout that have never been stocked — descendants of the original fish introduced in the 1880s, now fully naturalised. Sight fishing is the order of the day on backcountry streams: polarised glasses, careful wading, hunting fish holding in gin-clear pools and riffles.

Dustin reads water the way a true local does. He knows which runs hold fish after a fresh, which flats warm up first in spring, and which rivers see the big evening hatches in December. Every day is planned around current conditions — water level, temperature, hatch activity — and tailored to your experience level. Whether you''re presenting dry flies to sipping trout in a backcountry stream or stripping streamers across a lake drop-off from the boat, you''re fishing with someone who knows every bend.

Beyond the rivers, Lake Taupo itself is one of the world''s great still-water trout fisheries: vast, clear, and full of big fish that move in to feed along the edges and inflows. The lake option brings a different kind of fishing — boat access to deep drop-offs, weed edges, and inflows not reachable from shore.',
    -- catches_text
    'Rainbow trout are hard-fighting, acrobatic fish — expect them to jump. Browns in the back-country rivers grow large and selective on a rich diet of invertebrates. Both species are present year-round, with fishing style shifting by season: nymphing through winter, classic dry fly and emerger work from October through February, and big streamer action on the lake as fish move in to feed.',
    -- rod_setup
    '5-weight to 7-weight single-hand rod, matched to conditions. Dustin provides rods, reels, and a full selection of flies for every situation — nymphs, dry flies, and streamers. Leaders 9–12 ft with 3x–5x tippet. Bring your own gear if you prefer — just let Dustin know in advance.',
    -- best_months
    'November–February',
    -- season_months (Oct–May)
    ARRAY[10, 11, 12, 1, 2, 3, 4, 5],
    -- peak_months (Nov–Feb)
    ARRAY[11, 12, 1, 2],
    -- species_details
    '[
      {
        "name": "Rainbow Trout",
        "description": "The Taupo region''s signature fish — wild, hard-fighting rainbows descended from the original McCloud River stock planted in the 1880s. River fish run 1.5–3 kg on average, with trophy fish over 4 kg a genuine possibility. Acrobatic fighters, often throwing themselves clear of the water on the take. Respond well to nymphs, dry flies, and streamers depending on the season.",
        "image_url": "",
        "image_urls": [],
        "season_months": [10, 11, 12, 1, 2, 3, 4, 5],
        "peak_months": [11, 12, 1, 2]
      },
      {
        "name": "Brown Trout",
        "description": "Found in the backcountry rivers and spring creeks around Hawke''s Bay and the Rotorua streams. Browns here are wary and selective — specimens of 3–6 kg are present in good numbers, and they''re earned rather than given. Best targeted with dry flies in the evenings or carefully presented nymphs in the early morning.",
        "image_url": "",
        "image_urls": [],
        "season_months": [10, 11, 12, 1, 2, 3, 4, 5],
        "peak_months": [10, 11, 12, 1, 2]
      }
    ]'::jsonb,
    -- includes
    ARRAY[
      'Fly rods, reels, and lines',
      'Full fly selection — nymphs, dry flies, and streamers',
      'Tippet and leaders',
      'Waders, wading boots, and wading staff',
      'Lunch and drinks throughout the day',
      'Transport from meeting point'
    ],
    -- excludes
    ARRAY[
      'Fishing licence (required by NZ law — Dustin advises on the correct type for your itinerary)'
    ],
    -- what_to_bring
    ARRAY[
      'Polarised sunglasses (essential for sight fishing)',
      'Layered thermal clothing',
      'Waterproof jacket and rain shell',
      'Wide-brim hat',
      'Sunscreen and lip balm',
      'Warm socks for wading',
      'Water bottle',
      'Camera'
    ],
    -- location: Lake Taupo area, Central North Island
    -38.6843,
    176.0743,
    -- meta_title
    'Guided Fly Fishing in New Zealand''s Central North Island | FjordAnglers',
    -- meta_description
    'Fish wild rainbow and brown trout on the rivers and lakes of the Taupo region with Dustin Habener of Wild Waters Fly. 8 years guiding in New Zealand''s best fly fishing country. From NZD 1,250/day.'
  )
  RETURNING id INTO v_exp_id;

  RAISE NOTICE 'Created experience page: % (id=%)', 'Guided Fly Fishing — Central North Island, New Zealand', v_exp_id;

  -- ── 3. Trip options ────────────────────────────────────────────────────────

  -- Option 1: River Day Trip
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
    'River Day Trip',
    1250,
    'flat',
    'Wading the river systems around Taupo, Rotorua, and Hawke''s Bay. Sight fishing for wild rainbows and browns in clear backcountry streams — dry flies, nymphs, and careful presentation. Approximately 8 hours on the water. Suitable for 1–2 anglers; larger groups can be accommodated with a second guide.',
    ARRAY['Rainbow Trout', 'Brown Trout'],
    ARRAY[10, 11, 12, 1, 2, 3, 4, 5],
    ARRAY[11, 12, 1, 2],
    ARRAY[
      'Waders, boots, and wading staff',
      'Rod, reel, and full fly selection',
      'Tippet and leaders',
      'Lunch and drinks',
      'Transport from meeting point'
    ],
    ARRAY['Fishing licence'],
    ARRAY[
      'Polarised sunglasses — essential for sight fishing',
      'Layered clothing (conditions change throughout the day)',
      'Waterproof jacket or rain shell',
      'Hat with brim',
      'Sunscreen'
    ],
    '[
      {
        "headline": "Wading New Zealand''s Best Trout Rivers",
        "text": "Each river day is built around current conditions: water level, temperature, hatch activity, and time of year. In spring and early summer, dry fly fishing comes alive on the backcountry streams. Through autumn the nymph fishing is exceptional, and winter brings big fish that have moved in from the lake. Dustin selects the river on the day to give you the best possible chance.\n\nPrice NZD 1,250 per day, up to 2 anglers. A second guide can be arranged for groups of 3–4.",
        "image_url": ""
      }
    ]'::jsonb
  );

  -- Option 2: Lake (Boat) Day Trip
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
    'Lake (Boat) Day Trip',
    1400,
    'flat',
    'Boat-based fly fishing on the lake systems around Taupo and Rotorua. Stripping streamers along drop-offs and weed edges, with sight fishing opportunities in the shallows through summer. Dustin holds a Skippers Restricted Limits certification. Approximately 8 hours on the water.',
    ARRAY['Rainbow Trout', 'Brown Trout'],
    ARRAY[10, 11, 12, 1, 2, 3, 4, 5],
    ARRAY[11, 12, 1, 2],
    ARRAY[
      'Boat and fuel',
      'Rod, reel, and full fly selection',
      'Tippet and leaders',
      'Lunch and drinks',
      'Transport from meeting point'
    ],
    ARRAY['Fishing licence'],
    ARRAY[
      'Warm, waterproof jacket (lake conditions can change fast)',
      'Thermal layers — it can be cold on the water early',
      'Polarised sunglasses',
      'Hat with brim',
      'Sunscreen',
      'Camera'
    ],
    '[
      {
        "headline": "Still-Water Fly Fishing on Lake Taupo",
        "text": "Lake Taupo is one of the world''s great trout fisheries — vast, clear, and teeming with fish. The boat gives access to deep drop-offs, inflows, and weed edges not reachable from shore. Dustin holds a Skippers Restricted Limits certification, so you''re in experienced hands. Expect streamer fishing along structure and sight fishing in the shallows through summer.\n\nPrice NZD 1,400 per day, up to 2 anglers.",
        "image_url": ""
      }
    ]'::jsonb
  );

  RAISE NOTICE 'Created 2 trip options for experience page %', v_exp_id;

END $$;
