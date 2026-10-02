"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { withCameraFade, withGrowth } from "@/lib/growth";

export interface GardenerLook {
  /** Overall size. Skelly is a little smaller than Zorrow. */
  scale: number;
  build: "lean" | "petite";
  skin: string;
  hair: string;
  top: string;
  /** Trousers for a lean build, a skirt for a petite one. */
  bottom: string;
  shoes: string;
  hairStyle: "short-tousled" | "long-bangs";
  carry: "watering-can" | "basket";
  watch?: boolean;
  blush?: boolean;
}

/** The joints the walk, idle and greeting animations move. Filled in as the body mounts. */
export interface GardenerRig {
  bounce: THREE.Group;
  upper: THREE.Group;
  head: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  /** Whatever the carrying hand holds; tilted to pour or swung while walking. */
  prop: THREE.Group;
  /** The watering can's spout tip, where water pours from. */
  spout?: THREE.Object3D;
  /** Droplets falling from the spout while watering, positioned in the gardener's own space. */
  water?: THREE.Group;
  /** A petite build's skirt, which gathers up a little when they sit. */
  skirt?: THREE.Mesh;
}

export const DROPLET_COUNT = 5;

/** Proportions per build, in units before `scale`. The heads are big on purpose. */
const BUILDS = {
  lean: { hipY: 0.355, hipX: 0.075, legR: 0.052, legLen: 0.28, shoe: [0.1, 0.07, 0.17], shoulderY: 0.36, shoulderX: 0.175, sleeveR: 0.052, armR: 0.034, armLen: 0.22, headR: 0.19, headY: 0.65 },
  petite: { hipY: 0.315, hipX: 0.065, legR: 0.045, legLen: 0.25, shoe: [0.085, 0.06, 0.14], shoulderY: 0.31, shoulderX: 0.15, sleeveR: 0.046, armR: 0.03, armLen: 0.2, headR: 0.19, headY: 0.59 },
} as const;

/**
 * How far below a seat's top a sitting gardener's feet-level origin goes: their
 * hips rest just above the seat (a skirt needs a little more room than trousers).
 */
export function seatDrop(look: GardenerLook) {
  return (BUILDS[look.build].hipY - (look.build === "petite" ? 0.09 : 0.05)) * look.scale;
}

const BASKET_FLOWERS = [
  { color: "#f49ab6", at: [0.03, 0.02] },
  { color: "#ffe08a", at: [-0.035, 0.015] },
  { color: "#fff4ec", at: [0.0, -0.035] },
  { color: "#c7a2ef", at: [0.04, -0.03] },
  { color: "#f7b3c8", at: [-0.03, -0.02] },
] as const;

/** Tousled tufts across the top of a short haircut, as directions from the head's centre. */
const TUFTS = [
  [0, 1, 0.15, 1.1],
  [0.45, 0.85, 0.25, 0.9],
  [-0.45, 0.85, 0.2, 1],
  [0.3, 0.8, -0.5, 0.95],
  [-0.3, 0.82, -0.45, 1.05],
  [0.12, 0.72, 0.68, 0.85],
  [-0.2, 0.75, 0.62, 0.9],
] as const;

type Palette = ReturnType<typeof usePalette>;

/**
 * Flat-shaded matte materials, muted with the rest of the garden until it grows,
 * and fading out as one piece if the camera comes right up to the gardener.
 */
function usePalette(look: GardenerLook, fadeCenter: { value: THREE.Vector3 }) {
  const palette = useMemo(() => {
    const matte = (color: string, glow = 0.16) =>
      withCameraFade(
        withGrowth(new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: glow, flatShading: true })),
        0.6,
        1.7,
        fadeCenter,
      );
    return {
      skin: matte(look.skin),
      hair: matte(look.hair, 0.1),
      top: matte(look.top),
      bottom: matte(look.bottom),
      shoes: matte(look.shoes),
      eyes: matte("#1b1822", 0),
      blush: matte("#ec8f98", 0.3),
      clip: matte("#f3a5bb", 0.3),
      watchBand: matte("#18181d", 0),
      watchFace: withCameraFade(new THREE.MeshBasicMaterial({ color: "#86ead9" }), 0.6, 1.7, fadeCenter),
      can: matte("#6fa39b", 0.2),
      canDark: matte("#4c7a73", 0.15),
      water: withCameraFade(new THREE.MeshBasicMaterial({ color: "#b9dcff", transparent: true, opacity: 0.8 }), 0.6, 1.7, fadeCenter),
      wicker: matte("#b37b47"),
      wickerLight: matte("#cf9a63"),
      leaf: matte("#4f8a4a"),
      petals: BASKET_FLOWERS.map((f) => matte(f.color, 0.3)),
    };
  }, [look, fadeCenter]);

  useEffect(
    () => () => {
      Object.values(palette)
        .flat()
        .forEach((m) => m.dispose());
    },
    [palette],
  );
  return palette;
}

export default function GardenerBody({
  look,
  rig,
  fadeCenter,
}: {
  look: GardenerLook;
  rig: GardenerRig;
  fadeCenter: { value: THREE.Vector3 };
}) {
  const m = usePalette(look, fadeCenter);
  const b = BUILDS[look.build];
  const lean = look.build === "lean";
  const legLength = b.legLen + b.legR * 2;
  const handY = -(b.armLen + b.sleeveR * 2 + 0.04);
  // The character's left is +x, since it faces +z.
  const carryOnLeft = look.carry === "basket";

  const leg = (side: 1 | -1) => (
    <group
      ref={(g) => {
        if (g) rig[side === 1 ? "leftLeg" : "rightLeg"] = g;
      }}
      position={[side * b.hipX, b.hipY, 0]}
    >
      <mesh material={lean ? m.bottom : m.skin} position-y={-legLength / 2 + b.legR}>
        <capsuleGeometry args={[b.legR, b.legLen, 2, 7]} />
      </mesh>
      <mesh material={m.shoes} position={[0, -legLength + b.legR + b.shoe[1] / 2 - 0.02, 0.03]}>
        <boxGeometry args={b.shoe as unknown as [number, number, number]} />
      </mesh>
    </group>
  );

  const arm = (side: 1 | -1) => {
    const carries = (side === 1) === carryOnLeft;
    return (
      <group
        ref={(g) => {
          if (g) rig[side === 1 ? "leftArm" : "rightArm"] = g;
        }}
        position={[side * b.shoulderX, b.shoulderY, 0]}
        rotation-z={side * 0.1}
      >
        <mesh material={m.top} position-y={-0.04}>
          <capsuleGeometry args={[b.sleeveR, 0.05, 2, 7]} />
        </mesh>
        <mesh material={m.skin} position-y={handY / 2 + 0.01}>
          <capsuleGeometry args={[b.armR, b.armLen, 2, 6]} />
        </mesh>
        <group position-y={handY}>
          <mesh material={m.skin}>
            <sphereGeometry args={[b.armR + 0.008, 7, 5]} />
          </mesh>
          {look.watch && side === 1 && !carries && <Watch m={m} />}
          {carries && (
            <group
              ref={(g) => {
                if (g) rig.prop = g;
              }}
            >
              {look.carry === "watering-can" ? <WateringCan m={m} rig={rig} /> : <Basket m={m} />}
            </group>
          )}
        </group>
      </group>
    );
  };

  return (
    <>
      {look.carry === "watering-can" && (
        <group
          ref={(g) => {
            if (g) rig.water = g;
          }}
          visible={false}
        >
          {Array.from({ length: DROPLET_COUNT }, (_, i) => (
            <mesh key={i} material={m.water} scale={[1, 1.6, 1]}>
              <sphereGeometry args={[0.014, 5, 4]} />
            </mesh>
          ))}
        </group>
      )}
      <group
        ref={(g) => {
          if (g) rig.bounce = g;
        }}
      >
        {leg(1)}
        {leg(-1)}
        <group
          ref={(g) => {
            if (g) rig.upper = g;
          }}
          position-y={b.hipY}
        >
          {lean ? (
            <>
              <mesh material={m.bottom} position-y={0.03}>
                <cylinderGeometry args={[0.13, 0.135, 0.12, 8]} />
              </mesh>
              <mesh material={m.top} position-y={0.21} scale={[1, 1, 0.78]}>
                <capsuleGeometry args={[0.14, 0.2, 3, 8]} />
              </mesh>
            </>
          ) : (
            <>
              <mesh
                ref={(mesh) => {
                  if (mesh) rig.skirt = mesh;
                }}
                material={m.bottom}
                position-y={-0.05}
              >
                <cylinderGeometry args={[0.115, 0.21, 0.25, 9]} />
              </mesh>
              <mesh material={m.top} position-y={0.17} scale={[1, 1, 0.8]}>
                <capsuleGeometry args={[0.12, 0.15, 3, 8]} />
              </mesh>
            </>
          )}
          {arm(1)}
          {arm(-1)}
          <mesh material={m.skin} position-y={b.shoulderY + 0.07}>
            <cylinderGeometry args={[0.04, 0.045, 0.1, 6]} />
          </mesh>
          <group
            ref={(g) => {
              if (g) rig.head = g;
            }}
            position-y={b.headY}
          >
            <mesh material={m.skin}>
              <sphereGeometry args={[b.headR, 12, 9]} />
            </mesh>
            {([1, -1] as const).map((side) => (
              <mesh key={side} material={m.eyes} position={[side * 0.066, 0, b.headR * 0.93]} scale={[1, 1.15, 0.6]}>
                <sphereGeometry args={[0.021, 6, 5]} />
              </mesh>
            ))}
            {/* A small smile. */}
            <mesh material={m.eyes} position={[0, -0.062, b.headR * 0.95]} rotation={[-0.3, 0, Math.PI]}>
              <torusGeometry args={[0.032, 0.007, 3, 8, Math.PI]} />
            </mesh>
            {look.blush &&
              ([1, -1] as const).map((side) => (
                <mesh key={side} material={m.blush} position={[side * 0.108, -0.055, b.headR * 0.8]} scale={[1, 0.6, 0.4]}>
                  <sphereGeometry args={[0.032, 6, 5]} />
                </mesh>
              ))}
            {look.hairStyle === "short-tousled" ? <ShortHair m={m} r={b.headR} /> : <LongHair m={m} r={b.headR} />}
          </group>
        </group>
      </group>
    </>
  );
}

/** A cap of hair over the crown and back of the head, leaving the face clear. */
function HairCap({ m, r }: { m: Palette; r: number }) {
  return (
    <mesh material={m.hair} rotation-x={-0.55}>
      <sphereGeometry args={[r + 0.014, 12, 7, 0, Math.PI * 2, 0, Math.PI * 0.56]} />
    </mesh>
  );
}

function ShortHair({ m, r }: { m: Palette; r: number }) {
  return (
    <group>
      <HairCap m={m} r={r} />
      {TUFTS.map(([x, y, z, size], i) => {
        const direction = new THREE.Vector3(x, y, z).normalize().multiplyScalar(r + 0.005);
        return (
          <mesh key={i} material={m.hair} position={direction} rotation={[i * 1.3, i * 2.1, i * 0.7]} scale={size}>
            <icosahedronGeometry args={[0.068, 0]} />
          </mesh>
        );
      })}
    </group>
  );
}

function LongHair({ m, r }: { m: Palette; r: number }) {
  return (
    <group>
      <HairCap m={m} r={r} />
      {/* Falling past the shoulders at the back. */}
      <mesh material={m.hair} position={[0, -0.2, -0.075]} scale={[1.15, 1, 0.6]}>
        <capsuleGeometry args={[0.15, 0.26, 3, 8]} />
      </mesh>
      {([1, -1] as const).map((side) => (
        <mesh key={side} material={m.hair} position={[side * 0.165, -0.17, 0.02]}>
          <capsuleGeometry args={[0.05, 0.25, 2, 6]} />
        </mesh>
      ))}
      {/* Side-swept bangs across the forehead. */}
      <mesh material={m.hair} position={[0.035, 0.078, 0.148]} rotation={[0.52, 0, -0.5]} scale={[1.3, 0.5, 0.62]}>
        <sphereGeometry args={[0.125, 9, 6]} />
      </mesh>
      {/* A little flower clip. */}
      <mesh material={m.clip} position={[-0.155, 0.1, 0.095]}>
        <icosahedronGeometry args={[0.03, 0]} />
      </mesh>
    </group>
  );
}

function Watch({ m }: { m: Palette }) {
  return (
    <group position-y={0.055}>
      <mesh material={m.watchBand}>
        <cylinderGeometry args={[0.038, 0.038, 0.035, 8]} />
      </mesh>
      {/* The screen, on the outside of the wrist, softly lit. */}
      <mesh material={m.watchFace} position-x={0.037}>
        <boxGeometry args={[0.012, 0.03, 0.034]} />
      </mesh>
    </group>
  );
}

function WateringCan({ m, rig }: { m: Palette; rig: GardenerRig }) {
  return (
    <group>
      <mesh material={m.canDark} position-y={-0.055} rotation-y={Math.PI / 2}>
        <torusGeometry args={[0.055, 0.012, 5, 10, Math.PI]} />
      </mesh>
      <mesh material={m.can} position-y={-0.12}>
        <cylinderGeometry args={[0.068, 0.072, 0.13, 10]} />
      </mesh>
      <group position={[0, -0.14, 0.06]} rotation-x={0.95}>
        <mesh material={m.can} position-y={0.1}>
          <cylinderGeometry args={[0.009, 0.013, 0.2, 5]} />
        </mesh>
        <mesh material={m.canDark} position-y={0.205}>
          <cylinderGeometry args={[0.026, 0.011, 0.03, 7]} />
        </mesh>
        <object3D
          ref={(o) => {
            if (o) rig.spout = o;
          }}
          position-y={0.225}
        />
      </group>
    </group>
  );
}

function Basket({ m }: { m: Palette }) {
  return (
    <group scale={1.2}>
      <mesh material={m.wickerLight} position-y={-0.075} rotation-y={Math.PI / 2}>
        <torusGeometry args={[0.075, 0.01, 4, 10, Math.PI]} />
      </mesh>
      <mesh material={m.wicker} position-y={-0.118}>
        <cylinderGeometry args={[0.092, 0.072, 0.085, 10]} />
      </mesh>
      <mesh material={m.wickerLight} position-y={-0.077} rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.09, 0.011, 4, 12]} />
      </mesh>
      {BASKET_FLOWERS.map((f, i) => (
        <mesh key={i} material={m.petals[i]} position={[f.at[0], -0.07, f.at[1]]}>
          <icosahedronGeometry args={[0.027, 0]} />
        </mesh>
      ))}
      <mesh material={m.leaf} position={[0.05, -0.075, 0.035]} rotation={[0.4, 0.6, 0.5]} scale={[1, 0.35, 0.6]}>
        <sphereGeometry args={[0.035, 5, 4]} />
      </mesh>
    </group>
  );
}
