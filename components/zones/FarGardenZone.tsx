"use client";

import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import Grass, { type GrassField } from "@/components/garden/Grass";
import Ground, { HILLS, MUD, type Terrain, TRODDEN } from "@/components/garden/Ground";
import Lights from "@/components/garden/Lights";
import Bridge from "@/components/garden/props/Bridge";
import BrookWater from "@/components/garden/props/Brook";
import { PropHoverLight } from "@/components/garden/props/shared";
import Sky from "@/components/garden/Sky";
import SteppingStones from "@/components/garden/SteppingStones";
import Trees, { type TreeRing } from "@/components/garden/Trees";
import { toLocal } from "@/lib/frame";
import { FAR_BRIDGE, FAR_BROOK, FAR_OBSTACLES, FAR_PATHS, farHeight } from "@/lib/farGarden";
import { brookDepth, smoothstep } from "@/lib/terrain";
import type { Point } from "@/lib/wander";
import { useZone } from "@/lib/zones";
import { arrivalPose, fitFov, keepPlayerInView, portraitPull } from "./camera";
import Entrances, { Signpost } from "./far/Entrances";
import { takeExit, ZONES } from "./registry";

/** How far (x, z) is from the nearest stepping-stone path. */
function distanceToPaths(x: number, z: number) {
  let min = Infinity;
  for (const [a, b] of FAR_PATHS) {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
    min = Math.min(min, Math.hypot(a.x + dx * t - x, a.z + dz * t - z));
  }
  return min;
}

const nearSolid = (p: Point, room: number) => FAR_OBSTACLES.some((o) => Math.hypot(o.x - p.x, o.z - p.z) < o.r + room);

/** The meadow's ground: worn along the paths, muddy along the brook, darkening into the hills. */
const FAR_TERRAIN: Terrain = {
  height: farHeight,
  tint: (x, z, c) => {
    if (Math.hypot(x, z) < 14) c.lerp(TRODDEN, (1 - smoothstep(0.3, 1.0, distanceToPaths(x, z))) * 0.5);
    c.lerp(HILLS, smoothstep(12, 22, Math.hypot(x, z)));
    c.lerp(MUD, Math.min(1, (brookDepth(FAR_BROOK, x, z) / FAR_BROOK.depth) * 1.6));
  },
};

/** Grass over the meadow, a little sparser than the garden's, off the paths and away from the entrances. */
const FAR_FIELD: GrassField = {
  radius: 14,
  center: [0, 0],
  height: farHeight,
  open: (x, z) => distanceToPaths(x, z) > 0.45 && !nearSolid({ x, z }, 0.2) && brookDepth(FAR_BROOK, x, z) === 0,
};

/** Trees round the meadow, with a gap past the bridge, widening away from it, for the view you arrive to. */
const FAR_RING: TreeRing = {
  seed: 17,
  count: 48,
  inner: 18.5,
  depth: 8,
  height: farHeight,
  clearing: (x, z) => {
    const past = toLocal(FAR_BRIDGE, x, z);
    return past.z > -1 && Math.abs(past.x) < 2.4 + Math.max(0, past.z) * 0.6;
  },
};

/**
 * The far garden: an open meadow over the bridge, under the same sky as the
 * garden, with a signpost in the middle and five entrances round it.
 */
export default function FarGardenZone() {
  return (
    <>
      <fog attach="fog" args={["#262a4e", 18, 66]} />
      <Sky />
      <Lights />
      <Ground terrain={FAR_TERRAIN} />
      <Grass field={FAR_FIELD} />
      <Trees ring={FAR_RING} />
      <BrookWater brook={FAR_BROOK} height={farHeight} />
      <Bridge span={FAR_BRIDGE} tag="The bridge" note="back to the garden" onSelect={() => takeExit("far-garden", "bridge")} />
      <SteppingStones runs={FAR_PATHS} height={farHeight} seed={19} />
      <Signpost />
      <Entrances />
      <PropHoverLight />
      <FarCamera />
    </>
  );
}

/**
 * Over the bridge: high above the near edge, looking across the whole meadow,
 * from you at the bridge to the top of the lighthouse at the far side.
 */
const OVERVIEW = { target: new THREE.Vector3(0, 0.5, 2.2), offset: new THREE.Vector3(0, 11.5, 21.8) };

/**
 * The far garden's camera: arriving over the bridge, an overview of the whole
 * meadow; back out of one of its places, out in front of you, looking back at
 * the doorway you came through. After that it's free to turn, and follows you
 * as you walk.
 */
function FarCamera() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const aspect = useThree((s) => s.size.width / s.size.height);
  const controls = useRef<OrbitControlsImpl>(null!);
  const pull = portraitPull(aspect);

  useEffect(() => fitFov(camera, aspect), [camera, aspect]);

  useLayoutEffect(() => {
    const { spawns } = ZONES["far-garden"];
    const arrival = useZone.getState().arrival;
    const spawn = arrival && arrival !== "bridge" ? spawns[arrival as keyof typeof spawns] : null;
    const pose = spawn
      ? arrivalPose({ ...spawn, yaw: spawn.yaw + Math.PI }, farHeight, 5.5, 3.4, camera.aspect)
      : // Backed off less than usual on tall screens: their wider view does the rest.
        { target: OVERVIEW.target.clone(), position: OVERVIEW.target.clone().addScaledVector(OVERVIEW.offset, THREE.MathUtils.lerp(1, portraitPull(camera.aspect), 0.5)) };
    camera.position.copy(pose.position);
    controls.current.target.copy(pose.target);
    camera.lookAt(pose.target);
    controls.current.update();
  }, [camera]);

  useFrame((_, delta) => keepPlayerInView(camera, controls.current, delta));

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
      maxDistance={25 * pull}
      minPolarAngle={0.5}
      maxPolarAngle={1.32}
    />
  );
}
