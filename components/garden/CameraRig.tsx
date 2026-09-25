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
import { GATE, INTRO_SHOTS, PROCESSION_LENGTH, procession } from "@/lib/procession";
import { groundHeight } from "@/lib/terrain";

interface Pose {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

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

/** Tall phone screens back the camera off so the whole garden still fits side to side. */
function portraitPull(aspect: number) {
  return aspect >= 1 ? 1 : THREE.MathUtils.lerp(1.6, 1, THREE.MathUtils.clamp((aspect - 0.45) / 0.55, 0, 1));
}

function gardenPose(aspect: number): Pose {
  const offset = GARDEN_POSE.position.clone().sub(GARDEN_POSE.target).multiplyScalar(portraitPull(aspect));
  return { position: GARDEN_POSE.target.clone().add(offset), target: GARDEN_POSE.target.clone() };
}

/** An intro shot, backed off along its line of sight on tall phone screens (less than the garden view: it's framing something small). */
function introShot(position: THREE.Vector3, target: THREE.Vector3, aspect: number): Pose {
  const offset = position.clone().sub(target).multiplyScalar(THREE.MathUtils.lerp(1, portraitPull(aspect), 0.55));
  return { position: target.clone().add(offset), target: target.clone() };
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
  const reducedMotion = useReducedMotion() ?? false;

  const aspectRef = useRef(aspect);
  aspectRef.current = aspect;
  /** Where the camera was before it flew to a flower, so closing the letter can return there. */
  const beforeFocus = useRef<Pose | null>(null);
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

  useEffect(() => {
    camera.fov = aspect >= 1 ? 45 : THREE.MathUtils.lerp(58, 45, THREE.MathUtils.clamp((aspect - 0.45) / 0.55, 0, 1));
    camera.updateProjectionMatrix();
  }, [camera, aspect]);

  // Place the camera before the first frame: up high for the intro, or at the garden view.
  useLayoutEffect(() => {
    const c = controls.current;
    const inGarden = useGardenStore.getState().stage === "garden";
    const pose = inGarden ? gardenPose(camera.aspect) : INTRO_POSE;
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
      maxPolarAngle={1.32}
    />
  );
}
