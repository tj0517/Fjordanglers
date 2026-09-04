-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: Fly Fishing Southland NZ — Kristina Placko & Daryl Paskell
--
-- Joint listing. Kristina runs Stray South (straysouthnz.com) independently;
-- together with Daryl they operate flyfishingsouthlandnz.com.
-- Universal day rate: NZD 1,200 (Kristina's published price).
--
-- Creates:
--   1. guides row         (beta listing, primary contact = Kristina)
--   2. experience_pages   (Fly Fishing — Southland, South Island NZ)
--   3. experience_page_options × 2  (Full Day NZD 1,200 / Full Day Spin NZD 1,200)
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
    'Kristina Placko & Daryl Paskell',
    'New Zealand',
    'Lumsden',
    'Kristina Placko and Daryl Paskell are the guides behind Fly Fishing Southland NZ, operating out of Lumsden in the heart of Southland — the region with New Zealand''s largest trout biomass. Between them they bring together two distinct guiding philosophies and a combined depth of experience that is hard to match anywhere in the South Island. Daryl has been guiding in Southland since 1996, built over decades of intimate knowledge of the region''s rivers, their hatches, their moods, and their fish. Kristina is NZPFGA registered, holds a Department of Conservation concession, and runs her own guiding business — Stray South — alongside the joint operation. Her approach is patient and inclusive: she makes fly fishing accessible to anyone, from complete beginners to experienced anglers looking to refine their technique. Together they cover an almost unlimited variety of waters across Southland: pristine freestone rivers, clear spring creeks, stillwater lakes, and remote backcountry streams that few outsiders ever reach. Both fly fishing and spin fishing on light tackle are on offer. The result is a guiding operation with the experience to put serious anglers on big fish, and the patience to bring new anglers into the sport properly.',
    ARRAY['English'],
    ARRAY['Brown Trout', 'Rainbow Trout'],
    30,
    NULL,
    'https://www.instagram.com/kristinaplacko',
    NULL,
    'commission',
    'active',
    NOW(),
    'straysouthnz@gmail.com'
  )
  RETURNING id INTO v_guide_id;

  RAISE NOTICE 'Created guide: % (id=%)', 'Kristina Placko & Daryl Paskell', v_guide_id;

  -- ── 2. Experience page ─────────────────────────────────────────────────────

  IF EXISTS (
    SELECT 1 FROM experience_pages
    WHERE slug = 'fly-fishing-southland-new-zealand'
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
    'Fly Fishing — Southland, South Island New Zealand',
    'fly-fishing-southland-new-zealand',
    'New Zealand',
    'Southland',
    'active',
    1200,
    'flat',
    'NZD',
    'Beginner–Expert',
    'Low–High',
    false,
    ARRAY['Fly fishing', 'Spin fishing'],
    ARRAY['Brown Trout', 'Rainbow Trout'],
    ARRAY['River', 'Lake', 'Backcountry', 'Spring Creek'],
    -- intro_text
    'Southland holds New Zealand''s largest trout biomass — and almost nobody outside the country knows about it. Clear, cold rivers winding through sheep country and native bush, spring creeks running off limestone hills, stillwater lakes set against the mountains of Fiordland. Kristina Placko and Daryl Paskell between them have spent decades fishing and guiding every corner of it.',
    -- story_text
    'Southland is not a place that shouts about itself. It sits at the bottom of the South Island, far enough from the tourist trail that most visiting anglers never make it there. That is precisely what makes it worth the trip.

The rivers here — the Mataura, the Oreti, the Aparima and the smaller streams running off the ranges — hold brown trout that have never been under serious fishing pressure. Big, wary fish in water clear enough to see the bottom at three metres. Southland has the highest density of wild trout in New Zealand, a fact its guides are quietly proud of. Finding the fish is not the challenge here. Presenting to them is.

Daryl Paskell has been guiding these rivers since 1996. He knows which reaches fish best after a rain event, which spring creeks hold fish through summer when the main rivers run low, and which backcountry valleys are worth the walk. Kristina Placko brings NZPFGA-registered guiding credentials and a philosophy that fly fishing should be genuinely accessible — she has taught complete beginners and coached experienced anglers who needed to slow down and think more carefully about their presentation.

Together they offer fly fishing and spin fishing on light tackle across an almost unlimited variety of water. October through May is the formal season, with the best dry fly fishing running through the summer months when Southland''s famous Mataura mayfly hatches bring fish to the surface in numbers.',
    -- catches_text
    'Brown trout dominate the Southland rivers — typically 1.5–3 kg, with good fish over 4 kg in the right places. Rainbow trout are present in some river systems and the stillwaters. Both species are best caught on a careful presentation: sight fishing to individual fish in clear water, or reading the water well enough to fish blind where conditions demand it.',
    -- rod_setup
    'Fly fishing: 5-weight to 6-weight single-hand rod, floating line, 9 ft leader with 4x–5x tippet. Nymphs, dry flies, and small streamers as conditions dictate. Spin fishing: light spinning rod with 4–6 lb line and small lures or soft baits. Kristina and Daryl provide rods, reels, and all terminal tackle. Bring your own gear if you prefer.',
    -- best_months
    'November–March (dry fly & summer hatches)',
    -- season_months (Oct–May)
    ARRAY[10, 11, 12, 1, 2, 3, 4, 5],
    -- peak_months
    ARRAY[11, 12, 1, 2, 3],
    -- species_details
    '[
      {
        "name": "Brown Trout",
        "description": "The signature fish of Southland — wild browns in clear, cold rivers and spring creeks. Southland has the highest density of wild trout in New Zealand. Fish average 1.5–3 kg; specimens over 4 kg are present in the right water. Selective and wary, best targeted with careful sight fishing and precise presentation. The Mataura is famous for its evening dry fly fishing during mayfly hatches.",
        "image_url": "",
        "image_urls": [],
        "season_months": [10, 11, 12, 1, 2, 3, 4, 5],
        "peak_months": [11, 12, 1, 2, 3]
      },
      {
        "name": "Rainbow Trout",
        "description": "Present in several Southland river systems and stillwaters. Rainbows here fight hard in cold water and offer a livelier, more aggressive style of fishing than the wary Southland browns. Good options in the lakes and some of the broader river systems.",
        "image_url": "",
        "image_urls": [],
        "season_months": [10, 11, 12, 1, 2, 3, 4, 5],
        "peak_months": [11, 12, 1, 2]
      }
    ]'::jsonb,
    -- includes
    ARRAY[
      'Full professional guiding',
      'Fly rods, reels, and lines (or spin gear if requested)',
      'All flies, leaders, and terminal tackle',
      'Waders and wading boots if needed',
      'Wholesome lunch, snacks, and water throughout the day',
      'Transport from meeting point'
    ],
    -- excludes
    ARRAY[
      'Fishing licence (required — guides will advise on the correct licence for your trip)',
      'Reusable water bottle (please bring your own)'
    ],
    -- what_to_bring
    ARRAY[
      'Polarised sunglasses — essential for sight fishing in clear Southland water',
      'Warm layered clothing (Southland weather changes fast)',
      'Waterproof jacket and rain shell',
      'Hat with brim',
      'Sunscreen',
      'Reusable water bottle',
      'Camera'
    ],
    -- location: Lumsden, Southland, South Island NZ
    -45.7354,
    168.4476,
    -- meta_title
    'Guided Fly Fishing in Southland, New Zealand | FjordAnglers',
    -- meta_description
    'Fish Southland''s clear rivers and spring creeks with Kristina Placko & Daryl Paskell — guides with 30 years of local knowledge. New Zealand''s highest wild trout density. NZD 1,200/day.'
  )
  RETURNING id INTO v_exp_id;

  RAISE NOTICE 'Created experience page: % (id=%)', 'Fly Fishing — Southland, South Island New Zealand', v_exp_id;

  -- ── 3. Trip options ────────────────────────────────────────────────────────

  -- Option 1: Full Day Fly Fishing
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
    'Full Day — Fly Fishing',
    1200,
    'flat',
    'A full day on Southland''s rivers or stillwaters, tailored to the season and conditions. Sight fishing to individual fish in clear water, presenting dry flies during the famous Mataura hatches, nymphing deeper lies, or exploring remote spring creeks. Up to 2 anglers.',
    ARRAY['Brown Trout', 'Rainbow Trout'],
    ARRAY[10, 11, 12, 1, 2, 3, 4, 5],
    ARRAY[11, 12, 1, 2, 3],
    ARRAY[
      'Fly rods, reels, and lines',
      'All flies, leaders, and tippet',
      'Waders and boots if needed',
      'Lunch, snacks, and water',
      'Transport from meeting point'
    ],
    ARRAY[
      'Fishing licence',
      'Reusable water bottle'
    ],
    ARRAY[
      'Polarised sunglasses',
      'Warm, waterproof layers',
      'Hat with brim',
      'Sunscreen',
      'Water bottle'
    ],
    '[
      {
        "headline": "A Day on Southland''s Rivers",
        "text": "Southland has New Zealand''s largest wild trout biomass — and its rivers are some of the clearest, most fishable water in the country. A full day with Kristina or Daryl means access to that water with someone who knows it properly: where the fish hold by season, which reaches fish best after rain, which spring creeks come alive in summer.\n\nDry fly, nymph, or streamer — the approach follows the conditions. In summer, the Mataura evening rise is one of New Zealand fly fishing''s iconic experiences: hatching mayflies, rising browns, long light.\n\nNZD 1,200 per day. Up to 2 anglers. Fishing licence not included.",
        "image_url": ""
      }
    ]'::jsonb
  );

  -- Option 2: Full Day Spin Fishing
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
    'Full Day — Spin Fishing',
    1200,
    'flat',
    'Sight fishing on light spinning tackle — an effective and accessible option in Southland''s clear rivers. Small lures and soft baits presented to individual fish spotted in the current. A great option for anglers not yet comfortable with fly casting, or as a complementary technique on days when fly fishing conditions are tough.',
    ARRAY['Brown Trout', 'Rainbow Trout'],
    ARRAY[10, 11, 12, 1, 2, 3, 4, 5],
    ARRAY[11, 12, 1, 2, 3],
    ARRAY[
      'Light spinning rods and reels',
      'All lures and terminal tackle',
      'Waders and boots if needed',
      'Lunch, snacks, and water',
      'Transport from meeting point'
    ],
    ARRAY[
      'Fishing licence',
      'Reusable water bottle'
    ],
    ARRAY[
      'Polarised sunglasses — essential for spotting fish',
      'Warm, waterproof layers',
      'Hat with brim',
      'Sunscreen',
      'Water bottle'
    ],
    '[
      {
        "headline": "Spin Fishing in Clear Water",
        "text": "Southland''s rivers are clear enough that you can spot individual fish and cast to them — the same sight fishing approach as fly fishing, but on light spinning gear. Small lures worked through the current are a natural, effective presentation in these conditions, and a great way to fish if you''re new to the sport or want a break from the fly rod.\n\nKristina and Daryl offer spin fishing as a standalone option or alongside fly fishing on the same day.\n\nNZD 1,200 per day. Up to 2 anglers. Fishing licence not included.",
        "image_url": ""
      }
    ]'::jsonb
  );

  RAISE NOTICE 'Created 2 trip options for experience page %', v_exp_id;

END $$;
