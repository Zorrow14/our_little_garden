"use client";

import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useReducedMotion } from "framer-motion";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { FINAL_ID, useGardenStore } from "@/lib/gardenStore";
import { gsap } from "@/lib/gsap";
import { flowerAnchors } from "@/lib/layout";
import { player } from "@/lib/playerInput";
import { STARGAZE } from "@/lib/props";
import { useStargazing } from "@/lib/stargazing";
import { useZone } from "@/lib/zones";
import { arrivalPose, fitFov, framed, keepPlayerInView, type Pose, portraitPull } from "@/components/zones/camera";
import { ZONES } from "@/components/zones/registry";
import { GATE, INTRO_SHOTS, PROCESSION_LENGTH, procession } from "@/lib/procession";
import { groundHeight, HILL } from "@/lib/terrain";

/** High above and behind the garden; the intro descends from here. */
const INTRO_POSE: Pose = {
  position: new THREE.Vector3(0, 16, 30),
  target: new THREE.Vector3(0, 0, -5),
};

/** Looking down over the pond at the whole garden, with the lotus front and centre. */
const GARDEN_POSE: Pose = {
  position: new THREE.Vector3(0.8, 6.4, 10.6),
  target: new THREE.Vector3(0, 0.3, -0.9),
};

function gardenPose(aspect: number): Pose {
  const offset = GARDEN_POSE.position.clone().sub(GARDEN_POSE.target).multiplyScalar(portraitPull(aspect));
  return { position: GARDEN_POSE.target.clone().add(offset), target: GARDEN_POSE.target.clone() };
}

const introShot = framed;

/**
 * Arriving in the garden: out of the cottage, just behind and above the
 * doorstep, looking down the path; otherwise (back over the bridge too, which
 * is in sight from it) the usual view.
 */
function arrivalView(arrival: string | null, aspect: number): Pose {
  if (arrival === "cottage-door") return arrivalPose(ZONES.garden.spawns["cottage-door"], groundHeight, 3.2, 2.6, aspect);
  return gardenPose(aspect);
}

/** Stargazing: low on the hill's flank, tipped up past its top at the sky, with whoever's on the hill along the bottom. */
function stargazePose(aspect: number): Pose {
  const top = groundHeight(HILL.x, HILL.z);
  const { camera, look } = STARGAZE;
  const position = new THREE.Vector3(camera.x, top + 0.5, camera.z);
  const target = new THREE.Vector3(HILL.x + look.x * 2.5, top + 2.3, HILL.z + look.z * 2.5);
  return introShot(position, target, aspect);
}

/** Where the camera looks while trailing the gardeners: their heads, and the gate as they reach it. */
const LOOK_ABOVE_FEET = new THREE.Vector3(0, 0.75, 0);
const GATE_TARGET = new THREE.Vector3(GATE.x, groundHeight(GATE.x, GATE.z) + 0.75, GATE.z);

/** A viewpoint on the same side as `from`, looking at `anchor` from a little above. */
function focusPose(anchor: THREE.Vector3, from: THREE.Vector3, distance: number, height: number): Pose {
  const direction = from.clone().sub(anchor).setY(0);
  if (direction.lengthSq() < 1e-4) direction.set(0, 0, 1);
  direction.normalize();
  return {
    position: anchor.clone().addScaledVector(direction, distance).add(new THREE.Vector3(0, height, 0)),
    target: anchor.clone(),
  };
}

export default function CameraRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const aspect = useThree((s) => s.size.width / s.size.height);
  const controls = useRef<OrbitControlsImpl>(null!);
  const stage = useGardenStore((s) => s.stage);
  const activeId = useGardenStore((s) => s.activeId);
  const celebrating = useGardenStore((s) => s.celebrating);
  const stars = useStargazing((s) => s.on);
  const reducedMotion = useReducedMotion() ?? false;

  const aspectRef = useRef(aspect);
  aspectRef.current = aspect;
  /** Where the camera was before it flew to a flower, so closing the letter can return there. */
  const beforeFocus = useRef<Pose | null>(null);
  /** Where it was before tipping up to the stars. */
  const beforeStars = useRef<Pose | null>(null);
  const flight = useRef<gsap.core.Timeline | null>(null);
  const introPhase = useRef<"reveal" | "follow" | "settle" | "done">("done");
  const focus = useMemo(() => new THREE.Vector3(), []);
  const wanted = useMemo(() => new THREE.Vector3(), []);

  /** Glide camera and orbit target together; the controls are paused for the flight. */
  const flyTo = (pose: Pose, duration: number, onArrive?: () => void) => {
    const c = controls.current;
    flight.current?.kill();
    c.enabled = false;
    const d = reducedMotion ? 0 : duration;
    flight.current = gsap
      .timeline({ onUpdate: () => camera.lookAt(c.target), onComplete: onArrive })
      .to(camera.position, { x: pose.position.x, y: pose.position.y, z: pose.position.z, duration: d, ease: "power2.inOut" }, 0)
      .to(c.target, { x: pose.target.x, y: pose.target.y, z: pose.target.z, duration: d, ease: "power2.inOut" }, 0);
  };

  const release = () => {
    const c = controls.current;
    c.enabled = true;
    c.update();
  };

  useEffect(() => fitFov(camera, aspect), [camera, aspect]);

  // Place the camera before the first frame: up high for the intro, or at the garden view.
  useLayoutEffect(() => {
    const c = controls.current;
    const inGarden = useGardenStore.getState().stage === "garden";
    // Back out of the cottage or over the bridge: start where you come in.
    const pose = inGarden ? arrivalView(useZone.getState().arrival, camera.aspect) : INTRO_POSE;
    camera.position.copy(pose.position);
    c.target.copy(pose.target);
    camera.lookAt(c.target);
    c.enabled = inGarden;
    if (inGarden) c.update();
    return () => {
      flight.current?.kill();
    };
  }, [camera]);

  /** Glide over the garden, then hand the camera to her. */
  const settle = (duration: number) => {
    introPhase.current = "settle";
    flyTo(gardenPose(aspectRef.current), duration, () => {
      introPhase.current = "done";
      useGardenStore.getState().finishEntering();
      release();
    });
  };

  // The intro cinematic: down from the sky to the cottage, whose door opens for the gardeners.
  // The walk to the gate is followed frame by frame below.
  useEffect(() => {
    if (stage !== "entering") return;
    if (reducedMotion) {
      useGardenStore.getState().skipIntro();
      settle(0);
      return;
    }
    introPhase.current = "reveal";
    flyTo(introShot(INTRO_SHOTS.reveal.position, INTRO_SHOTS.reveal.target, aspectRef.current), 4.2, () => {
      introPhase.current = "follow";
    });
    const knock = gsap.delayedCall(3.6, () => {
      procession.doorWanted = true;
    });
    return () => {
      knock.kill();
    };
    // flyTo and settle only read refs and stable values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  useFrame((_, delta) => {
    const phase = introPhase.current;
    if (phase === "done") {
      keepPlayerInView(camera, controls.current, delta);
      return;
    }
    if (phase !== "reveal" && phase !== "follow") return;
    if (useGardenStore.getState().introSkipped) {
      settle(1.2);
      return;
    }
    if (phase !== "follow") return;

    const walkers = [...procession.walkers.values()];
    if (walkers.length === 0) return;
    const c = controls.current;
    const aspect = aspectRef.current;
    // Keep the pair in frame, drifting from the doorway shot to trail just behind them at the gate.
    focus.set(0, 0, 0);
    walkers.forEach((w) => focus.add(w.position));
    focus.divideScalar(walkers.length).add(LOOK_ABOVE_FEET);
    const progress = Math.min(...walkers.map((w) => w.s)) / PROCESSION_LENGTH;
    const drift = THREE.MathUtils.smoothstep(progress, 0.15, 0.95);
    const from = introShot(INTRO_SHOTS.reveal.position, INTRO_SHOTS.reveal.target, aspect).position;
    const to = introShot(INTRO_SHOTS.trail, GATE_TARGET, aspect).position;
    wanted.lerpVectors(from, to, drift);
    camera.position.lerp(wanted, 1 - Math.exp(-2.5 * delta));
    c.target.lerp(focus, 1 - Math.exp(-3 * delta));
    camera.lookAt(c.target);

    // Both through the gate and wandering: rise over the garden and let her explore.
    if (walkers.every((w) => w.done)) settle(2.6);
  });

  // Fly to a flower when its letter opens, back when it closes, and to the final bloom when it unlocks.
  useEffect(() => {
    if (stage !== "garden") return;
    const c = controls.current;
    const portrait = aspectRef.current < 1;

    if (activeId) {
      const anchor = flowerAnchors.get(activeId);
      if (!anchor) return;
      beforeFocus.current ??= { position: camera.position.clone(), target: c.target.clone() };
      flyTo(focusPose(anchor, camera.position, portrait ? 4.4 : 3.4, 1.3), 1.4);
      return;
    }

    if (celebrating) {
      const anchor = flowerAnchors.get(FINAL_ID);
      const from = beforeFocus.current?.position ?? camera.position;
      beforeFocus.current = null;
      if (!anchor) return;
      flyTo(focusPose(anchor, from, portrait ? 7 : 5.6, 2.3), 3.2, () => {
        release();
        gsap.delayedCall(4, () => useGardenStore.getState().endCelebration());
      });
      return;
    }

    if (beforeFocus.current) {
      const back = beforeFocus.current;
      beforeFocus.current = null;
      flyTo(back, 1.2, release);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, celebrating, stage]);

  // Up to the stars when they come out; back down when they go, to the old angle but wherever you've walked to.
  useEffect(() => {
    if (stage !== "garden" || introPhase.current !== "done") return;
    const c = controls.current;
    if (stars) {
      beforeStars.current ??= { position: camera.position.clone(), target: c.target.clone() };
      flyTo(stargazePose(aspectRef.current), 2.6, release);
      return;
    }
    const back = beforeStars.current;
    if (!back) return;
    beforeStars.current = null;
    const target = player.active ? new THREE.Vector3(player.x, groundHeight(player.x, player.z) + 0.3, player.z) : back.target;
    flyTo({ position: target.clone().add(back.position.clone().sub(back.target)), target }, 2, release);
    // flyTo and release only read refs and stable values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stars]);

  const pull = portraitPull(aspect);
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.5}
      zoomSpeed={0.7}
      minDistance={3}
      // A little past the starting view.
      maxDistance={14.5 * pull}
      minPolarAngle={0.5}
      // Stargazing, the view may tip up past level to look at the sky.
      maxPolarAngle={stars ? 1.85 : 1.32}
    />
  );
}
