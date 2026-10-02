"use client";

import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { type ReactNode, useEffect, useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { PropHover } from "@/components/garden/props/shared";
import { announceCountdown } from "@/lib/countdown";
import { player } from "@/lib/playerInput";
import type { ZoneName } from "@/lib/zones";
import { fitFov, keepPlayerInView, portraitPull } from "../camera";
import { takeExit } from "../registry";
import type { WallSpec } from "../walls";

/**
 * What the places off the far garden share: their camera, the way back out,
 * and the walls of a box-shaped room.
 */

export interface PlaceView {
  /** What the camera looks at, and from where: distance, polar angle (from straight down) and azimuth (from +z, toward +x). */
  target: [number, number, number];
  distance: number;
  polar: number;
  azimuth: number;
  /** How far it may zoom and tip; and turn, if limited (a room seen from its open corner). */
  zoom: [number, number];
  tip: [number, number];
  turn?: [number, number];
  /**
   * "still": stays put unless turned (a room you can see all of).
   * "edges": drifts after you near the edge of the screen (a lawn).
   * "always": keeps you in the middle (a maze, where the hedges would hide you).
   */
  follow: "still" | "edges" | "always";
}

/** The camera for a small place: placed afresh on arrival, then free to turn within its limits. */
export function PlaceCamera({ view }: { view: PlaceView }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const aspect = useThree((s) => s.size.width / s.size.height);
  const controls = useRef<OrbitControlsImpl>(null!);
  const pull = portraitPull(aspect);

  useEffect(() => fitFov(camera, aspect), [camera, aspect]);

  useLayoutEffect(() => {
    const target = new THREE.Vector3(...view.target);
    const offset = new THREE.Vector3().setFromSphericalCoords(view.distance * portraitPull(camera.aspect), view.polar, view.azimuth);
    camera.position.copy(target).add(offset);
    controls.current.target.copy(target);
    camera.lookAt(target);
    controls.current.update();
    // Placed once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera]);

  useFrame((_, delta) => {
    const c = controls.current;
    if (view.follow === "edges") keepPlayerInView(camera, c, delta);
    else if (view.follow === "always" && player.active && c.enabled) {
      const k = 1 - Math.exp(-4 * delta);
      const dx = (player.x - c.target.x) * k;
      const dz = (player.z - c.target.z) * k;
      c.target.x += dx;
      c.target.z += dz;
      camera.position.x += dx;
      camera.position.z += dz;
    }
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.5}
      zoomSpeed={0.7}
      minDistance={view.zoom[0]}
      maxDistance={view.zoom[1] * pull}
      minPolarAngle={view.tip[0]}
      maxPolarAngle={view.tip[1]}
      minAzimuthAngle={view.turn?.[0] ?? -Infinity}
      maxAzimuthAngle={view.turn?.[1] ?? Infinity}
    />
  );
}

/**
 * Tells you the countdown (`lib/countdown.ts`) as you come within `radius` of
 * `at`, once each time you come near; says nothing if no date is set. Not on
 * arrival: you may appear already close (back out of the lighthouse, say).
 */
export function CountdownWhenNear({ at, radius }: { at: { x: number; z: number }; radius: number }) {
  const near = useRef<boolean | null>(null);
  const settle = useRef(0.5);
  useFrame((_, delta) => {
    if (!player.active) return;
    const now = Math.hypot(player.x - at.x, player.z - at.z) < (near.current ? radius + 0.6 : radius);
    // Where you were a moment ago may still be another zone's.
    if (settle.current > 0) {
      settle.current -= delta;
      near.current = now;
      return;
    }
    if (now && !near.current) announceCountdown();
    near.current = now;
  });
  return null;
}

/** The way back out to the far garden: click the door (or walk into it). */
export function WayOut({
  zone,
  tagAt,
  pool,
  light,
  children,
}: {
  zone: ZoneName;
  tagAt: [number, number, number];
  pool: { at: [number, number, number]; size: number };
  light: [number, number, number];
  children: ReactNode;
}) {
  return (
    <PropHover tag="Out to the far garden" tagAt={tagAt} pool={pool} light={light} onSelect={() => takeExit(zone, "far-garden")}>
      {children}
    </PropHover>
  );
}

/**
 * The four walls of a box-shaped room, `halfWidth` × `halfDepth`, as the
 * cottage's are: the door in the left (-x) wall, a window in the back (-z).
 */
export function boxRoomWalls(
  halfWidth: number,
  halfDepth: number,
  door: { z: number; width: number; height: number },
  window: { x: number; y: number; width: number; height: number },
): WallSpec[] {
  const W = halfWidth;
  const D = halfDepth;
  return [
    {
      position: [-W, 0, -D],
      rotation: 0,
      length: W * 2,
      holes: [
        {
          from: window.x - window.width / 2 + W,
          to: window.x + window.width / 2 + W,
          bottom: window.y - window.height / 2,
          top: window.y + window.height / 2,
        },
      ],
    },
    {
      position: [-W, 0, D],
      rotation: Math.PI / 2,
      length: D * 2,
      holes: [{ from: D - door.z - door.width / 2, to: D - door.z + door.width / 2, bottom: 0, top: door.height }],
    },
    { position: [W, 0, -D], rotation: -Math.PI / 2, length: D * 2 },
    { position: [W, 0, D], rotation: Math.PI, length: W * 2 },
  ];
}
