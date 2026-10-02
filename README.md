# Our Little Garden

An interactive 3D garden where each flower opens an "open when…" letter.

Built with Next.js 15, React 19, TypeScript, Tailwind CSS, React Three Fiber + drei, GSAP and Framer Motion.

## Development

```bash
npm install
npm run dev
```

Then open http://localhost:3000. To try it on a phone, run `npm run dev -- -H 0.0.0.0` and open `http://<your-computer's-LAN-IP>:3000` on a phone on the same Wi-Fi.

## Adding the letters

Everything she reads lives in [`data/memories.ts`](data/memories.ts): one entry per flower.

```ts
{
  id: "sad",                       // keep ids stable: they're how opened letters are remembered
  flower: "lily",
  label: "Open when you're sad",   // shown on the envelope and the flower's tag
  message: `First paragraph.

Second paragraph, after a blank line.`,
  photo: { src: "/images/personal/us.jpg", alt: "Us at the beach" },  // optional
  audio: { src: "/audio/personal/sad.m4a", title: "Listen to this" },  // optional
},
```

- Write `message` between backticks. A blank line starts a new paragraph; a single line break stays as a line break.
- Put photos in `public/images/personal/` and audio in `public/audio/personal/`. Both folders are gitignored, so those files never reach GitHub, which also means **a deploy from GitHub won't include them**. See "Deploying" below.
- The "just because" letter (`flower: "final"`) stays locked as a bud until the other six have been opened.

## The shared garden

Besides the seven letters above, either of you can plant new ones from the garden itself: **Plant something** (top right) asks for the passcode once per device, then lets you pick a flower, write an "open when…" letter, and attach a photo or voice note. The new flower grows in where you're looking, and if the other person has the garden open it grows in on their screen too, with a note saying who planted it.

It runs on the Supabase project **our-little-garden** (Singapore):

- Table `plants`: one row per planted letter, including its position in the garden. The browser can read and add rows, but never edit or delete them, so a leaked link can't wipe anything. To remove a plant, delete its row in the Supabase dashboard (Table Editor → plants).
- Storage bucket `garden-media`: uploaded photos (resized to at most 2000px) and voice notes, 25 MB max each.
- The project URL and publishable key are in [`lib/supabase.ts`](lib/supabase.ts). They're safe in client code: the key only allows what the table's access policies permit. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to point at a different project.

The passcode is checked in the browser against a SHA-256 hash in [`lib/plants.ts`](lib/plants.ts), which also shows how to change it. It keeps casual visitors out, not a determined one. It needs a secure connection, so planting works on localhost and the deployed site but not over `http://<LAN-IP>`.

Unfamiliar `flower_type` values (added by hand in the dashboard, say) still render as one of the six flowers.

## Walking together

The first time each device opens the garden, it asks **Who are you? Zorrow / Skelly**. The answer is saved in the browser, and there's a "Not Zorrow?" link under "Enter the garden" to change it.

- **Your own gardener:** you walk it with WASD or the arrow keys. On a phone, use the joystick that appears bottom left. The view follows when you near the edge of the screen.
- **The other gardener, while they're here:** if the other person has the garden open, their gardener walks wherever they steer it, live on your screen. A note says when they arrive.
- **The other gardener, while they're away:** it heads home to the cottage and potters about inside. If you see them leave, it walks back down the path and in through the door. When they come back, it reappears wherever they are.
- **Waving:** tapping either gardener makes it wave on both screens. If they tap yours, you get a "waved at you" note.

**Inside the cottage.** Follow the stepping stones out of the gate to the cottage, then walk into its door or click it to go inside. Inside is a little room with a bed, a table, a bookshelf and a plant. To go back out, walk into the door or click it.

The cottage keeps three things you can click. Each glows softly when you hover over it.
- **The photo wall above the bed:** photos either of you hang there (with **Add a photo**, after the passcode, plus an optional caption), and every photo from a letter you've opened. There's a gallery to browse them full size. Hung photos are stored in the Supabase table `house_photos`, with the files under `house-photos/` in the `garden-media` bucket.
- **The corkboard by the door:** short notes either of you can pin (after the same passcode as planting). They appear on the other person's board straight away. Notes are stored in the Supabase table `notes`. To take one down, delete its row in the dashboard (Table Editor → notes).
- **The bookshelf:** every letter you've already opened, to read again without walking back to its flower. Letters you haven't opened in the garden yet never show up here.

Inside, the music softens as if heard through the walls. To use a separate cottage track instead, put it in `public/audio/` and set `HOUSE_SRC` in `lib/music.ts`.

You only see the other person's gardener when you're in the same place. The top-left corner says where they are: "here with you", "in the garden", "in the cottage", or "away". While someone is away, their gardener is at home in the cottage, pottering about.

This runs on a Supabase Realtime channel (`garden-live`):
- **Presence** says who's online.
- **Broadcast** carries movement, about 12 updates a second while walking, plus waves.

Nothing is stored. There's no login: the name is just a choice on each device.

## Testing flags

Add these to the URL:

| Flag | What it does |
| --- | --- |
| `?skipintro` | Skip the opening line and go straight to the garden |
| `?reset` | Forget which letters have been opened on this device (progress is saved in the browser) |
| `?debug` | Show an FPS meter, for checking performance on a phone |

Flags combine, e.g. `/?reset&skipintro`.

## Performance

The scene adapts to the device: it starts at a moderate resolution, and if the frame rate drops it lowers the resolution and halves the grass, wildflowers, fireflies and petals. Open the site with `?debug` on her kind of phone to check the frame rate.

## Deploying

The project deploys on Vercel from the `main` branch of the private GitHub repo; every push to `main` redeploys.

Because photos and audio are gitignored, they won't be in a GitHub-based deploy. Options:

1. Now that the repo is private, remove the two `public/*/personal` blocks from `.gitignore` and commit the media.
2. Host the media elsewhere (e.g. Vercel Blob) and use full URLs in `data/memories.ts`.

The site is public to anyone with its URL (it's hidden from search engines), so share the link only with her.

## Where things live

| Path | What |
| --- | --- |
| `data/memories.ts` | Letter text, labels and optional photo/audio for each flower |
| `lib/layout.ts` | Where each flower grows, and the stepping-stone path |
| `lib/flowerSpecs.ts` | Petal shapes and colours for each flower |
| `components/garden/` | The 3D scene: terrain, pond, flowers, camera, effects |
| `components/ui/` | Intro, envelope and letter, progress row, flower tags |
| `lib/gardenStore.ts` | Garden state: intro stage, open letter, which letters have been read |
| `lib/plants.ts`, `lib/plantStore.ts` | The shared garden: Supabase reads, uploads, realtime, passcode, where new plants grow |
| `components/garden/Fence.tsx` | The fence and gate around the garden |
| `components/garden/Gardeners.tsx` | Zorrow and Skelly: their looks, pace, wandering, tending and the wave when tapped, their walk in from the cottage, and walking them yourself or live |
| `lib/presence.ts`, `lib/playerInput.ts` | The live garden: who you are, who's online, sending and replaying movement; keyboard and joystick input |
| `components/ui/PlayerControls.tsx`, `components/ui/WhoAreYou.tsx` | WASD/arrow keys and the touch joystick; the "Who are you?" question |
| `components/zones/registry.ts`, `lib/zones.ts` | The zones (garden, cottage interior): each one's scene, spawn points and exits, and which one is showing |
| `components/zones/HouseZone.tsx`, `lib/house.ts` | The cottage's interior and its layout |
| `components/zones/HouseKeepsakes.tsx`, `components/ui/Keepsakes.tsx` | The photo wall, notes board and letter shelf in the room, and the panels they open |
| `lib/keepsakes.ts`, `lib/notes.ts`, `lib/housePhotos.ts` | Which keepsake panel is open, opened letters and the photo wall's photos; the shared notes board; photos hung in the cottage |
| `components/ui/PartnerStatus.tsx`, `components/ui/ZoneFade.tsx` | Where the other person is; the fade when you go through a door |
| `components/garden/Cottage.tsx`, `lib/procession.ts` | The cottage outside the gate, its path, and the intro's walk and camera shots (runs after "Enter the garden"; there's a Skip intro link) |
| `components/garden/GardenerBody.tsx`, `lib/wander.ts` | How the gardeners are built from simple shapes, and where they're allowed to walk |
