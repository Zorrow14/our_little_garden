"use client";

import { Html, useCursor } from "@react-three/drei";
import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import FlowerTag from "@/components/ui/FlowerTag";
import { useGardenStore } from "@/lib/gardenStore";
import { useKeepsakes } from "@/lib/keepsakes";
import { player, readMove } from "@/lib/playerInput";
import { usePlantStore } from "@/lib/plantStore";
import { type GardenerName, greetSignals, livePose, markWalked, sendGreet, sendPose, usePresence } from "@/lib/presence";
import { AT_DOOR, DOOR, OFF_DOORSTEP, onProcession, PROCESSION_LENGTH, procession } from "@/lib/procession";
import { createRandom } from "@/lib/terrain";
import { getGlowTexture } from "@/lib/textures";
import { isOpenPath, landPlants, type Point } from "@/lib/wander";
import { goToZone, HOME_ZONE, useZone, type ZoneName } from "@/lib/zones";
import { zoneDefinition } from "@/components/zones/registry";
import GardenerBody, { DROPLET_COUNT, type GardenerLook, type GardenerRig } from "./GardenerBody";

interface GardenerProfile {
  id: string;
  name: GardenerName;
  /** Shown under the name on the hover tag. */
  note: string;
  look: GardenerLook;
  /** Where they first appear when the garden opens without the intro. */
  start: Point;
  /**
   * The intro walk out of the cottage: how far along the path they start (the
   * one further along leads through the door), and which side of the path they
   * take once they're walking side by side (positive is to the right).
   */
  intro: { head: number; side: number };
  /** Walking pace in units per second, and the distance covered by one step. */
  speed: number;
  stride: number;
  seed: number;
}

const CREW: GardenerProfile[] = [
  {
    id: "zorrow",
    name: "Zorrow",
    note: "watering the garden",
    look: {
      scale: 1.05,
      build: "lean",
      skin: "#d9a47c",
      hair: "#26222a",
      top: "#363b52",
      bottom: "#43557a",
      shoes: "#e4e1dc",
      hairStyle: "short-tousled",
      carry: "watering-can",
      watch: true,
    },
    start: { x: -5.4, z: 3.6 },
    intro: { head: 0, side: 0.27 },
    speed: 0.6,
    stride: 0.34,
    seed: 3,
  },
  {
    id: "skelly",
    name: "Skelly",
    note: "gathering flowers",
    look: {
      scale: 0.95,
      build: "petite",
      skin: "#e8b995",
      hair: "#2f2226",
      top: "#f5d3ad",
      bottom: "#e59a86",
      shoes: "#8c5a45",
      hairStyle: "long-bangs",
      carry: "basket",
      blush: true,
    },
    start: { x: 4.6, z: -2.2 },
    intro: { head: 0.5, side: -0.27 },
    speed: 0.5,
    stride: 0.28,
    seed: 9,
  },
];

/** Where each gardener is (and in which zone) and where they're heading, so they can keep out of each other's way. */
type Whereabouts = Map<string, { zone: ZoneName; pos: Point; target: Point | null }>;

/**
 * Two little gardeners, one for each of you. Yours walks where you steer it,
 * between zones too; the other follows its owner live while they're here (shown
 * only when they're in the same zone as you), and potters about at home in the
 * cottage while they're away. Either waves when tapped.
 */
export default function Gardeners() {
  const whereabouts = useMemo<Whereabouts>(() => new Map(), []);
  const shadowMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({ map: getGlowTexture(), color: "#000000", transparent: true, opacity: 0.5, depthWrite: false }),
    [],
  );
  useEffect(() => () => shadowMaterial.dispose(), [shadowMaterial]);

  return CREW.map((profile, i) => (
    <Gardener key={profile.id} profile={profile} yieldsFirst={i > 0} whereabouts={whereabouts} shadowMaterial={shadowMaterial} />
  ));
}

/**
 * Each gardener's state machine. The intro runs once: `waiting` inside the
 * cottage until the door opens, then `intro-walk` along the scripted path to
 * just inside the gate (only your own gardener takes it; the other is wherever
 * their owner is, or at home). After that, who's driving decides:
 * - `player`: the gardener you are, steered from this device, in the zone on screen.
 * - `remote`: the other gardener while their owner is here, following their updates
 *   in whichever zone they're in.
 * - `idle` / `walk` / `greet`: wandering on their own while nobody is driving them
 *   (their owner is away), pausing to wave when tapped. That happens at home
 *   (`HOME_ZONE`); one left out in the garden walks home first (`homeward`).
 * Waving when tapped also plays over `player` and `remote` without stopping them.
 */
type Mode = "waiting" | "intro-walk" | "idle" | "walk" | "greet" | "player" | "remote" | "homeward";

/** Pace of the walk in from the cottage: an unhurried stroll, a little brisker than wandering. */
const INTRO_PACE = 0.7;
/** How far behind the leader the other follows through the doorway. */
const SINGLE_FILE_GAP = 0.5;
/** Walking your own gardener is brisker than their wandering stroll. */
const PLAYER_PACE = 2.2;
/** Live updates sent per second while moving, and how often to send one while standing still. */
const SEND_RATE = 12;
const HEARTBEAT = 2;
/** How long a wave lasts. */
const WAVE_TIME = 2.4;

interface Walker {
  mode: Mode;
  zone: ZoneName;
  pos: Point;
  /** Height of the feet: the ground, or the cottage floor while indoors. */
  y: number;
  /** Distance along the intro walk. */
  s: number;
  yaw: number;
  target: Point | null;
  /** The flower being walked to or tended, if any. */
  tend: Point | null;
  /** Seconds left in the current pause or greeting, or seconds spent on the current walk. */
  timer: number;
  /** Seconds spent waiting for the other gardener to get out of the way. */
  waited: number;
  /** Walk cycle, in radians. */
  phase: number;
  /** 0..1 blends from standing still into walking, tending and waving. */
  moving: number;
  tending: number;
  greeting: number;
  /** Seconds since the wave began, and seconds of it left. */
  greetTime: number;
  waving: number;
  /** Smoothed speed of a remote gardener, from how far they move each frame. */
  remotePace: number;
  /** Seconds since the last live update went out, and what it said. */
  sinceSent: number;
  sentPace: number;
  sentYaw: number;
  /** The way home, a point at a time, while `homeward`. */
  route: Point[];
  /** False until you've stepped clear of the exit you arrived by, so it doesn't send you straight back. */
  armed: boolean;
  look: number;
  lookTarget: number;
  lookTimer: number;
}

const shortestTurn = (from: number, to: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
const damp = THREE.MathUtils.damp;

function Gardener({
  profile,
  yieldsFirst,
  whereabouts,
  shadowMaterial,
}: {
  profile: GardenerProfile;
  /** When the two meet head-on, this one steps aside first. */
  yieldsFirst: boolean;
  whereabouts: Whereabouts;
  shadowMaterial: THREE.Material;
}) {
  const { id, name, look, speed, stride, seed } = profile;
  const root = useRef<THREE.Group>(null!);
  const rig = useMemo(() => ({}) as GardenerRig, []);
  const fadeCenter = useMemo(() => ({ value: new THREE.Vector3() }), []);
  const rand = useMemo(() => createRandom(seed), [seed]);
  const scratch = useMemo(() => new THREE.Vector3(), []);
  const interactive = useGardenStore((s) => s.stage === "garden" && !s.activeId && !s.celebrating);
  const isMe = usePresence((s) => s.me === name);
  const ownerHere = usePresence((s) => s.online.includes(name));
  const [hovered, setHovered] = useState(false);
  const hoveredRef = useRef(false);
  const setHover = (on: boolean) => {
    hoveredRef.current = on;
    setHovered(on);
  };
  const [greetings, setGreetings] = useState(0);
  /** The last wave signal seen from the other device. */
  const seenSignal = useRef(greetSignals.get(name) ?? 0);
  useCursor(hovered && interactive);

  /** Where this gardener potters about at home while their owner is away. */
  const homeSpot = useMemo(() => {
    const home = zoneDefinition(HOME_ZONE);
    return home.ground.nearestWalkable({ x: home.spawns.home.x + profile.intro.side * 2, z: home.spawns.home.z }, []);
  }, [profile.intro.side]);

  const [walker] = useState<Walker>(() => {
    // The other person's gardener starts at home; yours comes out of the cottage on the intro
    // walk, or with ?skipintro starts from their usual spot in the garden.
    const { me } = usePresence.getState();
    const atHome = me !== null && me !== name;
    const intro = !atHome && useGardenStore.getState().stage !== "garden";
    const inside = onProcession(profile.intro.head, 0);
    const start = zoneDefinition("garden").ground.nearestWalkable(profile.start, []);
    const pos = atHome ? homeSpot : intro ? { x: inside.x, z: inside.z } : start;
    return {
      mode: intro ? "waiting" : "idle",
      zone: atHome ? HOME_ZONE : "garden",
      pos,
      y: intro ? inside.y : zoneDefinition(atHome ? HOME_ZONE : "garden").ground.height(pos.x, pos.z),
      s: profile.intro.head,
      yaw: intro ? inside.heading : rand() * Math.PI * 2,
      target: null,
      tend: null,
      timer: 0.5 + rand() * 2,
      waited: 0,
      phase: 0,
      moving: 0,
      tending: 0,
      greeting: 0,
      greetTime: 0,
      waving: 0,
      remotePace: 0,
      sinceSent: Infinity,
      sentPace: 0,
      sentYaw: 0,
      route: [],
      armed: false,
      look: 0,
      lookTarget: 0,
      lookTimer: 0,
    };
  });

  /** A wave: the wanderer stops to do it, while a gardener someone is steering waves on the move. */
  const startWave = () => {
    const w = walker;
    if (w.mode === "idle" || w.mode === "walk" || w.mode === "greet") {
      w.mode = "greet";
      w.timer = WAVE_TIME;
    }
    w.waving = WAVE_TIME;
    w.greetTime = 0;
    setGreetings((n) => n + 1);
  };

  // Which arm is free to wave, swing and reach: the one not carrying anything. The character's left is +x.
  const carriesLeft = look.carry === "basket";
  const freeSide = carriesLeft ? -1 : 1;

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    const t = state.clock.elapsedTime;
    const w = walker;
    const { zone: activeZone, arrival, leaving } = useZone.getState();
    const plants = landPlants(usePlantStore.getState().plants);

    let pace = 0;
    let facing: number | null = null;

    /** Hand over from the scripted walk to wandering, keeping position and heading so nothing snaps. */
    const beginWandering = (pause: number) => {
      w.mode = "idle";
      w.timer = pause;
      w.target = null;
      w.tend = null;
      procession.walkers.set(id, { position: new THREE.Vector3(w.pos.x, w.y, w.pos.z), s: w.s, done: true });
    };

    /** Appear at a zone's spawn point: arriving through a door, or put straight there. */
    const placeAt = (zone: ZoneName, spawn: string | null) => {
      const def = zoneDefinition(zone);
      const at = (spawn && def.spawns[spawn]) || (zone === HOME_ZONE ? { ...homeSpot, yaw: def.spawns.home?.yaw ?? 0 } : null);
      const pos = at ?? def.ground.nearestWalkable(profile.start, plants);
      w.zone = zone;
      w.pos = { x: pos.x, z: pos.z };
      if (at) w.yaw = at.yaw;
      w.target = null;
      w.tend = null;
      w.route = [];
      w.armed = false;
      w.remotePace = 0;
    };

    /** Nobody's driving: off home. Out of sight that's instant; in view, they walk back to the cottage. */
    const goHome = () => {
      if (w.mode === "player") player.active = false;
      if (w.zone === "garden" && activeZone === "garden") {
        const gate = onProcession(PROCESSION_LENGTH, 0);
        let route: Point[] | null = isOpenPath(w.pos, gate, plants) ? [gate] : null;
        const garden = zoneDefinition("garden").ground;
        for (let i = 0; i < 40 && !route; i++) {
          const via = { x: (rand() * 2 - 1) * 9, z: (rand() * 2 - 1) * 9 - 0.8 };
          if (garden.isWalkable(via.x, via.z, plants) && isOpenPath(w.pos, via, plants) && isOpenPath(via, gate, plants)) route = [via, gate];
        }
        if (route) {
          for (let s = PROCESSION_LENGTH - 0.4; s > AT_DOOR; s -= 0.4) route.push(onProcession(s, 0));
          route.push(DOOR);
          w.mode = "homeward";
          w.route = route;
          w.target = null;
          w.tend = null;
          return;
        }
      }
      placeAt(HOME_ZONE, null);
      beginWandering(1 + rand() * 2);
    };

    if (w.mode === "waiting" || w.mode === "intro-walk") {
      const { stage, introSkipped } = useGardenStore.getState();
      if (introSkipped || stage === "garden") {
        // Skipped: appear just inside the gate. Opened straight into the garden: their usual spot.
        const cameThrough = introSkipped || procession.door > 0;
        const end = onProcession(PROCESSION_LENGTH, profile.intro.side);
        w.pos = cameThrough ? { x: end.x, z: end.z } : zoneDefinition("garden").ground.nearestWalkable(profile.start, []);
        if (cameThrough) w.yaw = end.heading;
        w.s = PROCESSION_LENGTH;
        beginWandering(0.4 + rand() * 0.8);
      }
    }

    // Who's driving, once the intro walk is over: you, their owner over the network, or nobody.
    const { me } = usePresence.getState();
    const live = name !== me ? livePose(name, performance.now()) : null;
    if ((w.mode === "waiting" || w.mode === "intro-walk") && me && name !== me) {
      // Only your own gardener walks out of the cottage with you.
      placeAt(HOME_ZONE, null);
      beginWandering(1 + rand() * 2);
      procession.walkers.delete(id);
    }
    if (w.mode !== "waiting" && w.mode !== "intro-walk") {
      const driver: Mode | null = name === me ? "player" : live ? "remote" : null;
      if (driver && w.mode !== driver) {
        if (w.mode === "player") player.active = false;
        w.mode = driver;
        w.target = null;
        w.tend = null;
        w.route = [];
        w.sinceSent = Infinity;
      } else if (!driver && w.mode !== "homeward" && (w.mode === "player" || w.mode === "remote" || w.zone !== HOME_ZONE)) {
        // Their owner has gone: home, to carry on pottering about there.
        if (w.zone === HOME_ZONE) {
          if (w.mode === "player") player.active = false;
          beginWandering(1 + rand() * 2);
          const home = zoneDefinition(w.zone).ground;
          if (!home.isWalkable(w.pos.x, w.pos.z, plants)) {
            w.mode = "walk";
            w.target = home.nearestWalkable(w.pos, plants);
            w.timer = 0;
            w.waited = 0;
          }
        } else {
          goHome();
        }
      }
      // You came through a door: appear on its other side. They went through one: appear where they are now.
      if (w.mode === "player" && w.zone !== activeZone) placeAt(activeZone, arrival);
      if (w.mode === "remote" && live && live.zone !== w.zone) {
        placeAt(live.zone, null);
        w.pos = { x: live.x, z: live.z };
        w.yaw = live.yaw;
      }
    }
    const ground = zoneDefinition(w.zone).ground;
    const other = [...whereabouts.entries()].find(([key, o]) => key !== id && o.zone === w.zone)?.[1];

    // Someone on the other device waved at this gardener.
    const signal = greetSignals.get(name) ?? 0;
    if (signal !== seenSignal.current) {
      seenSignal.current = signal;
      startWave();
    }
    w.waving = Math.max(0, w.waving - dt);
    w.greetTime += dt;

    if (w.mode === "player") {
      const g = useGardenStore.getState();
      const canWalk = g.stage === "garden" && !g.activeId && !g.celebrating && !usePlantStore.getState().formOpen && !leaving && !useKeepsakes.getState().open;
      const move = canWalk ? readMove() : { x: 0, y: 0 };
      const amount = Math.hypot(move.x, move.y);
      if (amount > 0.12) {
        // Steer relative to the camera: up is away from it, right is to its right.
        state.camera.getWorldDirection(scratch);
        scratch.y = 0;
        if (scratch.lengthSq() < 1e-6) scratch.set(0, 0, -1);
        scratch.normalize();
        const dx = -scratch.z * move.x + scratch.x * move.y;
        const dz = scratch.x * move.x + scratch.z * move.y;
        const length = Math.hypot(dx, dz);
        facing = Math.atan2(dx, dz);
        // Ease off through a sharp turn rather than sliding sideways.
        const turned = THREE.MathUtils.clamp(1 - Math.abs(shortestTurn(w.yaw, facing)) / 2.2, 0.25, 1);
        const step = speed * PLAYER_PACE * Math.min(amount, 1) * turned * dt;
        const stuck = ground.offGroundBy(w.pos.x, w.pos.z, plants);
        const canStand = (x: number, z: number) => {
          const off = ground.offGroundBy(x, z, plants);
          if (off > 0 && off >= stuck - 1e-6) return false;
          // Don't walk into the other gardener.
          if (!other) return true;
          const near = Math.hypot(other.pos.x - x, other.pos.z - z);
          return near > 0.5 || near > Math.hypot(other.pos.x - w.pos.x, other.pos.z - w.pos.z);
        };
        const sx = (dx / length) * step;
        const sz = (dz / length) * step;
        // Straight on if the way is clear, otherwise slide along whatever's in the way.
        const next = [
          { x: w.pos.x + sx, z: w.pos.z + sz },
          { x: w.pos.x + sx, z: w.pos.z },
          { x: w.pos.x, z: w.pos.z + sz },
        ].find((p) => canStand(p.x, p.z));
        if (next) {
          pace = Math.hypot(next.x - w.pos.x, next.z - w.pos.z) / dt;
          w.pos = next;
          w.waving = 0;
          markWalked();
          if (hoveredRef.current) setHover(false);
        }
      } else if (w.waving > 0) {
        facing = Math.atan2(state.camera.position.x - w.pos.x, state.camera.position.z - w.pos.z);
      }
      // Walked into a doorway: through to the zone beyond.
      const exit = zoneDefinition(w.zone).exits.find((e) => Math.hypot(e.at.x - w.pos.x, e.at.z - w.pos.z) < e.radius);
      if (!exit) w.armed = true;
      else if (w.armed && pace > 0 && !leaving) {
        w.armed = false;
        goToZone(exit.to, exit.spawn);
      }
    } else if (w.mode === "homeward") {
      // Back along the path to the cottage, and in through the door.
      const next = w.route[0];
      const dx = next.x - w.pos.x;
      const dz = next.z - w.pos.z;
      const distance = Math.hypot(dx, dz);
      if (distance < 0.08) {
        w.route.shift();
        if (w.route.length === 0) {
          placeAt(HOME_ZONE, "front-door");
          w.mode = "walk";
          w.target = homeSpot;
          w.timer = 0;
          w.waited = 0;
        }
      } else {
        facing = Math.atan2(dx, dz);
        const turnedToward = THREE.MathUtils.clamp(1 - Math.abs(shortestTurn(w.yaw, facing)) / 1.4, 0.2, 1);
        pace = speed * 1.3 * turnedToward;
        const step = Math.min(pace * dt, distance);
        w.pos = { x: w.pos.x + (dx / distance) * step, z: w.pos.z + (dz / distance) * step };
      }
    } else if (w.mode === "remote" && live) {
      // Follow their updates. Normally that's step for step; after a gap (say they've just come back)
      // they hurry over from wherever they'd wandered off to.
      const dx = live.x - w.pos.x;
      const dz = live.z - w.pos.z;
      const distance = Math.hypot(dx, dz);
      const chase = THREE.MathUtils.clamp(distance * 1.2, speed * 3, 5);
      const step = Math.min(distance, chase * dt);
      if (distance > 1e-4) w.pos = { x: w.pos.x + (dx / distance) * step, z: w.pos.z + (dz / distance) * step };
      w.remotePace = damp(w.remotePace, step / dt, 10, dt);
      pace = w.remotePace > 0.05 ? w.remotePace : 0;
      facing = distance > 0.5 ? Math.atan2(dx, dz) : live.yaw;
      if (pace > 0.3 && hoveredRef.current) setHover(false);
    } else if (w.mode === "waiting") {
      // Indoors, until the door is most of the way open.
      if (procession.door > 0.8) w.mode = "intro-walk";
    } else if (w.mode === "intro-walk") {
      // Single file through the doorway, then side by side: whoever's out of step hurries or eases off.
      const partner = [...procession.walkers].find(([key]) => key !== id)?.[1];
      const leads = profile.intro.head > 0;
      const bothOut = partner ? Math.min(w.s, partner.s) > OFF_DOORSTEP + 0.4 : true;
      const wantedLead = bothOut ? 0 : leads ? -SINGLE_FILE_GAP : SINGLE_FILE_GAP;
      const lead = partner ? partner.s - w.s : wantedLead;
      pace = INTRO_PACE * THREE.MathUtils.clamp(1 + (lead - wantedLead) * 0.9, 0.7, 1.4);
      w.s = Math.min(w.s + pace * dt, PROCESSION_LENGTH);
      const side = profile.intro.side * THREE.MathUtils.smoothstep(w.s, OFF_DOORSTEP, OFF_DOORSTEP + 1.2);
      const here = onProcession(w.s, side);
      w.pos = { x: here.x, z: here.z };
      w.y = here.y;
      facing = here.heading;
      if (w.s >= PROCESSION_LENGTH) beginWandering(0.3 + rand() * 0.6);
    } else if (w.mode === "greet") {
      w.timer -= dt;
      facing = Math.atan2(state.camera.position.x - w.pos.x, state.camera.position.z - w.pos.z);
      if (w.timer <= 0) {
        w.mode = "idle";
        w.timer = 0.6 + rand();
      }
    } else if (w.mode === "idle") {
      w.timer -= dt;
      if (w.tend) facing = Math.atan2(w.tend.x - w.pos.x, w.tend.z - w.pos.z);
      if (w.timer <= 0) {
        const claimed = other ? [other.pos, ...(other.target ? [other.target] : [])] : [];
        const plan = ground.planWander(w.pos, claimed, other ? [other.pos] : [], plants, rand);
        if (plan) {
          // The scene only notices the pointer leaving when the mouse moves, so drop the tag as they walk off.
          if (hoveredRef.current) setHover(false);
          w.mode = "walk";
          w.target = plan.target;
          w.tend = plan.tend;
          w.timer = 0;
          w.waited = 0;
        } else {
          w.timer = 1.5;
        }
      }
    } else if (w.target) {
      const dx = w.target.x - w.pos.x;
      const dz = w.target.z - w.pos.z;
      const distance = Math.hypot(dx, dz);
      w.timer += dt;
      if (distance < 0.05 || w.timer > 25) {
        // Arrived (or gave up): pause a while, longer if there's a flower to tend.
        w.mode = "idle";
        w.target = null;
        w.timer = w.tend ? 4 + rand() * 3 : 2 + rand() * 4;
        if (distance >= 0.05) w.tend = null;
      } else {
        facing = Math.atan2(dx, dz);
        // Turn toward the next spot before setting off.
        const turnedToward = THREE.MathUtils.clamp(1 - Math.abs(shortestTurn(w.yaw, facing)) / 1.1, 0, 1);
        const toOther = other ? { x: other.pos.x - w.pos.x, z: other.pos.z - w.pos.z } : null;
        const inTheWay =
          toOther !== null &&
          Math.hypot(toOther.x, toOther.z) < 0.95 &&
          (toOther.x * dx + toOther.z * dz) / (Math.hypot(toOther.x, toOther.z) * distance) > 0.2;
        if (inTheWay) {
          // Let the other pass; if they don't, find somewhere else to go.
          w.waited += dt;
          if (w.waited > (yieldsFirst ? 1.2 : 2.5)) {
            w.mode = "idle";
            w.target = null;
            w.tend = null;
            w.timer = 0.3;
          }
        } else {
          w.waited = 0;
          pace = speed * turnedToward;
          const step = Math.min(pace * dt, distance);
          w.pos = { x: w.pos.x + (dx / distance) * step, z: w.pos.z + (dz / distance) * step };
        }
      }
    }
    whereabouts.set(id, { zone: w.zone, pos: w.pos, target: w.target });
    if (w.mode === "waiting" || w.mode === "intro-walk") {
      procession.walkers.set(id, { position: new THREE.Vector3(w.pos.x, w.y, w.pos.z), s: w.s, done: false });
    } else {
      w.y = zoneDefinition(w.zone).ground.height(w.pos.x, w.pos.z);
    }
    // Anyone coming up to the cottage door (you, them, or a gardener heading home) has it opened for them.
    if (w.zone === "garden" && w.mode !== "waiting" && Math.hypot(w.pos.x - DOOR.x, w.pos.z - DOOR.z) < 1.3) procession.nearDoor.add(id);
    else procession.nearDoor.delete(id);

    const turnRate =
      w.mode === "player" ? 10 : w.mode === "intro-walk" || w.mode === "remote" ? 8 : w.mode === "walk" || w.mode === "homeward" ? 6 : 3.5;
    if (facing !== null) w.yaw += shortestTurn(w.yaw, facing) * (1 - Math.exp(-turnRate * dt));

    if (w.mode === "player") {
      player.active = true;
      player.moving = pace > 0.05;
      player.x = w.pos.x;
      player.y = w.y;
      player.z = w.pos.z;
    }
    if (name === me && (w.mode === "player" || w.mode === "intro-walk")) {
      // Tell the other device: steadily while walking or turning, and now and then while standing so they know you're still here.
      w.sinceSent += dt;
      const changed = pace > 0.05 || w.sentPace > 0.05 || Math.abs(shortestTurn(w.sentYaw, w.yaw)) > 0.02;
      if ((changed && w.sinceSent >= 1 / SEND_RATE) || w.sinceSent >= HEARTBEAT) {
        const round = (v: number) => Math.round(v * 1000) / 1000;
        sendPose({
          x: round(w.pos.x),
          z: round(w.pos.z),
          yaw: round(w.yaw),
          pace: round(pace),
          anim: pace > 0.05 ? "walk" : "idle",
          zone: w.zone,
        });
        w.sinceSent = 0;
        w.sentPace = pace;
        w.sentYaw = w.yaw;
      }
    }

    // Blend between poses. A quicker pace takes longer strides.
    w.moving = damp(w.moving, pace > 0.01 ? 1 : 0, 8, dt);
    w.tending = damp(w.tending, w.mode === "idle" && w.tend ? 1 : 0, 2.5, dt);
    w.greeting = damp(w.greeting, w.waving > 0 ? 1 : 0, 7, dt);
    w.phase += ((pace * dt) / (stride * THREE.MathUtils.clamp(pace / speed, 1, 1.5))) * Math.PI;
    const swing = Math.sin(w.phase) * w.moving;
    const still = 1 - w.moving;

    // Standing about: look around now and then, or down at the flower being tended.
    w.lookTimer -= dt;
    if (w.lookTimer <= 0) {
      const standing = (w.mode === "idle" && !w.tend) || ((w.mode === "player" || w.mode === "remote") && pace === 0);
      w.lookTarget = standing ? (rand() - 0.5) * 1.3 : 0;
      w.lookTimer = 1.2 + rand() * 2.5;
    }
    w.look = damp(w.look, pace > 0 ? 0 : w.lookTarget, 3, dt);

    const hop = w.waving > 0 && w.greetTime < 0.9 ? Math.abs(Math.sin((w.greetTime / 0.45) * Math.PI)) * 0.13 : 0;
    root.current.position.set(w.pos.x, w.y, w.pos.z);
    root.current.rotation.y = w.yaw;
    // Only in the zone on screen; and out of sight in the cottage until the door opens.
    const visible = w.zone === activeZone && (w.mode !== "waiting" || procession.door > 0.05);
    root.current.visible = visible;
    if (!visible && hoveredRef.current) setHover(false);
    fadeCenter.value.set(w.pos.x, w.y + 0.6, w.pos.z);

    if (!rig.bounce) return;
    rig.bounce.position.y = Math.abs(Math.sin(w.phase)) * 0.035 * w.moving + hop;
    rig.leftLeg.rotation.x = swing * 0.45;
    rig.rightLeg.rotation.x = -swing * 0.45;

    const watering = look.carry === "watering-can";
    // Skelly leans in to pick; Zorrow stays upright to pour.
    const lean = 0.07 * w.moving + (watering ? 0.05 : 0.32) * w.tending;
    rig.upper.rotation.x = lean;
    rig.upper.rotation.z = Math.sin(w.phase) * 0.04 * w.moving + Math.sin(t * 1.1 + seed) * 0.022 * still;
    rig.upper.scale.y = 1 + Math.sin(t * 2.2 + seed) * 0.012 * still;

    rig.head.rotation.y = w.look * (1 - w.greeting);
    rig.head.rotation.x = (watering ? 0.3 : 0.45) * w.tending - 0.12 * w.greeting;
    rig.head.rotation.z = 0.18 * w.greeting * freeSide;

    const free = freeSide === 1 ? rig.leftArm : rig.rightArm;
    const carrying = freeSide === 1 ? rig.rightArm : rig.leftArm;
    // Arms swing against the leg on their own side; the carrying arm barely moves.
    const freeSwing = -swing * 0.5 * freeSide;
    const wave = Math.sin(t * 13) * 0.35;
    free.rotation.x = freeSwing * (1 - w.greeting) - (watering ? 0 : 1.1 + Math.sin(t * 3) * 0.08) * w.tending;
    free.rotation.z = freeSide * (0.1 + (2.45 + wave) * w.greeting);
    carrying.rotation.x = swing * 0.15 * freeSide - (watering ? 0.9 : 0) * w.tending;
    // Held a little away from the body, the basket clear of the skirt.
    carrying.rotation.z = -freeSide * ((watering ? 0.2 : 0.34) + Math.sin(t * 1.3 + seed) * 0.02 * still);
    // The can tips forward to pour, then settles back; the basket sways with each step.
    rig.prop.rotation.x = watering ? 1.9 * w.tending : Math.sin(w.phase) * 0.12 * w.moving;

    if (rig.water && rig.spout) {
      const pouring = w.tending > 0.8;
      rig.water.visible = pouring;
      if (pouring) {
        const spout = root.current.worldToLocal(rig.spout.getWorldPosition(scratch));
        rig.water.children.forEach((drop, i) => {
          const fall = (t * 1.7 + i / DROPLET_COUNT) % 1;
          drop.position.set(
            spout.x + Math.sin(i * 2.3) * 0.02,
            THREE.MathUtils.lerp(spout.y, 0.02, fall * fall),
            spout.z + 0.03 + fall * 0.04,
          );
        });
      }
    }
  });

  const greet = (e: ThreeEvent<MouseEvent>) => {
    // Ignore the release at the end of a drag to look around.
    if (!interactive || e.delta > 8 || !root.current.visible) return;
    e.stopPropagation();
    startWave();
    // They wave on the other device too.
    sendGreet(name);
  };

  useEffect(
    () => () => {
      if (walker.mode === "player") player.active = false;
    },
    [walker],
  );

  const note = isMe ? "that's you" : ownerHere ? "here with you now" : profile.note;

  return (
    <group ref={root} scale={look.scale}>
      <GardenerBody look={look} rig={rig} fadeCenter={fadeCenter} />
      <mesh material={shadowMaterial} position-y={0.015} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[0.8, 0.8]} />
      </mesh>
      <mesh
        visible={false}
        position-y={0.6}
        onPointerOver={(e) => {
          if (!interactive || !root.current.visible) return;
          e.stopPropagation();
          setHover(true);
        }}
        onPointerOut={() => setHover(false)}
        onClick={greet}
      >
        <capsuleGeometry args={[0.38, 0.6, 2, 8]} />
      </mesh>
      {hovered && interactive && (
        <Html position={[0, 1.45, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
          <FlowerTag text={name} note={note} />
        </Html>
      )}
      {greetings > 0 && (
        <Html key={greetings} position={[0, 1.8, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
          <motion.svg
            viewBox="0 0 24 24"
            className="h-7 w-7 fill-rose [filter:drop-shadow(0_2px_6px_rgb(3_5_18/0.6))]"
            aria-hidden="true"
            initial={{ y: 0, opacity: 0, scale: 0.4 }}
            animate={{ y: -46, opacity: [0, 1, 1, 0], scale: 1 }}
            transition={{ duration: 1.8, ease: "easeOut" }}
          >
            <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.9 4.5 6.6 4.5c2.1 0 3.6 1.2 4.4 2.6.8-1.4 2.3-2.6 4.4-2.6 3.7 0 5.7 3.9 4.2 7.3C19.5 16.4 12 21 12 21z" />
          </motion.svg>
        </Html>
      )}
    </group>
  );
}
