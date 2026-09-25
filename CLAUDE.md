# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Our Little Garden": a private gift site. It's a 3D night garden (Next.js 15 App Router + React Three Fiber) where each flower opens an "open when…" letter. It has two layers:
- **Original letters:** fixed in code, one pre-placed flower each.
- **Shared garden:** letters planted from the site into Supabase, which appear live for both viewers.

Deploys to Vercel from `main` (every push to `main` goes to production).

## Commands

```bash
npm run dev      # dev server on :3000
npm run build    # production build (also type-checks and lints)
npm start        # serve the production build
npm run lint     # next lint
npx tsc --noEmit -p .
```

There is no test suite. Verify changes by running the app. Useful URL flags: `?skipintro` (straight to the garden), `?reset` (forget opened letters), `?debug` (FPS meter, and `window.__gardenRenderer` for `info.render.calls`).

- **One `.next` folder:** `next dev` and `next build` both write to it. Stop any running server before building, or the running server breaks with "Cannot find module './NNN.js'".
- **`.next/types` stubs:** if you delete an `app/` route, run `tsc` after a build, or stale stubs in `.next/types` will report missing modules.

## Architecture

### Two separate flower lists (keep them separate)
- **`FLOWER_REGISTRY` (`lib/flowerSpecs.ts`):** every *known* flower type. Each has a `name`, a suggested `label`, `plantable`, and its visual `spec` (petal layers, center, stem, leaves). The planting form's choices come from here (`PLANT_KINDS` in `lib/plants.ts` = the plantable entries). `final` (the moon lotus) is not plantable.
- **`FLOWER_SPOTS` (`lib/layout.ts`):** what's *pre-placed* on load, and where. Its keys form the `PrePlacedFlower` type, and `Memory.flower` in `data/memories.ts` must be one of them.
- **Adding a flower type** to the registry does not put it in the garden. It only appears once someone plants one.

### Original letters and progress
- **Letter content:** `data/memories.ts` holds the text. It is the file the user edits by hand; don't rewrite letters.
- **Progress:** `lib/gardenStore.ts` (zustand) holds the stages (`intro` → `entering` → `garden`), the open letter (`activeId`), and read progress.
- **Only `opened` is persisted.** It uses `skipHydration` plus a manual `rehydrate()` in `components/GardenExperience.tsx`.
- **`progressStorage` ignores writes until `hydrated`.** Without this, any `setState` made before rehydration would wipe saved progress.
- **The final bloom:** it unlocks after the six other letters (`LETTER_IDS`), and closing the sixth triggers the `celebrating` camera moment.

### Shared "grow a plant" layer (Supabase)
- **Client:** `lib/supabase.ts`. The publishable key is committed on purpose; RLS allows only `select` and `insert` on `plants`, and uploads to the public `garden-media` bucket.
- **Passcode:** checked client-side against a SHA-256 hash in `lib/plants.ts`. Never write the passcode itself into files.
- **Sync:** `lib/plantStore.ts` fetches plants, subscribes to realtime INSERTs, and refetches on reconnect and tab focus. It dedupes by id, and ids are generated client-side so your own realtime echo isn't announced.
- **Spot choice:** `choosePlantSpot` in `lib/plants.ts` picks where a plant grows, preferring spots in view; a lotus goes on the pond.
- **Separate read list:** planted letters keep their own read list in localStorage. They must never go through `gardenStore.markRead`, which would retrigger the celebration.
- **Rendering:** `components/garden/Plants.tsx` renders plants, and `LetterModal` opens them. `Flower`'s optional `grow` ref drives the grow-in animation.

### Scene conventions (`components/garden/`)
- **Growth values:** `lib/growth.ts` holds shared mutable values read inside `useFrame` (not React state): `garden.growth` and the shared uniforms (`uTime`, `uSaturation`, `uWind`), advanced by `GrowthDriver`.
- **`withGrowth(material)`:** patches built-in materials so the garden starts desaturated and colours in as letters are read.
- **`withCameraFade(material, near, far, center?)`:** dithers objects away when the camera comes close (trees, fence, cottage, gardeners). Pass a shared `center` uniform for multi-mesh figures so they fade as one.
- **Performance:** scatter geometry is `InstancedMesh` (grass, trees, rocks, fence, path stones), and the cottage merges its static parts per material. Watch draw calls; the scene is about 150.
- **Terrain:** `lib/terrain.ts` has `groundHeight`, the pond basin, and the rim hills. Place things with `groundHeight`.
- **Camera:** `CameraRig.tsx` uses drei `OrbitControls` (full 360°) plus GSAP flights. drei only calls `controls.update()` while enabled, so flights set `enabled = false` and call `camera.lookAt` in `onUpdate`.

### Intro sequence
The "Enter the garden" click does three things:
- starts the music (`lib/music.ts`; this must happen inside the click)
- calls `enter()`
- starts the cinematic

In the cinematic, the camera flies to the cottage outside the gate, then the door opens (`procession.doorWanted`). The gardeners walk the scripted `PROCESSION` curve out through the gate, with the camera following frame by frame. Once every walker is `done`, the camera settles on the garden, then `finishEntering()` and control is released.

- **Shared layout and runtime state:** `lib/procession.ts` holds the cottage and path layout plus the runtime state (`procession`) that the cottage, gardeners and camera coordinate through.
- **Skipping:** `introSkipped` lives in the store (not in a three-importing module) so the UI can set it without pulling 3D code into the main bundle. Reduced motion skips the procession entirely.
- **Gardener state machine:** `components/garden/Gardeners.tsx` runs `waiting` → `intro-walk` → `idle` / `walk` / `greet`.
- **Wandering:** `lib/wander.ts` picks walkable targets, avoiding the pond, flowers, plants and each other.

### Audio
- **Music:** `lib/music.ts` streams one `<audio>` element through a Web Audio `GainNode`, because iOS ignores `audio.volume`.
- **Ducking:** `duckMusic()` returns a restore function; `LetterModal`'s `VoiceNote` calls it while a letter's audio plays.
- **Controls:** `MusicControl` is the top-right speaker, and the Plant button shifts left when it's showing.

## Constraints
- **Personal media stays out of git:** `public/images/personal/` and `public/audio/personal/` are gitignored, so Git-based Vercel deploys don't include those files.
- **Client-only 3D:** three.js only runs client-side. `GardenCanvas` is loaded with `dynamic(..., { ssr: false })`.
- **Browser testing on this Windows machine:** puppeteer-core driving Edge with SwiftShader only works when run from PowerShell, not Git Bash.
