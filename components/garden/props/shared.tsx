"use client";

import { Html, useCursor } from "@react-three/drei";
import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import FlowerTag from "@/components/ui/FlowerTag";
import { useGardenStore } from "@/lib/gardenStore";
import { withGrowth } from "@/lib/growth";
import { useKeepsakes } from "@/lib/keepsakes";
import { getGlowTexture } from "@/lib/textures";
import { useZone } from "@/lib/zones";

export const NO_RAYCAST = () => null;

/** Whether the garden's props can be clicked right now: nothing else open, not on the way through a door. */
export function useCanTouchProps() {
  const free = useGardenStore((s) => s.stage === "garden" && !s.activeId && !s.celebrating);
  const panelClosed = useKeepsakes((s) => s.open === null);
  const settled = useZone((s) => s.leaving === null);
  return free && panelClosed && settled;
}

/**
 * One warm light for whichever prop is hovered, moved to it, rather than a
 * light per prop: every light costs every lit material in the garden, even
 * switched off.
 */
const hoverLight = { at: new THREE.Vector3(), level: 0, owner: null as object | null };

export function PropHoverLight() {
  const lamp = useRef<THREE.PointLight>(null!);
  useFrame(() => {
    lamp.current.position.copy(hoverLight.at);
    lamp.current.intensity = hoverLight.level * 3;
  });
  return <pointLight ref={lamp} color="#ffe2b0" intensity={0} distance={3.2} decay={1.4} />;
}

/**
 * Wraps a clickable prop: a soft pool of light on the ground under it that
 * breathes faintly and brightens on hover, the shared hover light brought over
 * it, and the paper tag the flowers and the cottage door use.
 */
export function PropHover({
  tag,
  note,
  tagAt,
  pool,
  light,
  onSelect,
  children,
}: {
  tag: string;
  /** The tag's second line; a function is asked afresh each time it's hovered. */
  note?: string | (() => string | undefined);
  /** In the parent's space: the tag, the middle of the light pool (and its size), and the hover light. */
  tagAt: [number, number, number];
  pool: { at: [number, number, number]; size: number };
  light: [number, number, number];
  onSelect: () => void;
  children: ReactNode;
}) {
  const canTouch = useCanTouchProps();
  const [hovered, setHovered] = useState(false);
  useCursor(hovered && canTouch);
  const glow = useRef<THREE.MeshBasicMaterial>(null!);
  const lampAt = useRef<THREE.Object3D>(null!);
  const level = useRef(0);
  const self = useMemo(() => ({}), []);
  const phase = useMemo(() => Math.random() * Math.PI * 2, []);

  useFrame(({ clock }, delta) => {
    level.current = THREE.MathUtils.damp(level.current, hovered && canTouch ? 1 : 0, 8, delta);
    const breathe = (Math.sin(clock.elapsedTime * 1.4 + phase) + 1) / 2;
    glow.current.opacity = 0.06 + breathe * 0.05 + level.current * 0.4;
    // Take the hover light while brightening (or brighter than whoever has it); let it go once faded.
    if (level.current > 0.002 && (hoverLight.owner === self || level.current >= hoverLight.level)) {
      hoverLight.owner = self;
      hoverLight.level = level.current;
      lampAt.current.getWorldPosition(hoverLight.at);
    } else if (hoverLight.owner === self) {
      hoverLight.owner = null;
      hoverLight.level = 0;
    }
  });

  const select = (e: ThreeEvent<MouseEvent>) => {
    // Ignore the release at the end of a drag to look around.
    if (!canTouch || e.delta > 8) return;
    e.stopPropagation();
    // The tag would be out of date (sat down, stars out), so drop it until the pointer comes back.
    setHovered(false);
    onSelect();
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
      <mesh position={pool.at} rotation-x={-Math.PI / 2} raycast={NO_RAYCAST}>
        <planeGeometry args={[pool.size, pool.size]} />
        <meshBasicMaterial
          ref={glow}
          map={getGlowTexture()}
          color="#ffd9a0"
          transparent
          opacity={0.08}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <object3D ref={lampAt} position={light} />
      {children}
      {hovered && canTouch && (
        <Html position={tagAt} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
          <FlowerTag text={tag} note={typeof note === "function" ? note() : note} />
        </Html>
      )}
    </group>
  );
}

export interface Part {
  geometry: THREE.BufferGeometry;
  material: string;
  position: [number, number, number];
  rotation?: [number, number, number];
}

/** Low-poly, flat-shaded and muted with the rest of the garden until it grows: the scenery's usual material. */
export const matte = (color: string) => withGrowth(new THREE.MeshLambertMaterial({ color, flatShading: true }));

/**
 * Merges a prop's static pieces into one mesh per material, as the cottage
 * does, so each prop costs a draw call or two rather than dozens.
 */
export function useMergedParts(build: () => Part[], palette: Record<string, string>) {
  const materials = useMemo(() => {
    const all: Record<string, THREE.Material> = {};
    for (const [key, color] of Object.entries(palette)) all[key] = matte(color);
    return all;
    // The palette is a constant per prop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const meshes = useMemo(() => {
    const byMaterial = new Map<string, THREE.BufferGeometry[]>();
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (const part of build()) {
      q.setFromEuler(new THREE.Euler(...(part.rotation ?? [0, 0, 0])));
      m.compose(new THREE.Vector3(...part.position), q, new THREE.Vector3(1, 1, 1));
      // Merging needs every piece in the same (non-indexed) form.
      const g = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry;
      if (g !== part.geometry) part.geometry.dispose();
      g.applyMatrix4(m);
      byMaterial.set(part.material, [...(byMaterial.get(part.material) ?? []), g]);
    }
    return [...byMaterial].map(([material, geometries]) => {
      const merged = mergeGeometries(geometries)!;
      geometries.forEach((g) => g.dispose());
      return { material, geometry: merged };
    });
    // The parts are a constant per prop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => () => {
      meshes.forEach((m) => m.geometry.dispose());
      Object.values(materials).forEach((m) => m.dispose());
    },
    [meshes, materials],
  );

  return meshes.map(({ material, geometry }) => <mesh key={material} geometry={geometry} material={materials[material]} />);
}

export const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);

/** A cylinder from `a` to `b`, as a geometry already in place (for branches and ropes). */
export function rod(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number, sides = 6) {
  const length = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r1, r0, length, sides);
  g.translate(0, length / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
  g.translate(a.x, a.y, a.z);
  return g;
}
