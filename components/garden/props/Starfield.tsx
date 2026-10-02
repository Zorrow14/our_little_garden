"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { sharedUniforms } from "@/lib/growth";
import { STARGAZE } from "@/lib/props";
import { night } from "@/lib/stargazing";
import { createRandom } from "@/lib/terrain";

const RADIUS = 70;
const SCATTERED = 2200;
/** Stars crowded along the Milky Way, and soft haze points behind them. */
const BAND = 2600;
const HAZE = 160;

const vertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aSeed;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uAmount;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    float twinkle = 0.7 + 0.3 * sin(uTime * (1.3 + aSeed * 3.0) + aSeed * 40.0);
    vAlpha = uAmount * mix(twinkle, 1.0, step(4.0, aSize));
    vColor = aColor;
    gl_PointSize = aSize * uPixelRatio * (0.5 + 0.5 * uAmount);
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vColor * a * vAlpha, 1.0);
  }
`;

/** A random direction above the horizon, more of them high up than low down. */
function skyward(rand: () => number, out: THREE.Vector3) {
  const y = 0.03 + Math.pow(rand(), 0.8) * 0.97;
  const a = rand() * Math.PI * 2;
  const r = Math.sqrt(1 - y * y);
  return out.set(Math.cos(a) * r, y, Math.sin(a) * r);
}

/**
 * The night sky over the stargazing hill: thousands of twinkling stars, a
 * Milky Way arching across, and now and then a shooting star. It fades in with
 * `night.amount`, so it's invisible (and nearly free) the rest of the time.
 */
export default function Starfield() {
  const gl = useThree((s) => s.gl);

  const { geometry, material } = useMemo(() => {
    const rand = createRandom(71);
    const count = SCATTERED + BAND + HAZE;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const seeds = new Float32Array(count);
    const v = new THREE.Vector3();
    const tint = new THREE.Color();
    // The band is a great circle slanting across the sky you see from the hill: low on one side, high on the other.
    const ahead = new THREE.Vector3(STARGAZE.look.x, 0, STARGAZE.look.z);
    const aside = new THREE.Vector3(-ahead.z, 0, ahead.x);
    const across = ahead.clone().multiplyScalar(0.75).addScaledVector(aside, 0.65).setY(0.12).normalize();
    const up = ahead.clone().multiplyScalar(0.45).addScaledVector(aside, -0.35).setY(0.85).normalize();
    const normal = new THREE.Vector3().crossVectors(across, up).normalize();
    const along = new THREE.Vector3().crossVectors(normal, across).normalize();

    for (let i = 0; i < count; i++) {
      if (i < SCATTERED) {
        skyward(rand, v);
        sizes[i] = 1.5 + Math.pow(rand(), 6) * 3.8;
        tint.setHSL(rand() < 0.2 ? 0.08 : 0.6, 0.5, 0.82 + rand() * 0.15);
      } else {
        // Along the band, thickest in the middle.
        const t = rand() * Math.PI * 2;
        const spread = (rand() + rand() + rand() - 1.5) * (i < SCATTERED + BAND ? 0.16 : 0.22);
        v.copy(across).multiplyScalar(Math.cos(t)).addScaledVector(along, Math.sin(t)).addScaledVector(normal, spread).normalize();
        if (v.y < 0.02) v.y = -v.y + 0.02;
        if (i < SCATTERED + BAND) {
          sizes[i] = 1.1 + Math.pow(rand(), 5) * 2.4;
          tint.setHSL(0.62, 0.35, 0.8 + rand() * 0.15);
        } else {
          sizes[i] = 26 + rand() * 30;
          tint.setHSL(0.7 + rand() * 0.08, 0.5, 0.5).multiplyScalar(0.11);
        }
      }
      v.normalize().multiplyScalar(RADIUS);
      positions.set([v.x, v.y, v.z], i * 3);
      tint.toArray(colors, i * 3);
      seeds[i] = rand();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: { uTime: sharedUniforms.uTime, uAmount: { value: 0 }, uPixelRatio: { value: 1 } },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { geometry: g, material: m };
  }, []);

  const points = useRef<THREE.Points>(null!);
  const meteor = useMeteor();

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame((state) => {
    material.uniforms.uAmount.value = night.amount;
    material.uniforms.uPixelRatio.value = gl.getPixelRatio();
    // Hidden entirely while it's the usual dusk.
    points.current.visible = night.amount > 0.01;
    // Keep the sky centred on the camera, so it never seems close.
    points.current.position.copy(state.camera.position);
    meteor.update(state.clock.elapsedTime, state.camera.position);
  });

  return (
    <>
      <points ref={points} geometry={geometry} material={material} frustumCulled={false} renderOrder={-0.5} />
      <primitive object={meteor.line} />
    </>
  );
}

/** A shooting star every few seconds while the stars are out: a short bright streak that fades as it falls. */
function useMeteor() {
  const meteor = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
    // Bright at the head, nothing at the tail (with additive blending, black is invisible).
    geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array([1, 1, 1, 0, 0, 0]), 3));
    const material = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const line = new THREE.Line(geometry, material);
    line.frustumCulled = false;
    line.visible = false;
    const rand = createRandom(83);
    const from = new THREE.Vector3();
    const dir = new THREE.Vector3();
    let startedAt = -Infinity;
    let nextAt = 0;
    const DURATION = 0.9;

    const update = (t: number, camera: THREE.Vector3) => {
      if (night.amount < 0.6) {
        line.visible = false;
        nextAt = Math.max(nextAt, t + 1.5);
        return;
      }
      if (t >= nextAt && t - startedAt > DURATION) {
        // Somewhere fairly high, heading down and across.
        skyward(rand, from);
        from.y = Math.max(from.y, 0.35);
        from.normalize().multiplyScalar(RADIUS * 0.9);
        dir.set(rand() - 0.5, -0.35 - rand() * 0.3, rand() - 0.5).normalize();
        startedAt = t;
        nextAt = t + 3 + rand() * 5;
      }
      const k = (t - startedAt) / DURATION;
      line.visible = k >= 0 && k < 1;
      if (!line.visible) return;
      const head = from.clone().addScaledVector(dir, 16 * k).add(camera);
      const tail = head.clone().addScaledVector(dir, -6 * Math.min(1, k * 3));
      const p = geometry.attributes.position as THREE.BufferAttribute;
      p.setXYZ(0, head.x, head.y, head.z);
      p.setXYZ(1, tail.x, tail.y, tail.z);
      p.needsUpdate = true;
      material.opacity = Math.sin(k * Math.PI) * night.amount;
    };
    return { line, update, geometry, material };
  }, []);

  useEffect(
    () => () => {
      meteor.geometry.dispose();
      meteor.material.dispose();
    },
    [meteor],
  );
  return meteor;
}
