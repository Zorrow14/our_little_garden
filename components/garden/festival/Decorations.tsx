"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { COTTAGE_ROOF, cottageToWorld } from "@/components/garden/Cottage";
import { fenceLayout } from "@/components/garden/Fence";
import { RAIL_HEIGHT, RAIL_X } from "@/components/garden/props/Bridge";
import { GARDEN_RING, ringTrees } from "@/components/garden/Trees";
import { deckAt } from "@/lib/bridge";
import type { Festival } from "@/lib/festivals";
import { toWorld } from "@/lib/frame";
import { distanceToFlowers, FENCE, PATH_CURVE } from "@/lib/layout";
import { AT_GATE, COTTAGE, OFF_DOORSTEP, onProcession } from "@/lib/procession";
import { distanceToProps, GARDEN_BRIDGE, GARDEN_BRIDGE_PATH } from "@/lib/props";
import { createRandom, distanceToPond, groundHeight, POND } from "@/lib/terrain";
import { festivalGlow } from "./glow";
import { glowMaterial, type Halo, haloGeometry, haloMaterial, setGlowAttributes, viewportHeight } from "./materials";

/**
 * The garden dressed for a festival: strings of lights along the fence, round
 * the cottage's eaves and down the bridge's handrails; paper lanterns hanging
 * along the fence, under both gateways, at the cottage and in a few of the
 * trees; candles lining the paths; and the cottage's windows glowing. All of
 * it is a handful of instanced meshes and one set of halos, with no real
 * lights, so it costs little on a phone.
 */

interface Lantern {
  at: THREE.Vector3;
  /** Where its string is tied, above it. */
  from: THREE.Vector3;
  color: THREE.Color;
  seed: number;
}

interface Layout {
  bulbs: { at: THREE.Vector3; color: THREE.Color; seed: number }[];
  lanterns: Lantern[];
  candles: { at: THREE.Vector3; height: number; seed: number }[];
  halos: Halo[];
  /** Pairs of points: the wires the bulbs and lanterns hang from. */
  wires: THREE.Vector3[];
}

/** Points along a sagging wire from `a` to `b`, `count` of them, not including the ends. */
function sagging(a: THREE.Vector3, b: THREE.Vector3, sag: number, count: number) {
  return Array.from({ length: count }, (_, i) => {
    const t = (i + 1) / (count + 1);
    return a.clone().lerp(b, t).setY(THREE.MathUtils.lerp(a.y, b.y, t) - sag * 4 * t * (1 - t));
  });
}

/** A wire as line segments through `points`. */
function wireThrough(points: THREE.Vector3[], wires: THREE.Vector3[]) {
  for (let i = 0; i < points.length - 1; i++) wires.push(points[i], points[i + 1]);
}

function layout(festival: Festival): Layout {
  const rand = createRandom(97);
  const glow = festival.theme.glow.map((c) => new THREE.Color(c));
  // Bulbs mostly warm golds and ambers, now and then a pink one.
  const bulbColor = () => glow[rand() < 0.85 ? Math.floor(rand() * 4) : 4];
  const lanternColor = () => glow[Math.floor(rand() * 3)];
  const out: Layout = { bulbs: [], lanterns: [], candles: [], halos: [], wires: [] };

  const bulbs = (points: THREE.Vector3[]) => {
    for (const at of points) out.bulbs.push({ at, color: bulbColor(), seed: rand() });
  };
  const lantern = (at: THREE.Vector3, string = 0.3, color = lanternColor()) => {
    const from = at.clone().setY(at.y + string);
    const seed = rand();
    out.lanterns.push({ at, from, color, seed });
    out.wires.push(from, at.clone().setY(at.y + 0.12));
    out.halos.push({ at, color, size: 0.9, seed });
  };

  // ---- Along the fence: a wire from post to post, sagging between them, with a lantern every few spans.
  const posts = fenceLayout().posts;
  let span = 0;
  for (let i = 0; i < posts.length - 1; i++) {
    const p = posts[i];
    const q = posts[i + 1];
    if (!p || !q) continue;
    const a = new THREE.Vector3(p.x, p.top + 0.02, p.z);
    const b = new THREE.Vector3(q.x, q.top + 0.02, q.z);
    const points = sagging(a, b, 0.1, 5);
    wireThrough([a, ...points, b], out.wires);
    bulbs(points);
    if (span++ % 3 === 1) lantern(points[2].clone().setY(points[2].y - 0.3), 0.3);
  }
  // ---- Under each gateway's crossbeam (the gate, and the way out to the bridge): two lanterns.
  const tall = posts.filter((p): p is NonNullable<typeof p> => !!p && p.tall);
  const gateways: [NonNullable<(typeof posts)[number]>, NonNullable<(typeof posts)[number]>][] = [];
  const first = posts[0];
  const last = posts[posts.length - 1];
  if (first && last) gateways.push([last, first]);
  const bridgeSide = tall.filter((p) => p !== first && p !== last);
  if (bridgeSide.length === 2) gateways.push([bridgeSide[0], bridgeSide[1]]);
  for (const [l, r] of gateways) {
    const beam = Math.max(l.top, r.top) - 0.04;
    for (const t of [0.3, 0.7]) lantern(new THREE.Vector3(THREE.MathUtils.lerp(l.x, r.x, t), beam - 0.42, THREE.MathUtils.lerp(l.z, r.z, t)), 0.38);
  }

  // ---- The cottage: lights along the front and back eaves and up each gable's edge, lanterns at the front corners, glowing windows.
  const { width: W, depth: D, wallHeight: H, floorY } = COTTAGE;
  const { pitch, eave, rise } = COTTAGE_ROOF;
  const eaveY = H - eave * Math.tan(pitch) - 0.03;
  const local = (x: number, y: number, z: number) => {
    const w = cottageToWorld(x, z);
    return new THREE.Vector3(w.x, floorY + y, w.z);
  };
  for (const side of [1, -1]) {
    const z = side * (D / 2 + eave + 0.01);
    const a = local(-W / 2 - 0.12, eaveY, z);
    const b = local(W / 2 + 0.12, eaveY, z);
    const points = sagging(a, b, 0.07, 11);
    wireThrough([a, ...points, b], out.wires);
    bulbs(points);
  }
  for (const x of [-W / 2 - 0.16, W / 2 + 0.16]) {
    for (const side of [1, -1]) {
      const line = Array.from({ length: 6 }, (_, i) => {
        const t = (i + 0.5) / 6;
        return local(x, THREE.MathUtils.lerp(eaveY, H + rise, t), side * (D / 2 + eave) * (1 - t));
      });
      bulbs(line);
    }
  }
  for (const x of [-W / 2 + 0.05, W / 2 - 0.05]) lantern(local(x, eaveY - 0.32, D / 2 + eave - 0.06), 0.28);
  const side = (W - COTTAGE.doorWidth) / 2;
  const windows: [number, number, number, number, number][] = [
    [-(COTTAGE.doorWidth / 2 + side / 2), 0.82, D / 2, 0, 1],
    [COTTAGE.doorWidth / 2 + side / 2, 0.82, D / 2, 0, 1],
    [W / 2, 0.82, 0, 1, 0],
    [-W / 2, 0.82, 0, -1, 0],
    [0, 0.82, -D / 2, 0, -1],
  ];
  for (const [x, y, z, nx, nz] of windows) {
    out.halos.push({ at: local(x + nx * 0.12, y, z + nz * 0.12), color: glow[1], size: 1.1, seed: rand() });
  }

  // ---- The bridge: lights along both handrails.
  const b = GARDEN_BRIDGE;
  for (const s of [-1, 1]) {
    const points: THREE.Vector3[] = [];
    for (let z = 0.15; z < b.length - 0.1; z += 0.24) {
      const w = toWorld(b, s * RAIL_X, z);
      points.push(new THREE.Vector3(w.x, deckAt(b, z) + RAIL_HEIGHT + 0.04, w.z));
    }
    bulbs(points);
  }

  // ---- A few trees at the back of the garden, each with lanterns hung from its lower branches.
  const trees = ringTrees(GARDEN_RING)
    .map((t) => ({ ...t, angle: Math.atan2(t.z - FENCE.z, t.x - FENCE.x), distance: Math.hypot(t.x - FENCE.x, t.z - FENCE.z) }))
    .filter((t) => t.z < FENCE.z - 4)
    .sort((p, q) => p.distance - q.distance);
  const chosen: typeof trees = [];
  for (const t of trees) {
    if (chosen.length >= 5) break;
    if (chosen.every((c) => Math.abs(Math.atan2(Math.sin(c.angle - t.angle), Math.cos(c.angle - t.angle))) > 0.42)) chosen.push(t);
  }
  for (const t of chosen) {
    const inward = new THREE.Vector2(FENCE.x - t.x, FENCE.z - t.z).normalize();
    const ground = groundHeight(t.x, t.z);
    for (const [along, across, drop] of [
      [0.75, -0.5, 0.0],
      [0.9, 0.35, 0.25],
      [0.55, 0.0, 0.45],
    ]) {
      const x = t.x + inward.x * along * t.scale - inward.y * across * t.scale;
      const z = t.z + inward.y * along * t.scale + inward.x * across * t.scale;
      lantern(new THREE.Vector3(x, ground + 1.7 * t.scale - drop, z), 0.35 + drop);
    }
  }

  // ---- Candles lining the paths, either side, kept out of the water, the flowers and the props.
  const candle = (x: number, z: number) => {
    if (distanceToPond(x, z) < POND.radius + 0.3 || distanceToFlowers(x, z) < 0.6 || distanceToProps(x, z) < 0.25) return;
    const height = 0.1 + rand() * 0.08;
    const seed = rand();
    const at = new THREE.Vector3(x, groundHeight(x, z), z);
    out.candles.push({ at, height, seed });
    out.halos.push({ at: at.clone().setY(at.y + height + 0.05), color: glow[0], size: 0.55, seed });
  };
  const length = PATH_CURVE.getLength();
  for (let s = 0.4; s < length - 0.6; s += 1.15) {
    const u = s / length;
    const p = PATH_CURVE.getPointAt(u);
    const tangent = PATH_CURVE.getTangentAt(u);
    for (const sideways of [-0.62, 0.62]) candle(p.x - tangent.z * sideways, p.z + tangent.x * sideways);
  }
  for (let s = OFF_DOORSTEP + 0.5; s < AT_GATE - 0.6; s += 1.0) {
    for (const sideways of [-0.62, 0.62]) {
      const p = onProcession(s, sideways);
      candle(p.x, p.z);
    }
  }
  for (const [a, c] of GARDEN_BRIDGE_PATH) {
    const run = Math.hypot(c.x - a.x, c.z - a.z);
    const dir = { x: (c.x - a.x) / run, z: (c.z - a.z) / run };
    for (let s = 0.5; s < run - 0.3; s += 1.1) {
      for (const sideways of [-0.55, 0.55]) candle(a.x + dir.x * s - dir.z * sideways, a.z + dir.z * s + dir.x * sideways);
    }
  }
  return out;
}

/** A paper lantern: a round-shouldered lathe with dark rims top and bottom (marked dark in its `color`). */
function lanternGeometry() {
  const profile = [
    [0.0, -0.11],
    [0.06, -0.11],
    [0.06, -0.098],
    [0.1, -0.07],
    [0.115, 0],
    [0.1, 0.07],
    [0.06, 0.098],
    [0.06, 0.11],
    [0.0, 0.11],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const g = new THREE.LatheGeometry(profile, 8);
  const pos = g.attributes.position;
  const color = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const paper = Math.abs(pos.getY(i)) < 0.097 ? 1 : 0;
    color.set([paper, paper, paper], i * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(color, 3));
  return g;
}

/** Fills an instanced mesh's matrices from positions (and optional heights, as a y scale). */
function place(mesh: THREE.InstancedMesh, at: THREE.Vector3[], heights?: number[]) {
  const m = new THREE.Object3D();
  at.forEach((p, i) => {
    m.position.copy(p);
    m.scale.set(1, heights ? heights[i] : 1, 1);
    m.updateMatrix();
    mesh.setMatrixAt(i, m.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
}

export default function FestivalDecorations({ festival }: { festival: Festival }) {
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const plan = useMemo(() => layout(festival), [festival]);

  const parts = useMemo(() => {
    const bulb = new THREE.OctahedronGeometry(0.03, 0);
    setGlowAttributes(bulb, plan.bulbs.map((b) => b.color), plan.bulbs.map((b) => b.seed));
    const paper = lanternGeometry();
    setGlowAttributes(paper, plan.lanterns.map((l) => l.color), plan.lanterns.map((l) => l.seed));
    // A candle is a unit-high cylinder scaled to its height; its flame sits on top.
    const candle = new THREE.CylinderGeometry(0.034, 0.038, 1, 7).translate(0, 0.5, 0);
    const flame = new THREE.ConeGeometry(0.018, 0.065, 6).translate(0, 0.0325, 0);
    const warm = new THREE.Color(festival.theme.glow[0]);
    setGlowAttributes(flame, plan.candles.map(() => warm), plan.candles.map((c) => c.seed));
    const wires = new THREE.BufferGeometry().setFromPoints(plan.wires);
    const halos = haloGeometry(plan.halos);
    return {
      bulb,
      paper,
      candle,
      flame,
      wires,
      halos,
      bulbMaterial: glowMaterial({ flicker: 0.25 }),
      paperMaterial: glowMaterial({ flicker: 0.15, paper: true, sway: 0.012 }),
      flameMaterial: glowMaterial({ flicker: 0.5, flame: true }),
      candleMaterial: new THREE.MeshLambertMaterial({ color: "#efe3c8", emissive: "#ffcf8a", emissiveIntensity: 0.35, transparent: true }),
      wireMaterial: new THREE.LineBasicMaterial({ color: "#2b2420", transparent: true, opacity: 0.75 }),
      haloMaterial: haloMaterial(),
    };
  }, [plan, festival]);

  useEffect(() => () => Object.values(parts).forEach((p) => p.dispose()), [parts]);

  const bulbs = useRef<THREE.InstancedMesh>(null!);
  const lanterns = useRef<THREE.InstancedMesh>(null!);
  const candles = useRef<THREE.InstancedMesh>(null!);
  const flames = useRef<THREE.InstancedMesh>(null!);

  useLayoutEffect(() => {
    place(bulbs.current, plan.bulbs.map((b) => b.at));
    place(lanterns.current, plan.lanterns.map((l) => l.at));
    place(candles.current, plan.candles.map((c) => c.at), plan.candles.map((c) => c.height));
    place(flames.current, plan.candles.map((c) => c.at.clone().setY(c.at.y + c.height)));
  }, [plan]);

  useEffect(() => {
    parts.haloMaterial.uniforms.uViewport.value = viewportHeight(gl);
  }, [gl, size, parts]);

  // The plain materials fade in and out with the festival like the glowing ones.
  useFrame(() => {
    parts.candleMaterial.opacity = festivalGlow.amount;
    parts.wireMaterial.opacity = 0.75 * festivalGlow.amount;
  });

  return (
    <group>
      <instancedMesh ref={bulbs} args={[parts.bulb, parts.bulbMaterial, plan.bulbs.length]} frustumCulled={false} />
      <instancedMesh ref={lanterns} args={[parts.paper, parts.paperMaterial, plan.lanterns.length]} frustumCulled={false} />
      <instancedMesh ref={candles} args={[parts.candle, parts.candleMaterial, plan.candles.length]} />
      <instancedMesh ref={flames} args={[parts.flame, parts.flameMaterial, plan.candles.length]} frustumCulled={false} />
      <lineSegments geometry={parts.wires} material={parts.wireMaterial} />
      <points geometry={parts.halos} material={parts.haloMaterial} frustumCulled={false} />
    </group>
  );
}
