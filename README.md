# Our Little Garden

An interactive 3D garden where each flower opens an "open when…" letter.

Built with Next.js 15, React 19, TypeScript, Tailwind CSS, React Three Fiber + drei, GSAP and Framer Motion.

## Development

```bash
npm install
npm run dev
```

Then open http://localhost:3000. To test on a phone, run `npm run dev -- -H 0.0.0.0` and open `http://<your-computer's-LAN-IP>:3000` on a phone on the same Wi-Fi.

## Where things live

| Path | What |
| --- | --- |
| `data/memories.ts` | Letter text, labels and optional photo/audio for each flower |
| `public/images/personal/` | Letter photos (gitignored) |
| `public/audio/personal/` | Letter audio (gitignored) |
| `components/garden/` | 3D scene components |
| `lib/gsap.ts` | GSAP setup; import `gsap`/`useGSAP` from here |
