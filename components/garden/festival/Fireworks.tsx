"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { Festival } from "@/lib/festivals";
import { type BurstRequest, type BurstStyle, fireworkQueue } from "@/lib/fireworks";
import { playBurst } from "@/lib/fireworkSound";
import { useGardenStore } from "@/lib/gardenStore";
import { groundHeight } from "@/lib/terrain";
import { boostLanterns, flashAt } from "./glow";
import { viewportHeight } from "./materials";

/**
 * Fireworks over the garden: each one a rising trail, then a burst of sparks
 * that slow, fall and fade. Every spark is a point in one pooled `Points`
 * cloud, simulated here and uploaded each frame: one draw call for all of
 * them. A few go up on their own now and then; the rest come from
 * `fireworkQueue` (yours, theirs, and the finale for lighting together).
 *
 * At most a few bursts at once and a fixed pool of sparks, both smaller on a
 * phone or a struggling device.
 */

const GRAVITY = 3.4;

interface Budget {
  particles: number;
  bursts: number;
  /** Share of each burst's usual sparks. */
  sparks: number;
}

function budget(low: boolean): Budget {
  return low ? { particles: 1100, bursts: 2, sparks: 0.55 } : { particles: 2600, bursts: 4, sparks: 1 };
}

interface Rocket {
  x: number;
  z: number;
  y0: number;
  apex: number;
  t: number;
  duration: number;
  style: BurstStyle;
  color: THREE.Color;
  big: boolean;
  boost: boolean;
  trail: number;
}

/** Sparks per burst, before the budget's share. */
const SPARKS: Record<BurstStyle, number> = { round: 120, ring: 90, willow: 100 };

class Pool {
  readonly count: number;
  readonly position: Float32Array;
  readonly color: Float32Array;
  readonly alpha: Float32Array;
  readonly size: Float32Array;
  private readonly velocity: Float32Array;
  private readonly base: Float32Array;
  private readonly age: Float32Array;
  private readonly life: Float32Array;
  private readonly drag: Float32Array;
  private readonly fall: Float32Array;
  private readonly twinkle: Float32Array;
  private readonly start: Float32Array;
  private cursor = 0;

  constructor(count: number) {
    this.count = count;
    this.position = new Float32Array(count * 3);
    this.color = new Float32Array(count * 3);
    this.alpha = new Float32Array(count);
    this.size = new Float32Array(count);
    this.velocity = new Float32Array(count * 3);
    this.base = new Float32Array(count * 3);
    this.age = new Float32Array(count).fill(1);
    this.life = new Float32Array(count).fill(1);
    this.drag = new Float32Array(count);
    this.fall = new Float32Array(count);
    this.twinkle = new Float32Array(count);
    this.start = new Float32Array(count);
  }

  /** Takes the next slot (the oldest spark, if the pool's full). */
  spawn(p: THREE.Vector3, v: THREE.Vector3, color: THREE.Color, life: number, size: number, drag: number, fall: number, twinkle = 0) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.count;
    p.toArray(this.position, i * 3);
    v.toArray(this.velocity, i * 3);
    color.toArray(this.base, i * 3);
    this.age[i] = 0;
    this.life[i] = life;
    this.start[i] = size;
    this.drag[i] = drag;
    this.fall[i] = fall;
    this.twinkle[i] = twinkle;
  }

  step(dt: number, t: number) {
    for (let i = 0; i < this.count; i++) {
      if (this.age[i] >= this.life[i]) {
        this.alpha[i] = 0;
        continue;
      }
      this.age[i] += dt;
      const k = i * 3;
      const slow = Math.exp(-this.drag[i] * dt);
      this.velocity[k] *= slow;
      this.velocity[k + 1] = this.velocity[k + 1] * slow - GRAVITY * this.fall[i] * dt;
      this.velocity[k + 2] *= slow;
      this.position[k] += this.velocity[k] * dt;
      this.position[k + 1] += this.velocity[k + 1] * dt;
      this.position[k + 2] += this.velocity[k + 2] * dt;
      const left = Math.max(0, 1 - this.age[i] / this.life[i]);
      const sparkle = this.twinkle[i] > 0 ? 0.55 + 0.45 * Math.sin(t * 28 + i * 1.7) : 1;
      this.alpha[i] = left ** 1.4 * sparkle;
      this.size[i] = this.start[i] * (0.45 + 0.55 * left);
      // Hot white when fresh, cooling to its colour.
      const hot = Math.max(0, 1 - this.age[i] * 3);
      for (let c = 0; c < 3; c++) this.color[k + c] = this.base[k + c] + (1 - this.base[k + c]) * hot * 0.7;
    }
  }
}

const scratch = { p: new THREE.Vector3(), v: new THREE.Vector3(), white: new THREE.Color("#fff6e6"), trail: new THREE.Color("#ffcf8a") };
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);

/** Sparks for one burst, by style. */
function burst(pool: Pool, r: Rocket, share: number) {
  const { p, v } = scratch;
  const count = Math.round(SPARKS[r.style] * share * (r.big ? 1.4 : 1));
  const speed = (r.big ? 5.2 : 4) * (r.style === "willow" ? 0.75 : 1);
  // A ring lies in a plane tipped toward you a little, at a random turn.
  const tipX = (Math.random() - 0.5) * 1.1;
  const turn = Math.random() * Math.PI;
  for (let i = 0; i < count; i++) {
    p.set(r.x, r.apex, r.z);
    if (r.style === "ring") {
      const a = (i / count) * Math.PI * 2;
      v.set(Math.cos(a), 0, Math.sin(a)).applyAxisAngle(X_AXIS, Math.PI / 2 + tipX).applyAxisAngle(Y_AXIS, turn);
      v.multiplyScalar(speed * (0.96 + Math.random() * 0.08));
    } else {
      // Evenly over a sphere, the speeds a little uneven so it isn't a hard shell.
      const y = 1 - (2 * (i + 0.5)) / count;
      const ring = Math.sqrt(1 - y * y);
      const a = i * 2.39996;
      v.set(Math.cos(a) * ring, y, Math.sin(a) * ring).multiplyScalar(speed * (0.75 + Math.random() * 0.35));
    }
    const willow = r.style === "willow";
    const white = !willow && i % 9 === 0;
    pool.spawn(
      p,
      v,
      white ? scratch.white : r.color,
      willow ? 2.4 + Math.random() * 0.8 : 1.3 + Math.random() * 0.6,
      willow ? 0.24 : 0.28,
      willow ? 1.1 : 1.6,
      willow ? 0.55 : 0.3,
      willow || white ? 1 : 0,
    );
  }
}

function sparkMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uViewport: { value: 800 } },
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aAlpha;
      attribute float aSize;
      uniform float uViewport;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vec4 view = modelViewMatrix * vec4(position, 1.0);
        vColor = aColor;
        vAlpha = aAlpha;
        gl_PointSize = aAlpha > 0.0 ? min(aSize * projectionMatrix[1][1] * uViewport * 0.5 / -view.z, 48.0) : 0.0;
        gl_Position = projectionMatrix * view;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float core = smoothstep(1.0, 0.0, d);
        gl_FragColor = vec4(vColor * (core * core * 1.6) * vAlpha, 1.0);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

/** Seconds until the next firework that goes up on its own. */
const ambientGap = () => 20 + Math.random() * 20;

const ndc = new THREE.Vector3();
const ahead = new THREE.Vector3();

/**
 * How high a burst over (x, z) can go, up to `wanted`, and still be seen: the
 * garden's camera looks down on it, so there's little sky in view unless
 * you've turned it up. Room is left above for the sparks to spread.
 */
function fitApex(camera: THREE.Camera, x: number, z: number, ground: number, wanted: number) {
  for (let y = wanted; y > ground + 3; y -= 0.4) {
    ndc.set(x, y + 2, z).project(camera);
    if (ndc.z < 1 && ndc.y < 0.85) return y;
  }
  return ground + 3;
}

/** A burst must be at least this high above the ground to read as up in the sky, not down among the flowers. */
const SKY_HEIGHT = 6;

/**
 * Where a burst asked for over (x, z) should go up, and how high: as asked if
 * there's sky to see above it, otherwise moved back, away from the camera,
 * until there is. From a view looking down on the garden that puts it
 * beyond, in the sky over the trees.
 */
function placeBurst(camera: THREE.Camera, x: number, z: number, wanted: number) {
  const away = { x: x - camera.position.x, z: z - camera.position.z };
  const length = Math.hypot(away.x, away.z) || 1;
  away.x /= length;
  away.z /= length;
  for (let back = 0; back <= 18; back += 2) {
    const px = Math.max(-28, Math.min(28, x + away.x * back));
    const pz = Math.max(-28, Math.min(28, z + away.z * back));
    const ground = groundHeight(px, pz);
    const apex = fitApex(camera, px, pz, ground, ground + wanted);
    if (apex - ground >= SKY_HEIGHT || back === 18) return { x: px, z: pz, ground, apex };
  }
  return { x, z, ground: groundHeight(x, z), apex: groundHeight(x, z) + wanted };
}

/** Somewhere ahead of the camera, out over the garden or beyond it, for a firework that goes up on its own. */
function inView(camera: THREE.Camera) {
  camera.getWorldDirection(ahead);
  ahead.y = 0;
  ahead.normalize();
  const d = 10 + Math.random() * 10;
  const side = (Math.random() - 0.5) * 12;
  const clamp = (v: number) => Math.max(-24, Math.min(24, v));
  return { x: clamp(camera.position.x + ahead.x * d - ahead.z * side), z: clamp(camera.position.z + ahead.z * d + ahead.x * side) };
}

export default function Fireworks({ festival }: { festival: Festival }) {
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const quality = useGardenStore((s) => s.quality);
  const low = useMemo(() => quality === "low" || window.matchMedia("(pointer: coarse)").matches, [quality]);
  const limits = useMemo(() => budget(low), [low]);
  const colors = useMemo(() => festival.theme.glow.map((c) => new THREE.Color(c)), [festival]);

  const { pool, geometry, material } = useMemo(() => {
    const pool = new Pool(limits.particles);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(pool.position, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute("aColor", new THREE.BufferAttribute(pool.color, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute("aAlpha", new THREE.BufferAttribute(pool.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(pool.size, 1).setUsage(THREE.DynamicDrawUsage));
    return { pool, geometry, material: sparkMaterial() };
  }, [limits]);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  useEffect(() => {
    material.uniforms.uViewport.value = viewportHeight(gl);
  }, [gl, size, material]);

  const state = useMemo(
    () => ({ rockets: [] as Rocket[], waiting: [] as BurstRequest[], ringing: [] as number[], ambient: 6 + Math.random() * 6 }),
    [],
  );
  // Anything asked for before the scene was here (in another zone, say) is stale.
  useEffect(() => {
    fireworkQueue.length = 0;
  }, []);

  useFrame(({ camera, clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = clock.elapsedTime;

    // Now and then, one goes up on its own somewhere over the garden.
    state.ambient -= dt;
    if (state.ambient <= 0) {
      state.ambient = ambientGap();
      if (!document.hidden) {
        state.waiting.push({ ...inView(camera), style: Math.random() < 0.5 ? "round" : "willow", colorIndex: Math.floor(Math.random() * colors.length), big: false, delay: 0 });
      }
    }
    while (fireworkQueue.length > 0) state.waiting.push(fireworkQueue.shift()!);
    // Don't let a backlog build up while the tab was hidden.
    if (state.waiting.length > 12) state.waiting.splice(0, state.waiting.length - 12);

    state.ringing = state.ringing.filter((until) => until > t);
    for (let i = 0; i < state.waiting.length; i++) {
      const w = state.waiting[i];
      w.delay -= dt;
      if (w.delay > 0 || state.rockets.length + state.ringing.length >= limits.bursts) continue;
      state.waiting.splice(i--, 1);
      const x = w.x + (Math.random() - 0.5) * 0.6;
      const z = w.z + (Math.random() - 0.5) * 0.6;
      const height = w.big ? 9.5 + Math.random() * 2.5 : 7.5 + Math.random() * 1.5;
      // One you're watching (the camera's looking up) goes to its full height; any other is fitted into the sky in view.
      const spot = w.watched ? { x, z, ground: groundHeight(x, z), apex: groundHeight(x, z) + height } : placeBurst(camera, x, z, height);
      state.rockets.push({
        x: spot.x,
        z: spot.z,
        y0: spot.ground,
        apex: spot.apex,
        t: 0,
        duration: w.big ? 1.5 : 1.2,
        style: w.style,
        color: colors[Math.abs(w.colorIndex) % colors.length],
        big: w.big,
        boost: !!w.boost,
        trail: 0,
      });
    }

    // Rockets rise, easing as they near the top, leaving a short trail of sparks.
    for (let i = 0; i < state.rockets.length; i++) {
      const r = state.rockets[i];
      r.t += dt;
      const k = Math.min(1, r.t / r.duration);
      const y = r.y0 + (r.apex - r.y0) * (1 - (1 - k) * (1 - k));
      r.trail += dt;
      while (r.trail > 0.018) {
        r.trail -= 0.018;
        scratch.p.set(r.x + (Math.random() - 0.5) * 0.04, y, r.z + (Math.random() - 0.5) * 0.04);
        scratch.v.set((Math.random() - 0.5) * 0.3, -0.6 - Math.random() * 0.4, (Math.random() - 0.5) * 0.3);
        pool.spawn(scratch.p, scratch.v, scratch.trail, 0.45 + Math.random() * 0.25, 0.12, 2, 0.4);
      }
      if (k >= 1) {
        burst(pool, r, limits.sparks);
        const at = new THREE.Vector3(r.x, r.apex, r.z);
        flashAt(at, r.big ? 1 : 0.6);
        if (r.boost) boostLanterns(1);
        playBurst(camera.position.distanceTo(at), r.big);
        state.ringing.push(t + (r.style === "willow" ? 2.6 : 1.7));
        state.rockets.splice(i--, 1);
      }
    }

    pool.step(dt, t);
    for (const name of ["position", "aColor", "aAlpha", "aSize"]) (geometry.attributes[name] as THREE.BufferAttribute).needsUpdate = true;
  });

  return <points geometry={geometry} material={material} frustumCulled={false} />;
}
