"use client";

import { OrbitControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useReducedMotion } from "framer-motion";
import { useEffect, useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { FINAL_ID, useGardenStore } from "@/lib/gardenStore";
import { gsap } from "@/lib/gsap";
import { flowerAnchors } from "@/lib/layout";

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

  // The intro cinematic: a slow descent from the sky down to the pond.
  useEffect(() => {
    if (stage !== "entering") return;
    flyTo(gardenPose(aspectRef.current), 6.5, () => {
      useGardenStore.getState().finishEntering();
      release();
    });
    // flyTo only reads refs and stable values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

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
      maxDistance={15 * pull}
      minPolarAngle={0.5}
      maxPolarAngle={1.32}
      minAzimuthAngle={-1.5}
      maxAzimuthAngle={1.5}
    />
  );
}
