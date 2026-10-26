"use client";

import { Html, useCursor } from "@react-three/drei";
import { type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useCanTouchProps } from "@/components/garden/props/shared";
import FlowerTag from "@/components/ui/FlowerTag";
import { zoneDefinition } from "@/components/zones/registry";
import type { Festival } from "@/lib/festivals";
import { type FestivalLamp, useLamps } from "@/lib/festivalLamps";
import { sharedUniforms } from "@/lib/growth";
import { distanceToPond, POND, WATER_Y } from "@/lib/terrain";
import { glowMaterial, haloGeometry, haloMaterial, setGlowAttributes, viewportHeight } from "./materials";

/**
 * The lamps you've each lit: little clay oil lamps, each with a flame that
 * flickers on its own, standing where you lit it (or floating, if that was on
 * the pond). One just lit kindles as it appears. Hover or tap one for who lit
 * it, and what for.
 */

const CLAY = "#b4674a";
/** The wick sits a little off the middle, toward the lip. */
const WICK = 0.03;

/** Where a lamp sits: on the ground, or afloat on the pond. */
function lampAt(l: FestivalLamp) {
  const afloat = distanceToPond(l.x, l.z) < POND.radius - 0.15;
  const y = afloat ? WATER_Y + 0.005 : zoneDefinition("garden").ground.height(l.x, l.z);
  return { at: new THREE.Vector3(l.x, y, l.z), afloat };
}

/** A small clay lamp: a shallow bowl with a lip, and a pinched spout where the wick sits. */
function bowlGeometry() {
  const profile = [
    [0.0, 0.0],
    [0.05, 0.0],
    [0.075, 0.025],
    [0.085, 0.05],
    [0.078, 0.055],
    [0.06, 0.035],
    [0.0, 0.035],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(profile, 9);
}

export default function Lamps({ festival }: { festival: Festival }) {
  const lamps = useLamps((s) => s.lamps);
  const fresh = useLamps((s) => s.fresh);
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const canTouch = useCanTouchProps();
  const [picked, setPicked] = useState<{ id: string; pinned: boolean } | null>(null);
  useCursor(!!picked && canTouch);

  /** When each lamp was first seen here, on the scene clock, so a new one kindles. */
  const born = useRef(new Map<string, number>());
  const placed = useMemo(
    () =>
      lamps.map((l) => {
        if (!born.current.has(l.id)) born.current.set(l.id, fresh.has(l.id) ? sharedUniforms.uTime.value : -10);
        return { lamp: l, ...lampAt(l), born: born.current.get(l.id)! };
      }),
    [lamps, fresh],
  );

  const parts = useMemo(() => {
    const flameColor = new THREE.Color(festival.theme.glow[0]);
    const bowl = bowlGeometry();
    const flame = new THREE.ConeGeometry(0.02, 0.075, 6).translate(0, 0.0375, 0);
    setGlowAttributes(flame, placed.map(() => flameColor), placed.map((p) => (p.lamp.x * 7.3 + p.lamp.z * 3.1) % 1));
    flame.setAttribute("aBorn", new THREE.InstancedBufferAttribute(new Float32Array(placed.map((p) => p.born)), 1));
    const halos = haloGeometry(
      placed.map((p) => ({ at: p.at.clone().setY(p.at.y + 0.1), color: flameColor, size: p.afloat ? 0.75 : 0.65, seed: (p.lamp.x * 7.3 + p.lamp.z * 3.1) % 1 })),
    );
    halos.setAttribute("aBorn", new THREE.BufferAttribute(new Float32Array(placed.map((p) => p.born)), 1));
    return {
      bowl,
      flame,
      halos,
      hit: new THREE.SphereGeometry(0.26, 6, 4),
      bowlMaterial: new THREE.MeshLambertMaterial({ color: CLAY, emissive: "#ff9a5a", emissiveIntensity: 0.25, flatShading: true }),
      flameMaterial: kindling(glowMaterial({ flicker: 0.55, flame: true })),
      haloMaterial: kindling(haloMaterial(0.45)),
    };
  }, [placed, festival]);
  useEffect(() => () => Object.values(parts).forEach((p) => p.dispose()), [parts]);
  useEffect(() => {
    parts.haloMaterial.uniforms.uViewport.value = viewportHeight(gl);
  }, [gl, size, parts]);

  const bowls = useRef<THREE.InstancedMesh>(null!);
  const flames = useRef<THREE.InstancedMesh>(null!);
  const hits = useRef<THREE.InstancedMesh>(null!);
  useLayoutEffect(() => {
    if (placed.length === 0) return;
    const m = new THREE.Object3D();
    placed.forEach((p, i) => {
      m.position.copy(p.at);
      m.updateMatrix();
      bowls.current.setMatrixAt(i, m.matrix);
      m.position.set(p.at.x + WICK, p.at.y + 0.05, p.at.z);
      m.updateMatrix();
      flames.current.setMatrixAt(i, m.matrix);
      m.position.set(p.at.x, p.at.y + 0.15, p.at.z);
      m.updateMatrix();
      hits.current.setMatrixAt(i, m.matrix);
    });
    for (const mesh of [bowls.current, flames.current, hits.current]) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [placed]);

  // Lamps on the pond bob gently.
  useFrame(({ clock }) => {
    if (!bowls.current || !placed.some((p) => p.afloat)) return;
    const m = new THREE.Matrix4();
    placed.forEach((p, i) => {
      if (!p.afloat) return;
      const bob = Math.sin(clock.elapsedTime * 1.3 + i) * 0.008;
      m.makeTranslation(p.at.x, p.at.y + bob, p.at.z);
      bowls.current.setMatrixAt(i, m);
      m.makeTranslation(p.at.x + WICK, p.at.y + 0.05 + bob, p.at.z);
      flames.current.setMatrixAt(i, m);
    });
    bowls.current.instanceMatrix.needsUpdate = true;
    flames.current.instanceMatrix.needsUpdate = true;
  });

  const lampFor = (e: ThreeEvent<PointerEvent | MouseEvent>) => (e.instanceId === undefined ? null : placed[e.instanceId]);
  const shown = picked && placed.find((p) => p.lamp.id === picked.id);

  // A tapped lamp's tag stays a few seconds; a hovered one, while hovered.
  useEffect(() => {
    if (!picked?.pinned) return;
    const timer = setTimeout(() => setPicked(null), 4500);
    return () => clearTimeout(timer);
  }, [picked]);

  if (placed.length === 0) return null;
  return (
    <>
      <instancedMesh key={`b${placed.length}`} ref={bowls} args={[parts.bowl, parts.bowlMaterial, placed.length]} />
      <instancedMesh key={`f${placed.length}`} ref={flames} args={[parts.flame, parts.flameMaterial, placed.length]} frustumCulled={false} />
      <points geometry={parts.halos} material={parts.haloMaterial} frustumCulled={false} />
      {/* Invisible, generous targets for hovering or tapping a lamp. */}
      <instancedMesh
        key={`h${placed.length}`}
        ref={hits}
        args={[parts.hit, undefined, placed.length]}
        visible={false}
        onPointerOver={(e) => {
          const p = lampFor(e);
          if (!p || !canTouch) return;
          e.stopPropagation();
          setPicked((now) => (now?.pinned ? now : { id: p.lamp.id, pinned: false }));
        }}
        onPointerOut={() => setPicked((now) => (now?.pinned ? now : null))}
        onClick={(e) => {
          const p = lampFor(e);
          if (!p || !canTouch || e.delta > 8) return;
          e.stopPropagation();
          setPicked({ id: p.lamp.id, pinned: true });
        }}
      />
      {shown && canTouch && (
        <Html position={[shown.at.x, shown.at.y + 0.55, shown.at.z]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
          <FlowerTag text={`Lit by ${shown.lamp.lit_by}`} note={shown.lamp.dedication ?? undefined} />
        </Html>
      )}
    </>
  );
}

/** Makes a flame or halo material kindle from nothing over its first moments (by the `aBorn` attribute). */
function kindling<T extends THREE.ShaderMaterial>(material: T): T {
  material.vertexShader = material.vertexShader
    .replace("void main() {", "attribute float aBorn;\nvarying float vKindle;\nvoid main() {\n  vKindle = smoothstep(aBorn, aBorn + 1.2, uTime);")
    .replace("vec3 p = position;", "vec3 p = position * vKindle;");
  material.fragmentShader = material.fragmentShader
    .replace("void main() {", "varying float vKindle;\nvoid main() {")
    .replace("gl_FragColor = vec4(c, uAmount);", "gl_FragColor = vec4(c, uAmount * vKindle);")
    .replace("* uAmount, 1.0);", "* uAmount * vKindle, 1.0);");
  return material;
}
