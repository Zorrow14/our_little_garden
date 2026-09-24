"use client";

import { Html, Sparkles, useCursor } from "@react-three/drei";
import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { type ReactNode, type RefObject, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { FlowerSpec, PetalLayer } from "@/lib/flowerSpecs";
import { garden, sharedUniforms } from "@/lib/growth";
import { createPetalGeometry } from "@/lib/petal";
import { createRandom, hashString } from "@/lib/terrain";
import { getGlowTexture } from "@/lib/textures";

/** locked: the final bloom before the other letters are read. waiting: letter unread. bloomed: letter read. */
export type FlowerStatus = "locked" | "waiting" | "bloomed";

interface FlowerProps {
  id: string;
  spec: FlowerSpec;
  position: [number, number, number];
  scale?: number;
  /** Offset from looking straight at the viewer, in radians. */
  facing?: number;
  status?: FlowerStatus;
  /** Pulses the pool of light beneath the flower to draw the eye to it. */
  beckon?: boolean;
  hovered?: boolean;
  interactive?: boolean;
  onHover?: (id: string) => void;
  onHoverEnd?: (id: string) => void;
  onSelect?: (id: string) => void;
  /** Shown above the flower head while it's hovered. */
  label?: ReactNode;
}

function targetOpenness(spec: FlowerSpec, status: FlowerStatus) {
  if (status === "locked") return 0.04 + 0.32 * garden.growth;
  return status === "bloomed" ? 1 : spec.restOpenness;
}

function glowLevel(spec: FlowerSpec, status: FlowerStatus) {
  if (status === "locked") return 0.05 + 0.2 * garden.growth;
  if (status === "bloomed") return 0.7;
  return spec.center === "orb" ? 1 : 0.35;
}

export default function Flower({
  id,
  spec,
  position,
  scale = 1,
  facing = 0,
  status = "waiting",
  beckon = false,
  hovered = false,
  interactive = false,
  onHover,
  onHoverEnd,
  onSelect,
  label,
}: FlowerProps) {
  const root = useRef<THREE.Group>(null!);
  const pool = useRef<THREE.Mesh>(null!);
  const light = useRef<THREE.PointLight>(null);
  // Start at the resting state so a reload shows bloomed flowers without replaying the bloom.
  const openness = useRef(targetOpenness(spec, status));
  const glow = useRef(glowLevel(spec, status));
  const hover = useRef(0);
  /** Heading around the vertical axis; eases toward the camera so the flower faces her from any side. */
  const yaw = useRef<number | null>(null);

  const seed = useMemo(() => hashString(id), [id]);
  const phase = useMemo(() => createRandom(seed)() * Math.PI * 2, [seed]);
  const floating = spec.stemHeight === 0;

  const stemCurve = useMemo(
    () =>
      floating
        ? null
        : new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(spec.stemBend * 0.5, spec.stemHeight * 0.35, 0),
            new THREE.Vector3(spec.stemBend, spec.stemHeight * 0.7, 0),
            new THREE.Vector3(spec.stemBend * 0.6, spec.stemHeight, 0),
          ]),
    [floating, spec.stemBend, spec.stemHeight],
  );
  const head = useMemo(() => (stemCurve ? stemCurve.getPoint(1) : new THREE.Vector3(0, 0.04, 0)), [stemCurve]);

  const petalMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        roughness: 0.55,
        emissive: new THREE.Color(spec.glow),
        emissiveIntensity: 0.1,
      }),
    [spec.glow],
  );
  const poolMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: getGlowTexture(),
        color: spec.glow,
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [spec.glow],
  );
  useEffect(
    () => () => {
      petalMaterial.dispose();
      poolMaterial.dispose();
    },
    [petalMaterial, poolMaterial],
  );

  useCursor(hovered && interactive);

  // Turn first, then sway, so the sway stays relative to the way the flower is facing.
  useLayoutEffect(() => {
    root.current.rotation.order = "YXZ";
  }, []);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    openness.current = THREE.MathUtils.damp(openness.current, targetOpenness(spec, status), 0.9, dt);
    glow.current = THREE.MathUtils.damp(glow.current, glowLevel(spec, status), 1.2, dt);
    hover.current = THREE.MathUtils.damp(hover.current, hovered && interactive ? 1 : 0, 10, dt);

    const r = root.current;
    r.scale.setScalar(scale * (1 + hover.current * 0.06));

    // Slowly turn toward the viewer, the way flowers follow the sun.
    const toCamera = Math.atan2(state.camera.position.x - position[0], state.camera.position.z - position[2]) + facing;
    if (yaw.current === null) {
      yaw.current = toCamera;
    } else {
      const shortestTurn = Math.atan2(Math.sin(toCamera - yaw.current), Math.cos(toCamera - yaw.current));
      yaw.current += shortestTurn * (1 - Math.exp(-1.5 * dt));
    }
    r.rotation.y = yaw.current;
    if (floating) {
      r.position.y = position[1] + Math.sin(t * 0.9 + phase) * 0.012;
      r.rotation.z = Math.sin(t * 0.7 + phase) * 0.02;
    } else {
      const wind = sharedUniforms.uWind.value;
      r.rotation.z = Math.sin(t * 1.1 + phase) * 0.03 * wind;
      r.rotation.x = Math.sin(t * 0.8 + phase * 1.3) * 0.02 * wind;
    }

    const pulse = beckon ? 0.5 + 0.5 * Math.sin(t * 2.2) : 0;
    petalMaterial.emissiveIntensity = 0.12 + glow.current * 0.35 + hover.current * 0.3;
    poolMaterial.opacity = 0.1 + glow.current * 0.3 + hover.current * 0.25 + pulse * 0.4;
    if (light.current) light.current.intensity = glow.current * 3;
  });

  const handleOver = (e: ThreeEvent<PointerEvent>) => {
    if (!interactive) return;
    e.stopPropagation();
    onHover?.(id);
  };
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    // Ignore the release at the end of a drag to look around.
    if (!interactive || e.delta > 8) return;
    e.stopPropagation();
    onSelect?.(id);
  };

  const hitHeight = head.y + 0.6;
  const poolSize = spec.hitRadius * 3.4;

  return (
    <group ref={root} position={position}>
      <mesh
        visible={false}
        position={[head.x / 2, hitHeight / 2 - 0.1, 0]}
        onPointerOver={handleOver}
        onPointerOut={() => onHoverEnd?.(id)}
        onClick={handleClick}
      >
        <cylinderGeometry args={[spec.hitRadius, spec.hitRadius, hitHeight, 8]} />
      </mesh>

      <mesh ref={pool} material={poolMaterial} position-y={0.03} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[poolSize, poolSize]} />
      </mesh>

      {stemCurve ? (
        <Stem curve={stemCurve} spec={spec} phase={phase} />
      ) : (
        <mesh position-y={-0.012} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[0.62, 28, 0.3, Math.PI * 2 - 0.6]} />
          <meshLambertMaterial color="#2e5a39" side={THREE.DoubleSide} />
        </mesh>
      )}

      <group position={head} rotation-x={spec.headTilt}>
        {spec.layers.map((layer, i) => (
          <PetalRing key={i} layer={layer} material={petalMaterial} openness={openness} seed={seed + i} />
        ))}
        <Center spec={spec} lightRef={light} awake={status !== "locked"} />
      </group>

      {hovered && interactive && label && (
        <Html position={[head.x, head.y + 0.8, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
          {label}
        </Html>
      )}
    </group>
  );
}

function PetalRing({
  layer,
  material,
  openness,
  seed,
}: {
  layer: PetalLayer;
  material: THREE.Material;
  openness: RefObject<number>;
  seed: number;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const geometry = useMemo(() => createPetalGeometry(layer), [layer]);
  const jitter = useMemo(() => {
    const rand = createRandom(seed);
    return Array.from({ length: layer.count }, () => ({
      angle: (rand() - 0.5) * 0.12,
      tilt: (rand() - 0.5) * 0.1,
      scale: 0.92 + rand() * 0.16,
    }));
  }, [layer.count, seed]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const lastOpenness = useRef(-1);

  useEffect(() => () => geometry.dispose(), [geometry]);

  // Petal matrices only change while the flower is opening or closing.
  useFrame(() => {
    const o = openness.current;
    if (Math.abs(o - lastOpenness.current) < 0.0005) return;
    lastOpenness.current = o;
    const tilt = THREE.MathUtils.lerp(layer.closedTilt, layer.openTilt, o);
    for (let i = 0; i < layer.count; i++) {
      const j = jitter[i];
      const a = layer.twist + (i / layer.count) * Math.PI * 2 + j.angle;
      dummy.position.set(Math.sin(a) * layer.radius, layer.y, Math.cos(a) * layer.radius);
      dummy.rotation.set(tilt + j.tilt, a, 0, "YXZ");
      dummy.scale.setScalar(j.scale);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={mesh} args={[geometry, material, layer.count]} frustumCulled={false} />;
}

function Stem({ curve, spec, phase }: { curve: THREE.CatmullRomCurve3; spec: FlowerSpec; phase: number }) {
  const leaves = useRef<THREE.InstancedMesh>(null);
  const stemGeometry = useMemo(() => new THREE.TubeGeometry(curve, 16, 0.024, 5, false), [curve]);
  const leafGeometry = useMemo(
    () =>
      spec.leaves &&
      createPetalGeometry({
        length: spec.leaves.length,
        width: spec.leaves.width,
        cup: 0.3,
        curl: 0.3,
        tip: "pointed",
        baseColor: "#264a2a",
        tipColor: "#5a8646",
      }),
    [spec.leaves],
  );
  const leafMaterial = useMemo(() => new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), []);

  useLayoutEffect(() => {
    if (!spec.leaves || !leaves.current) return;
    const { count, spread, tilt } = spec.leaves;
    const m = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const along = count > 1 ? (i / (count - 1)) * spread * 0.8 : 0;
      m.position.copy(curve.getPoint(along));
      m.position.y += 0.02;
      m.rotation.set(tilt, i * 2.39996 + phase, 0, "YXZ");
      m.scale.setScalar(1 - 0.35 * along);
      m.updateMatrix();
      leaves.current.setMatrixAt(i, m.matrix);
    }
    leaves.current.instanceMatrix.needsUpdate = true;
  }, [curve, spec.leaves, phase]);

  useEffect(
    () => () => {
      stemGeometry.dispose();
      leafGeometry?.dispose();
      leafMaterial.dispose();
    },
    [stemGeometry, leafGeometry, leafMaterial],
  );

  return (
    <>
      <mesh geometry={stemGeometry}>
        <meshLambertMaterial color="#3d6a39" />
      </mesh>
      {leafGeometry && spec.leaves && (
        <instancedMesh ref={leaves} args={[leafGeometry, leafMaterial, spec.leaves.count]} frustumCulled={false} />
      )}
    </>
  );
}

function Center({
  spec,
  lightRef,
  awake,
}: {
  spec: FlowerSpec;
  lightRef: RefObject<THREE.PointLight | null>;
  /** False while the final bloom is still locked. */
  awake: boolean;
}) {
  const color = spec.centerColor;
  switch (spec.center) {
    case "pod":
      return (
        <group>
          <mesh position-y={0.05}>
            <cylinderGeometry args={[0.1, 0.075, 0.1, 18]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} roughness={0.6} />
          </mesh>
          <mesh position-y={0.075} rotation-x={-Math.PI / 2}>
            <torusGeometry args={[0.115, 0.022, 6, 24]} />
            <meshStandardMaterial color="#f8dc86" emissive="#f8dc86" emissiveIntensity={0.35} />
          </mesh>
        </group>
      );
    case "dome":
      return (
        <mesh position-y={0.01} scale-y={0.6}>
          <sphereGeometry args={[0.1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} roughness={0.8} />
        </mesh>
      );
    case "stamens":
      return <Stamens antherColor={color} />;
    case "column":
      return (
        <mesh position={[0, 0.05, 0.03]} rotation-x={0.4}>
          <capsuleGeometry args={[0.028, 0.07, 3, 8]} />
          <meshStandardMaterial color={color} roughness={0.5} />
        </mesh>
      );
    case "orb":
      return (
        <group position-y={0.08}>
          <mesh>
            <sphereGeometry args={[0.11, 20, 14]} />
            <meshBasicMaterial color={color} />
          </mesh>
          <sprite scale={0.9}>
            <spriteMaterial map={getGlowTexture()} color={color} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
          </sprite>
          <pointLight ref={lightRef} color="#ffd98a" intensity={0} distance={6} decay={1.6} />
          {awake && <Sparkles count={36} scale={[1.6, 1.4, 1.6]} position-y={0.25} size={3.5} speed={0.35} noise={0.6} color="#ffe3a0" />}
        </group>
      );
    default:
      return null;
  }
}

function Stamens({ antherColor }: { antherColor: string }) {
  const filaments = useRef<THREE.InstancedMesh>(null!);
  const anthers = useRef<THREE.InstancedMesh>(null!);
  const filamentGeometry = useMemo(() => new THREE.CylinderGeometry(0.006, 0.009, 0.42, 4).translate(0, 0.21, 0), []);
  const antherGeometry = useMemo(() => new THREE.CapsuleGeometry(0.016, 0.05, 2, 6), []);

  useLayoutEffect(() => {
    const m = new THREE.Object3D();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      m.position.set(0, 0, 0);
      m.rotation.set(0.38, a, 0, "YXZ");
      m.updateMatrix();
      filaments.current.setMatrixAt(i, m.matrix);
      m.position.set(0, 0.42, 0).applyEuler(m.rotation);
      m.rotation.set(0, a, Math.PI / 2, "YXZ");
      m.updateMatrix();
      anthers.current.setMatrixAt(i, m.matrix);
    }
    filaments.current.instanceMatrix.needsUpdate = true;
    anthers.current.instanceMatrix.needsUpdate = true;
  }, []);

  useEffect(
    () => () => {
      filamentGeometry.dispose();
      antherGeometry.dispose();
    },
    [filamentGeometry, antherGeometry],
  );

  return (
    <group>
      <instancedMesh ref={filaments} args={[filamentGeometry, undefined, 6]} frustumCulled={false}>
        <meshLambertMaterial color="#dbe9bd" />
      </instancedMesh>
      <instancedMesh ref={anthers} args={[antherGeometry, undefined, 6]} frustumCulled={false}>
        <meshStandardMaterial color={antherColor} emissive={antherColor} emissiveIntensity={0.2} roughness={0.7} />
      </instancedMesh>
      <mesh position-y={0.23}>
        <cylinderGeometry args={[0.008, 0.01, 0.46, 5]} />
        <meshLambertMaterial color="#cfe0a8" />
      </mesh>
    </group>
  );
}
