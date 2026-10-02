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
- **Gardener state machine:** `components/garden/Gardeners.tsx` runs `waiting` → `intro-walk` (your own gardener only), then whichever fits who's driving:
  - `player`: you.
  - `remote`: the other person, live.
  - `idle` / `walk` / `greet`: the original wander machine, used while nobody drives that gardener.
  - `homeward`: walking back to the cottage.
- **Wandering:** `lib/wander.ts` picks walkable targets, avoiding the pond, flowers, plants and each other. `offGroundBy` is the looser check for steered gardeners.

### Zones (`components/zones/registry.ts`)
- **The registry:** `ZONES` maps each zone name (`garden`, `house`, `far-garden`, and the five places off the far garden: `greenhouse`, `treehouse`, `gazebo`, `lighthouse`, `maze`) to four things:
  - `Scene`: everything in the zone except the gardeners, including its own camera and `OrbitControls`.
  - `ground`: height and walkability, plus the wander planner.
  - `spawns`: arrival points, by entry point.
  - `exits`: name, position, radius, target zone and target spawn.
- **Adding a zone:**
  - add its name to `ZONE_NAMES` in `lib/zones.ts`, with its wording in `ZONE_PLACES` and `ZONE_SHORT` (presence and `PartnerStatus`) and its `ZONE_INDOORS` (music);
  - register it;
  - add an exit leading to it from an existing zone.
- **Switching:** happens client-side. `goToZone` sets `leaving`, `ZoneFade` fades to dark, then `arriveInZone` swaps `zone`. `GardenCanvas` renders `<Scene key={zone} />`. `Gardeners` stays mounted outside the zones, so walkers keep their state, and the Realtime channel is untouched.
- **Each walker has a `zone`:**
  - You are always in the zone on screen, appearing at the arrival spawn.
  - A remote gardener follows the zone in their poses.
  - An unowned gardener lives in `HOME_ZONE` (the cottage). One left in view in the garden walks home through the cottage door first (mode `homeward`).
  - Only walkers in the active zone are visible or clickable. Invisible meshes still get R3F pointer events, so the handlers check `root.visible`.
- **Doors:**
  - Garden: the cottage door is the exit. `procession.nearDoor` opens it for any gardener nearby, and the walkable corridor out to it is in `offGroundBy` in `lib/wander.ts`.
  - House: the room lives in `lib/house.ts` (pure layout and walkability) and `components/zones/HouseZone.tsx`. The walls are inward-facing planes, so the near ones disappear from the outside camera.
  - Bridge: see the far garden below.
  - Either way, walking into an exit (after first stepping clear of it) or clicking the door takes it.
- **The far garden (`lib/farGarden.ts`, `components/zones/FarGardenZone.tsx`):**
  - **Getting there:** over the bridge at the back of the garden.
    - `lib/bridge.ts` holds the generic footbridge maths: its arch, deck height, a walkway that funnels you onto it, the crossing exit at its far end, and the landing spawn.
    - Each side has its own bridge over the "same" brook. A brook is a channel cut along an arc (`Brook`/`brookDepth` in `lib/terrain.ts`), with a water ribbon from `props/Brook.tsx`.
    - In the garden, `GARDEN_BRIDGE` (in `lib/props.ts`) sits at `BRIDGE_ANGLE`, through a second gateway in `Fence`. Its walkway joins `offGroundBy`, its deck joins `gardenHeight`, and `Trees` keeps a clearing beyond it.
  - **The meadow:** an open space in its own coordinates, reusing the garden's `Ground`, `Grass` and `Trees`, which now take `terrain`, `field` and `ring` props. It has a signpost in the middle and five entrances (`ENTRANCES`) evenly round it.
  - **Entrances:** each has a `to: ZoneName | null`. The registry turns every entrance with a `to` into an exit (walk into the doorway, or click it); one with `to: null` says it's still being built. All five now lead somewhere. The markers are in `components/zones/far/Entrances.tsx`; the lighthouse's is a tall tower with a turning beam, a landmark from across the meadow.
- **The places off the far garden (`lib/places/`, `components/zones/places/`):** one layout file and one scene each, registered with `farGardenPlace(Scene, plan, entrance, height?)` in the registry. That gives the zone the usual shape: ground from the plan, a spawn named `far-garden` a step inside its door, and an exit by the door back to the far garden's spawn named after the entrance (`entranceLanding`, just in front of it).
  - **`RoomPlan` (`lib/rooms.ts`):** a floor (rectangle or circle) centred on the origin, a door on its edge, and solids (circles, boxes, or walls as thick lines). `roomGround` turns it into walking rules and `roomDoor` into the spawn and exit. The cottage predates it and keeps `lib/house.ts`.
  - **Shared scene pieces (`components/zones/places/shared.tsx`):**
    - `PlaceCamera`, with a `PlaceView` whose `follow` is `still` (a room), `edges` (a lawn) or `always` (the maze);
    - `WayOut`, the clickable door back;
    - `boxRoomWalls`, cottage-style cutaway walls (the panels come from `components/zones/walls.ts`, shared with the cottage);
    - `CountdownWhenNear`.

    Indoors, merged parts use `plain` materials (`useMergedParts(build, palette, plain)`), which stay in full colour like the cottage's. Outdoors, they use the default `matte`, which colours in as the garden grows.
  - **Greenhouse:** a stand of every `FLOWER_REGISTRY` entry (`CATALOG`), each a real `Flower` with a hand-written name card. Hovering one shows its name and "open when…". The potting bench calls `usePlantStore.openForm()`, the same form and passcode as the Plant button.
  - **Treehouse:** a small cutaway plank room with a window, which shows a painted view of the far garden. Atmosphere only.
  - **Gazebo:** an open lawn scene; the gazebo floor is raised in `gazeboHeight`. Deliberately empty, kept for later.
  - **Lighthouse:** a round room whose wall is a `BackSide` cylinder, so the near half vanishes from any angle. Its lamp keeps the countdown: `lib/countdown.ts` holds `NEXT_VISIT_DATE` (null = off).
    - **`countdown()`** returns `unset`, `counting` or `arrived`.
    - **What shows it:** the lamp, the tower's beam and hover tag, and `CountdownWhenNear` (in the far garden by the tower, and inside by the lamp). Each handles all three states, so turning it on is only setting the date.
  - **Maze:** `PASSAGES` in `lib/places/maze.ts` lists the open edges between cells of a 7×7 grid, and everything else is hedge. Hedges are wall solids, merged into runs. In the clearing grows `HEARTSEASE` (a spec only used here, deliberately not in the registry), with `MAZE_SECRET` as the message.
- **Cameras:** `components/zones/camera.ts` has what the outdoor zones share:
  - `portraitPull` and `framed` for tall screens;
  - `arrivalPose`, for behind where you appear;
  - `keepPlayerInView`, the follow;
  - `fitFov`.

  The far garden opens on an overview of the meadow, from the bridge to the lighthouse's lamp, when you come over the bridge. Back out of a place, it looks at the doorway you came through.
- **Keepsakes in the cottage:** these are clickable room objects in `components/zones/HouseKeepsakes.tsx`, each wrapped in `KeepsakeObject` (a halo, plus a point light and a slight lift on hover).
  - **Photo wall:** `useWallPhotos` merges two sources, each tagged with its `origin`:
    - photos hung directly in the cottage: the `house_photos` table, synced by `startHousePhotoSync` in `lib/housePhotos.ts`, with files under `house-photos/` in `garden-media`. Upload is behind the passcode.
    - photos from *opened* letters only.
    These stay independent of plants and letters.
  - **Notes board:** the `notes` table, synced like plants by `startNoteSync` in `lib/notes.ts`. It's insert/select only, and uses the same passcode gate as planting.
  - **Bookshelf:** the letter archive, which lists only letters opened on this device: `gardenStore.opened` plus `plantStore.read`. Re-reading goes through `selectFlower`, and closing the letter returns to the archive (`useKeepsakes.rereading`).
  - **Panels:** `components/ui/Keepsakes.tsx` holds the panels these open; which one is open is in `lib/keepsakes.ts`. Walking and the joystick pause while one is open.
- **Music indoors:** `lib/music.ts` follows the zone (`ZONE_INDOORS`: the cottage, greenhouse, treehouse and lighthouse). Inside, it crossfades to `HOUSE_SRC` if that's set; otherwise it runs the garden track through a lowpass filter at a lower level.
- **Re-entering the garden remounts its scene.** Anything that animates on mount must remember it already ran (see `grown` in `Plants.tsx`).
- **`?debug` test helpers:** `window.__garden` exposes:
  - `zones`, `player`, `zone()`, `toScreen()`, `exitsOnScreen()`;
  - `stores`: garden, plants, notes, housePhotos, zone, mail, keepsakes and stargazing;
  - `seats`, `seated`, `seatRequest` and `night`.

  Tests can stage data in the page without touching Supabase. Never post real mailbox letters from a test: they'd be delivered to the other person.

### Garden props (`lib/props.ts`, `components/garden/props/`)
- **Layout:** `lib/props.ts` is pure layout plus a little runtime state. The swing (and the extra tree it hangs from), the dock and the mailbox each have a `Frame` (origin plus yaw, local +z is the front), like the cottage. The stargazing `HILL` lives in `lib/terrain.ts`, because it's part of `groundHeight`.
- **Spacing:** `distanceToProps` and `onHilltop` keep grass, wildflowers, rocks, wandering (`isOpenGround`) and new plants (`choosePlantSpot`) clear of the props. `OBSTACLES` are solid for walking (`offGroundBy`). The dock is walkable over the water (`onDockWalk`), and `deckHeight` raises gardeners onto its boards (`gardenHeight` in the registry).
- **Sitting:** `SEATS` holds two seats on the swing and one on each dock bench.
  - **Taking a seat:** clicking a seat prop sets `seatRequest`, which your gardener takes up in `player` mode if you're within `SIT_REACH`. Movement or a second click gets them up.
  - **Not a mode:** sitting is layered over `player` and `remote` (`Walker.seat`, `sitT`).
  - **Sync:** poses carry `anim: "sit"` and `seat`. `seated` maps names to seats every frame.
  - **Together:** `TogetherCue` floats hearts when both of you are on the same prop. The swing's sway is `swingMotion.angle`, which `seatPose` follows.
- **Clicks:** props use `PropHover` (a breathing glow pool, a paper tag, and a hover light). There's a single hover light, `PropHoverLight`, moved to whichever prop is hovered, because every point light costs every lit material in the garden.
- **Stargazing:** this is local only, and `lib/stargazing.ts` holds its state. Standing on the hilltop, or clicking the hill, eases `night.amount` toward 1, which:
  - dims `Lights` and the grass;
  - darkens `Sky` toward midnight;
  - fades in `Starfield` (stars, a Milky Way and shooting stars).

  `CameraRig` then flies to `stargazePose` (the view in `STARGAZE`, turned so the trees round the edge don't fill the sky) and allows looking up past level. Walking off, or setting off after a click, flies back.
- **Mailbox:** see below. The 3D box (`props/Mailbox.tsx`) shows its flag while anything's on its way, a twinkle when it's coming to you, and an envelope and glow once a letter has arrived for you. Its panel is the `mailbox` keepsake (`components/ui/MailboxPanel.tsx`).

### Mailbox (`lib/mailbox.ts`, Supabase table `mailbox`)
- **What it is:** delayed letters to the other person. The sender picks 1 day, 3 days or 1 week, and `deliver_at` is computed when the letter is posted. The recipient is always the other name (`recipientOf`). `author` must be Zorrow or Skelly.
- **Enforced in the database:** RLS only lets a row be selected once `deliver_at <= now()`. Inserts must start `delivered = false`. The only update allowed is setting `delivered = true` on an arrived letter; there's a column-level grant on `delivered` only.
- **What's on its way:** `mailbox_pending()` (security definer, granted to anon) returns just `id, author, deliver_at` for letters still on their way. The advisor flags it, and that's intended. The UI shows the recipient only a vague "soon" or "in a few days" (`arrivalHint`), never the exact time.
- **Posting:** an insert can't return the row (it isn't selectable yet), so `postLetter` inserts without `.select()`. It then broadcasts a `mail` nudge on `garden-live` so the other device refetches.
- **Sync:** `startMailSync` refetches:
  - on load, focus and nudges;
  - every 5 minutes;
  - just after the next letter is due;
  - on realtime changes, for `delivered` updates.

  It announces "You've got mail" once per letter per visit, while you're in the garden and not reading. Opening a letter marks it `delivered`.

### Live garden (Supabase Realtime, `lib/presence.ts`)
- **Identity:** a device-local choice ("Zorrow" or "Skelly") in localStorage, asked in `IntroOverlay` or `WhoAreYou` (for `?skipintro`). It is not auth.
- **Channel:** one shared channel, `garden-live`.
  - **Presence:** tracked as `{ who, zone }` once you're past the title screen, and re-tracked on every zone change. This feeds `PartnerStatus`, the top-left indicator.
  - **Broadcast:** these events go out:
    - `pose` events carry `zone` and, while sitting, `seat`. They're sent about 12 times a second while moving or on the intro walk, and as a 2 s heartbeat while still.
    - `greet` events, for waves.
    - `mail` nudges, when a letter is posted.
  - **Started once per page:** never torn down, because realtime hands a quick remount the still-closing channel with the same topic.
- **Replay:** remote poses are timed on the sender's clock, offset by the fastest delivery seen. They're replayed `PLAYBACK_DELAY` behind real time and interpolated (`livePose`).
- **Going stale:** a gardener whose owner leaves (presence) or goes silent for 8 s (a hidden tab) goes home and wanders there. When updates resume, it hurries over to where they are, or snaps there if it's in another zone.
- **Shared per-frame state:** `lib/playerInput.ts` holds plain objects for the keyboard and joystick (`PlayerControls`) and your gardener's position. `CameraRig` reads that position to follow you while you walk.

### Audio
- **Music:** `lib/music.ts` streams one `<audio>` element through a Web Audio `GainNode`, because iOS ignores `audio.volume`.
- **Ducking:** `duckMusic()` returns a restore function; `LetterModal`'s `VoiceNote` calls it while a letter's audio plays.
- **Controls:** `MusicControl` is the top-right speaker, and the Plant button shifts left when it's showing.

## Constraints
- **Personal media stays out of git:** `public/images/personal/` and `public/audio/personal/` are gitignored, so Git-based Vercel deploys don't include those files.
- **Client-only 3D:** three.js only runs client-side. `GardenCanvas` is loaded with `dynamic(..., { ssr: false })`. UI code imports zone names and state from `lib/zones.ts`, never the registry, which pulls in the scenes.
- **Browser testing on this Windows machine:** puppeteer-core driving Edge with SwiftShader only works when run from PowerShell, not Git Bash.
