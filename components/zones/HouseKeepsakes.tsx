"use client";

import { useCursor } from "@react-three/drei";
import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useGardenStore } from "@/lib/gardenStore";
import { FURNITURE, HOUSE_WINDOW, ROOM } from "@/lib/house";
import { type Keepsake, openKeepsake, useKeepsakes, useOpenedLetters, useWallPhotos } from "@/lib/keepsakes";
import { type Note, useNotes } from "@/lib/notes";
import { getGlowTexture } from "@/lib/textures";
import { useZone } from "@/lib/zones";

/**
 * The cottage's keepsakes, built into the room: photos hung above the bed, a
 * corkboard of notes by the door, and the bookshelf that keeps every opened
 * letter. Each glows faintly, and warmly on hover, to say it can be clicked.
 */

const WARM = "#ffd9a0";
const NO_RAYCAST = () => null;

/** Whether the room's objects can be clicked right now. */
function useCanTouch() {
  const free = useGardenStore((s) => s.stage === "garden" && !s.activeId && !s.celebrating);
  const panelClosed = useKeepsakes((s) => s.open === null);
  const settled = useZone((s) => s.leaving === null);
  return free && panelClosed && settled;
}

/**
 * Wraps a keepsake: a halo on the wall behind it that breathes faintly. On
 * hover the halo brightens, a soft light comes up in front of the object, and
 * it lifts a touch, like the flowers in the garden.
 */
export function KeepsakeObject({
  which,
  halo,
  light,
  children,
}: {
  which: Keepsake;
  /** The halo's centre, size and turn, in the same space as the children. */
  halo: { position: [number, number, number]; size: [number, number]; turn?: number };
  /** Where the hover light shines from: a little out in front of the object. */
  light: [number, number, number];
  children: ReactNode;
}) {
  const canTouch = useCanTouch();
  const [hovered, setHovered] = useState(false);
  useCursor(hovered && canTouch);
  const glow = useRef<THREE.MeshBasicMaterial>(null!);
  const lift = useRef<THREE.Group>(null!);
  const lamp = useRef<THREE.PointLight>(null!);
  const level = useRef(0);
  const phase = useMemo(() => Math.random() * Math.PI * 2, []);

  useFrame(({ clock }, delta) => {
    level.current = THREE.MathUtils.damp(level.current, hovered && canTouch ? 1 : 0, 8, delta);
    const breathe = (Math.sin(clock.elapsedTime * 1.4 + phase) + 1) / 2;
    glow.current.opacity = 0.08 + breathe * 0.07 + level.current * 0.6;
    lamp.current.intensity = level.current * 2.6;
    lift.current.scale.setScalar(1 + level.current * 0.025);
  });

  const select = (e: ThreeEvent<MouseEvent>) => {
    if (!canTouch || e.delta > 8) return;
    e.stopPropagation();
    openKeepsake(which);
  };

  return (
    <group
      onPointerOver={(e) => {
        if (!canTouch) return;
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
      onClick={select}
    >
      <mesh position={halo.position} rotation-y={halo.turn ?? 0} raycast={NO_RAYCAST}>
        <planeGeometry args={halo.size} />
        <meshBasicMaterial
          ref={glow}
          map={getGlowTexture()}
          color={WARM}
          transparent
          opacity={0.1}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <pointLight ref={lamp} position={light} color="#ffe2b0" intensity={0} distance={2.6} decay={1.4} />
      <group ref={lift} position={halo.position}>
        <group position={[-halo.position[0], -halo.position[1], -halo.position[2]]}>{children}</group>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// The photo wall, above the bed.

const WALL_Z = -ROOM.halfDepth;
/** Frames in a little collage: centre, size, tilt. */
const FRAMES: { x: number; y: number; w: number; h: number; tilt: number; frame: string }[] = [
  { x: 2.15, y: 1.62, w: 0.5, h: 0.4, tilt: 0, frame: "#6b4630" },
  { x: 1.66, y: 1.86, w: 0.28, h: 0.3, tilt: 0.05, frame: "#f3ece0" },
  { x: 1.68, y: 1.4, w: 0.32, h: 0.24, tilt: -0.04, frame: "#9a6a47" },
  { x: 2.64, y: 1.88, w: 0.3, h: 0.24, tilt: -0.05, frame: "#f3ece0" },
  { x: 2.62, y: 1.43, w: 0.26, h: 0.3, tilt: 0.04, frame: "#6b4630" },
];
const EMPTY_TINTS = ["#e8dccb", "#efe1e6", "#e0e6dc", "#e9e3f0", "#f1e6cf"];

export function PhotoWall() {
  const photos = useWallPhotos();
  return (
    <KeepsakeObject which="photos" halo={{ position: [2.15, 1.65, WALL_Z + 0.01], size: [2.1, 1.5] }} light={[2.15, 1.7, WALL_Z + 0.75]}>
      {FRAMES.map((f, i) => (
        <Frame key={i} {...f} src={photos[i]?.src ?? null} tint={EMPTY_TINTS[i]} />
      ))}
      <FairyLights />
    </KeepsakeObject>
  );
}

function Frame({ x, y, w, h, tilt, frame, src, tint }: (typeof FRAMES)[number] & { src: string | null; tint: string }) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    if (!src) {
      setTexture(null);
      return;
    }
    let cancelled = false;
    let loaded: THREE.Texture | null = null;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(
      src,
      (t) => {
        if (cancelled) {
          t.dispose();
          return;
        }
        // Fill the frame like `object-fit: cover`.
        const image = t.image as { width: number; height: number };
        const photoAspect = image.width / image.height;
        const frameAspect = w / h;
        if (photoAspect > frameAspect) {
          t.repeat.set(frameAspect / photoAspect, 1);
          t.offset.set((1 - t.repeat.x) / 2, 0);
        } else {
          t.repeat.set(1, photoAspect / frameAspect);
          t.offset.set(0, (1 - t.repeat.y) / 2);
        }
        t.colorSpace = THREE.SRGBColorSpace;
        loaded = t;
        setTexture(t);
      },
      undefined,
      () => !cancelled && setTexture(null),
    );
    return () => {
      cancelled = true;
      loaded?.dispose();
    };
  }, [src, w, h]);

  return (
    <group position={[x, y, WALL_Z + 0.03]} rotation-z={tilt}>
      <mesh>
        <boxGeometry args={[w + 0.06, h + 0.06, 0.035]} />
        <meshLambertMaterial color={frame} flatShading />
      </mesh>
      <mesh position-z={0.019}>
        <planeGeometry args={[w, h]} />
        {texture ? <meshLambertMaterial key="photo" map={texture} /> : <meshLambertMaterial key="empty" color={tint} />}
      </mesh>
      {!texture && (
        // A pressed flower waiting for a photo.
        <mesh position={[0, 0, 0.022]} rotation-z={0.4}>
          <circleGeometry args={[Math.min(w, h) * 0.16, 5]} />
          <meshLambertMaterial color="#d9a3b4" />
        </mesh>
      )}
    </group>
  );
}

/** A string of little warm lights draped above the photos. */
function FairyLights() {
  const bulbs = useMemo(
    () =>
      Array.from({ length: 11 }, (_, i) => {
        const u = i / 10;
        return { x: 1.25 + u * 1.85, y: 2.2 - Math.sin(u * Math.PI) * 0.16 - ((i * 7) % 3) * 0.008 };
      }),
    [],
  );
  const sprites = useRef<THREE.SpriteMaterial[]>([]);
  useFrame(({ clock }) => {
    sprites.current.forEach((m, i) => {
      if (m) m.opacity = 0.55 + Math.sin(clock.elapsedTime * 1.7 + i * 1.3) * 0.2;
    });
  });
  return (
    <group>
      {bulbs.map((b, i) => (
        <group key={i} position={[b.x, b.y, WALL_Z + 0.06]}>
          <mesh raycast={NO_RAYCAST}>
            <sphereGeometry args={[0.022, 6, 5]} />
            <meshBasicMaterial color="#ffe2a8" />
          </mesh>
          <sprite scale={0.2} raycast={NO_RAYCAST}>
            <spriteMaterial
              ref={(m) => {
                if (m) sprites.current[i] = m;
              }}
              map={getGlowTexture()}
              color="#ffcf80"
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </sprite>
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// The notes board, on the left wall between the plant and the door.

const BOARD = { z: -0.78, y: 1.32, width: 1.35, height: 0.88 };
const MAX_CARDS = 12;

/** Faint pencil lines, so a card reads as written on without being legible from across the room. */
function useScribbleTexture() {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 64, 64);
    ctx.strokeStyle = "rgba(60, 64, 110, 0.55)";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    for (const [y, length] of [[22, 46], [33, 40], [44, 30]]) {
      ctx.beginPath();
      ctx.moveTo(10, y);
      for (let x = 10; x < 10 + length; x += 6) ctx.lineTo(x + 3, y + (x % 12 ? -1.5 : 1.5));
      ctx.stroke();
    }
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

function cardLook(note: Note, i: number) {
  let h = 0;
  for (const c of note.id) h = (h * 31 + c.charCodeAt(0)) | 0;
  const cols = 4;
  const col = i % cols;
  const row = Math.floor(i / cols);
  return {
    x: -BOARD.width / 2 + 0.2 + col * ((BOARD.width - 0.4) / (cols - 1)) + ((h % 5) - 2) * 0.012,
    y: BOARD.height / 2 - 0.17 - row * 0.27 + ((h >> 4) % 3) * 0.01,
    tilt: ((h % 9) - 4) * 0.035,
    paper: ["#fffaf0", "#fdf3c8", "#f7e4ec", "#e7f1e2"][Math.abs(h >> 3) % 4],
    pin: ["#d9728f", "#e3b04b", "#6f9fd8", "#7fb07a"][Math.abs(h) % 4],
  };
}

export function NotesBoard() {
  const notes = useNotes((s) => s.notes);
  const scribble = useScribbleTexture();
  const shown = notes.slice(-MAX_CARDS).reverse();
  const x = -ROOM.halfWidth;

  return (
    <KeepsakeObject
      which="notes"
      halo={{ position: [x + 0.01, BOARD.y, BOARD.z], size: [BOARD.width + 0.8, BOARD.height + 0.7], turn: Math.PI / 2 }}
      light={[x + 0.75, BOARD.y, BOARD.z]}
    >
      {/* In the wall's own space: x along the wall (toward the back), y up, z out into the room. */}
      <group position={[x + 0.02, BOARD.y, BOARD.z]} rotation-y={Math.PI / 2}>
        <mesh>
          <boxGeometry args={[BOARD.width + 0.08, BOARD.height + 0.08, 0.04]} />
          <meshLambertMaterial color="#6e4c36" flatShading />
        </mesh>
        <mesh position-z={0.021}>
          <planeGeometry args={[BOARD.width, BOARD.height]} />
          <meshLambertMaterial color="#b78a5f" />
        </mesh>
        {shown.map((note, i) => {
          const card = cardLook(note, i);
          return (
            <group key={note.id} position={[card.x, card.y, 0.026]} rotation-z={card.tilt}>
              <mesh>
                <planeGeometry args={[0.24, 0.2]} />
                <meshLambertMaterial color={card.paper} map={scribble} />
              </mesh>
              <mesh position={[0, 0.075, 0.012]}>
                <sphereGeometry args={[0.018, 6, 5]} />
                <meshLambertMaterial color={card.pin} />
              </mesh>
            </group>
          );
        })}
      </group>
    </KeepsakeObject>
  );
}

// ---------------------------------------------------------------------------
// The bookshelf: the letter archive. Opened letters stack up on top, tied with ribbon.

export function ArchiveShelf({ children }: { children: ReactNode }) {
  const letters = useOpenedLetters();
  const { shelf } = FURNITURE;
  const stack = Math.min(letters.length, 9);
  return (
    <KeepsakeObject
      which="archive"
      halo={{ position: [shelf.x, 0.95, -ROOM.halfDepth + 0.01], size: [1.9, 2.3] }}
      light={[shelf.x, 1.05, shelf.z + 0.8]}
    >
      {children}
      {/* The opened letters, stacked on the top of the shelf. */}
      <group position={[shelf.x + 0.15, 1.62, shelf.z + 0.01]} rotation-y={0.12}>
        {Array.from({ length: stack }, (_, i) => (
          <mesh key={i} position={[((i * 37) % 5) * 0.006 - 0.012, i * 0.018 + 0.009, 0]} rotation-y={((i * 53) % 7) * 0.03 - 0.09}>
            <boxGeometry args={[0.3, 0.014, 0.21]} />
            <meshLambertMaterial color={i % 3 === 2 ? "#f7e4ec" : "#fbf6ec"} />
          </mesh>
        ))}
        {stack > 0 && (
          <mesh position={[0, stack * 0.009 + 0.009, 0]}>
            <boxGeometry args={[0.035, stack * 0.018 + 0.02, 0.215]} />
            <meshLambertMaterial color="#d9728f" />
          </mesh>
        )}
      </group>
    </KeepsakeObject>
  );
}

// ---------------------------------------------------------------------------
// The view out of the window, and moonlight coming through it.

/** The garden at night as seen through the window: sky, moon, the fence, trees and glowing flowers. */
export function useWindowViewTexture() {
  const texture = useMemo(() => {
    const W = 512;
    const H = 440;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    let seed = 11;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.7);
    sky.addColorStop(0, "#0b1230");
    sky.addColorStop(1, "#2a3570");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = `rgba(235, 238, 255, ${0.3 + rand() * 0.6})`;
      ctx.fillRect(rand() * W, rand() * H * 0.55, 1.6, 1.6);
    }
    // The moon, top right, with a soft halo.
    const halo = ctx.createRadialGradient(380, 92, 10, 380, 92, 110);
    halo.addColorStop(0, "rgba(220, 228, 255, 0.45)");
    halo.addColorStop(1, "rgba(220, 228, 255, 0)");
    ctx.fillStyle = halo;
    ctx.fillRect(250, 0, 262, 230);
    ctx.fillStyle = "#f1f0ff";
    ctx.beginPath();
    ctx.arc(380, 92, 30, 0, Math.PI * 2);
    ctx.fill();

    // Far hills, then tree tops along them, in low-poly facets.
    const hills = (base: number, color: string, step: number, rise: number) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let x = 0; x <= W + step; x += step) ctx.lineTo(x, base - rand() * rise);
      ctx.lineTo(W, H);
      ctx.fill();
    };
    hills(H * 0.62, "#1a2a3c", 64, 40);
    ctx.fillStyle = "#13221f";
    for (let i = 0; i < 9; i++) {
      const x = rand() * W;
      const y = H * 0.62 - rand() * 20;
      const s = 26 + rand() * 30;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.6, y + 6);
      ctx.lineTo(x, y - s * 1.4);
      ctx.lineTo(x + s * 0.6, y + 6);
      ctx.fill();
    }
    hills(H * 0.72, "#18302a", 48, 18);

    // The garden fence.
    ctx.fillStyle = "#2a1f1a";
    const fenceY = H * 0.75;
    for (let x = 14; x < W; x += 58) ctx.fillRect(x, fenceY - 30, 7, 46);
    ctx.fillRect(0, fenceY - 22, W, 5);
    ctx.fillRect(0, fenceY - 6, W, 5);

    // Grass in front, and the flowers glowing in it.
    hills(H * 0.86, "#1f3a2c", 40, 10);
    const glows = ["#ffd38a", "#f4a6c4", "#a8c8ff", "#fff1c2", "#e48aa8"];
    for (let i = 0; i < 9; i++) {
      const x = 30 + rand() * (W - 60);
      const y = H * 0.8 + rand() * H * 0.16;
      const color = glows[i % glows.length];
      const g = ctx.createRadialGradient(x, y, 0, x, y, 16);
      g.addColorStop(0, color);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - 16, y - 16, 32, 32);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }

    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

/** Where the moonlight falls: from the window, down across the floor in front of it. */
const BEAM = {
  top: { x: HOUSE_WINDOW.x, y: HOUSE_WINDOW.y, z: -ROOM.halfDepth + 0.05 },
  bottom: { x: HOUSE_WINDOW.x + 0.15, y: 0.02, z: -ROOM.halfDepth + 1.4 },
};
const MOTES = 70;

/** A faint shaft of moonlight from the window, with dust drifting in it. */
export function MoonBeam() {
  const geometry = useMemo(() => {
    const { top, bottom } = BEAM;
    const halfTop = HOUSE_WINDOW.width / 2;
    const halfBottom = halfTop + 0.2;
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [
          top.x - halfTop, top.y + HOUSE_WINDOW.height / 2, top.z,
          top.x + halfTop, top.y + HOUSE_WINDOW.height / 2, top.z,
          bottom.x + halfBottom, bottom.y, bottom.z,
          bottom.x - halfBottom, bottom.y, bottom.z,
        ],
        3,
      ),
    );
    // Brightest at the window, fading to nothing at the floor.
    g.setAttribute("alpha", new THREE.Float32BufferAttribute([1, 1, 0, 0], 1));
    g.setIndex([0, 3, 2, 0, 2, 1]);
    return g;
  }, []);
  const beamMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: { uColor: { value: new THREE.Color("#9fb2ff") }, uStrength: { value: 0.09 } },
        vertexShader: `attribute float alpha; varying float vAlpha; void main() { vAlpha = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform vec3 uColor; uniform float uStrength; varying float vAlpha; void main() { gl_FragColor = vec4(uColor * uStrength * vAlpha * vAlpha, 1.0); }`,
      }),
    [],
  );

  const motes = useMemo(
    () =>
      Array.from({ length: MOTES }, () => ({
        u: Math.random(),
        across: (Math.random() - 0.5) * 0.9,
        lift: (Math.random() - 0.5) * 0.25,
        speed: 0.012 + Math.random() * 0.02,
        sway: Math.random() * Math.PI * 2,
      })),
    [],
  );
  const points = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(MOTES * 3), 3));
    return g;
  }, []);
  const pointsMaterial = useMemo(
    () =>
      new THREE.PointsMaterial({
        map: getGlowTexture(),
        color: "#dfe6ff",
        size: 0.05,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );
  useEffect(
    () => () => {
      geometry.dispose();
      beamMaterial.dispose();
      points.dispose();
      pointsMaterial.dispose();
    },
    [geometry, beamMaterial, points, pointsMaterial],
  );

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    const attr = points.getAttribute("position") as THREE.BufferAttribute;
    const { top, bottom } = BEAM;
    motes.forEach((m, i) => {
      // Drift slowly down the beam, looping back to the window.
      m.u = (m.u + m.speed * Math.min(delta, 0.1)) % 1;
      const x = THREE.MathUtils.lerp(top.x, bottom.x, m.u) + m.across * (0.5 + m.u * 0.3) + Math.sin(t * 0.4 + m.sway) * 0.05;
      const y = THREE.MathUtils.lerp(top.y, bottom.y + 0.15, m.u) + m.lift + Math.sin(t * 0.6 + m.sway * 2) * 0.04;
      const z = THREE.MathUtils.lerp(top.z + 0.1, bottom.z, m.u) + Math.cos(t * 0.3 + m.sway) * 0.05;
      attr.setXYZ(i, x, y, z);
    });
    attr.needsUpdate = true;
  });

  return (
    <>
      <mesh geometry={geometry} material={beamMaterial} raycast={NO_RAYCAST} />
      <points geometry={points} material={pointsMaterial} raycast={NO_RAYCAST} frustumCulled={false} />
    </>
  );
}
