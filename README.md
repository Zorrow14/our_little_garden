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
| `components/garden/Gardeners.tsx` | Zorrow and Skelly: their looks, pace, wandering, tending and the wave when tapped, and their walk in from the cottage |
| `components/garden/Cottage.tsx`, `lib/procession.ts` | The cottage outside the gate, its path, and the intro's walk and camera shots (runs after "Enter the garden"; there's a Skip intro link) |
| `components/garden/GardenerBody.tsx`, `lib/wander.ts` | How the gardeners are built from simple shapes, and where they're allowed to walk |
