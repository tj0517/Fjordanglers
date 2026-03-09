# FjordAnglers — Remotion Memory

## Project location
`/Users/tymonjezionek/Desktop/fjordAnglers/remotion/` — standalone folder, separate from the Next.js web project.

## What was built
Full Remotion project: **GuidePromo** — 75-second video targeting Scandinavian fishing guides, camps, outfitters.

## Structure
```
remotion/
├── package.json              # pnpm exec remotion add ... to install deps
├── tsconfig.json
├── public/
│   ├── brand/                # ADD white-logo.png (copy from web project)
│   └── stock/                # ADD 5 stock video clips (see below)
└── src/
    ├── index.ts              # registerRoot entry
    ├── Root.tsx              # Composition: GuidePromo (2250 frames, 30fps, 1920×1080)
    ├── constants.ts          # BRAND tokens, SCENE_DUR, VIDEO_SOURCES, VIDEO_PLACEHOLDERS
    ├── animations.ts         # fadeIn, slideUp, slideX, scaleIn, expandPercent, pulse
    ├── fonts.ts              # @remotion/google-fonts/Inter
    ├── GuidePromo.tsx        # TransitionSeries root, music placeholder
    ├── components/
    │   ├── VideoBg.tsx       # Video bg + rich placeholder when VIDEO_SOURCES[key]=null
    │   ├── TagChip.tsx       # Salmon pill labels
    │   ├── FeatureBullet.tsx # Staggered animated bullets
    │   └── PricingCard.tsx   # Pricing comparison card
    └── scenes/
        ├── 01-ColdOpen.tsx        4s  "You catch fish."
        ├── 02-Problem.tsx        10s  3 beat problem statement
        ├── 03-BrandIntro.tsx      8s  Logo + tagline + divider + countries
        ├── 04-ProfileFeature.tsx 10s  Left col + bullets + video bg
        ├── 05-BookingsFeature.tsx 10s  Right col + €0 counter + video bg
        ├── 06-AnglersFeature.tsx 10s  Bottom layout + country pills + video bg
        ├── 07-Pricing.tsx        10s  Two pricing cards (no video)
        ├── 08-FoundingGuide.tsx   8s  Salmon bg + progress bar (spotsTaken prop)
        └── 09-CTA.tsx             5s  Logo + URL pulse + fine print
```

## Videos to buy (5 clips)
All in src/constants.ts under VIDEO_SOURCES — set to null until clip is added.
Each scene file has full stock instructions in the JSDoc header.

| Key | File | Shot |
|-----|------|------|
| coldOpen | scene-01-cold-open.mp4 | Salmon river golden hour, silhouette mid-cast |
| problem | scene-02-problem.mp4 | Guide alone on dock/cabin, phone/laptop |
| profile | scene-04-profile.mp4 | Guide portrait in waders, authentic smile |
| bookings | scene-05-bookings.mp4 | Cozy camp exterior OR hands with phone |
| anglers | scene-06-anglers.mp4 | Group of 2-4 Central European anglers |

## To activate a video
1. Put `.mp4` in `remotion/public/stock/`
2. In `src/constants.ts`, update `VIDEO_SOURCES`:
   ```ts
   import { staticFile } from "remotion";
   coldOpen: staticFile("stock/scene-01-cold-open.mp4"),
   ```
3. The `VideoBg` placeholder disappears automatically.

## To activate the logo
Copy `white-logo.png` from web project:
```bash
cp ../web/fjordanglers/public/brand/white-logo.png public/brand/white-logo.png
```
Then uncomment the `<Img>` lines in `03-BrandIntro.tsx` and `09-CTA.tsx`.

## To update Founding Guide spots (Scene 8)
Change `defaultProps.spotsTaken` in `Root.tsx`, or pass via CLI:
```bash
pnpm render --props '{"spotsTaken": 38}'
```

## Install & run
```bash
cd /Users/tymonjezionek/Desktop/fjordAnglers/remotion
pnpm install
pnpm exec remotion add @remotion/google-fonts
pnpm exec remotion add @remotion/media
pnpm exec remotion add @remotion/transitions
pnpm start   # Remotion Studio
pnpm render  # Render 1920×1080
```

## Key rules followed (remotion-best-practices)
- All animations via useCurrentFrame() + interpolate/spring — NO CSS transitions
- Video from @remotion/media, Img/staticFile from remotion
- Sequence premountFor used in TransitionSeries.Sequence
- Font loaded via @remotion/google-fonts/Inter (loadFont)
- Audio from @remotion/media (commented out, ready to activate)
