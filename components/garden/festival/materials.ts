import * as THREE from "three";
import { festivalUniforms, GLOW_GLSL } from "./glow";

/**
 * The festival's few cheap materials. Nothing here is lit by, or costs, a real
 * light: lanterns, bulbs and flames glow by their own colour, flicker in the
 * shader, and pick up a firework's flash through `festivalUniforms`.
 *
 * Instanced geometry carries two attributes of its own: `aColor` (its glow
 * colour) and `aSeed` (0..1, so each flickers in its own time).
 */

/** A glowing instanced shape: string-light bulbs, paper lanterns, candle and lamp flames. */
export function glowMaterial({
  flicker = 0.3,
  /** Flames lick upward: the top of the shape stretches and sways. */
  flame = false,
  /** Paper lanterns: dark rims where the geometry's `color` attribute is dark, brightest in the middle. */
  paper = false,
  /** Lanterns sway a little on their strings. */
  sway = 0,
}: { flicker?: number; flame?: boolean; paper?: boolean; sway?: number } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { ...festivalUniforms },
    defines: { ...(flame ? { FLAME: "" } : {}), ...(paper ? { PAPER: "" } : {}) },
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aSeed;
      #ifdef PAPER
      attribute vec3 color;
      varying vec3 vMask;
      #endif
      varying vec3 vColor;
      varying float vBright;
      varying float vHeight;
      ${GLOW_GLSL}
      void main() {
        vec3 p = position;
        float t = uTime * (1.3 + aSeed * 1.7) + aSeed * 40.0;
        #ifdef FLAME
          float lick = 0.85 + 0.3 * sin(t * 3.1) * sin(t * 1.7 + 2.0);
          p.y *= lick;
          p.x += sin(t * 2.3) * 0.012 * max(p.y, 0.0) * 12.0;
        #endif
        vec4 world = modelMatrix * instanceMatrix * vec4(p, 1.0);
        world.xz += ${sway.toFixed(3)} * vec2(sin(uTime * 1.1 + aSeed * 6.0), cos(uTime * 0.9 + aSeed * 4.0));
        vColor = aColor;
        vBright = festivalBrightness(world.xyz, aSeed, ${flicker.toFixed(3)});
        vHeight = position.y;
        #ifdef PAPER
        vMask = color;
        #endif
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uAmount;
      varying vec3 vColor;
      varying float vBright;
      varying float vHeight;
      #ifdef PAPER
      varying vec3 vMask;
      #endif
      void main() {
        vec3 c = vColor * vBright;
        #ifdef PAPER
          // Rims stay dark; the paper glows warmest at its middle.
          c = mix(vec3(0.16, 0.11, 0.08), c * (1.05 - abs(vHeight) * 2.2), vMask.r);
        #endif
        #ifdef FLAME
          c = mix(vec3(1.0, 0.97, 0.85), c, smoothstep(0.0, 0.05, vHeight));
        #endif
        gl_FragColor = vec4(c, uAmount);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
  });
}

/** Sets the per-instance colour and seed attributes on an instanced geometry. */
export function setGlowAttributes(geometry: THREE.BufferGeometry, colors: THREE.Color[], seeds: number[]) {
  const color = new Float32Array(colors.length * 3);
  colors.forEach((c, i) => c.toArray(color, i * 3));
  geometry.setAttribute("aColor", new THREE.InstancedBufferAttribute(color, 3));
  geometry.setAttribute("aSeed", new THREE.InstancedBufferAttribute(new Float32Array(seeds), 1));
}

/**
 * Soft halos of light, one per point, sized in world units: round lanterns,
 * candles and lit windows. Additive, so they glow without lighting anything.
 * Each point has `position`, `aColor`, `aSize` and `aSeed`.
 */
export function haloMaterial(flicker = 0.35) {
  return new THREE.ShaderMaterial({
    uniforms: { ...festivalUniforms, uViewport: { value: 800 } },
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aSeed;
      uniform float uViewport;
      varying vec3 vColor;
      varying float vBright;
      ${GLOW_GLSL}
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vec4 view = viewMatrix * world;
        vColor = aColor;
        vBright = festivalBrightness(world.xyz, aSeed, ${flicker.toFixed(3)});
        // Brighter makes the halo a little bigger, but not much: it's the glow that should rise.
        gl_PointSize = min(aSize * (0.85 + 0.15 * vBright) * projectionMatrix[1][1] * uViewport * 0.5 / -view.z, 160.0);
        gl_Position = projectionMatrix * view;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uAmount;
      varying vec3 vColor;
      varying float vBright;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float glow = pow(max(0.0, 1.0 - d), 2.4);
        gl_FragColor = vec4(vColor * glow * 0.55 * min(vBright, 2.0) * uAmount, 1.0);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

export interface Halo {
  at: THREE.Vector3;
  color: THREE.Color;
  size: number;
  seed: number;
}

/** A points geometry for `halos`. */
export function haloGeometry(halos: Halo[]) {
  const g = new THREE.BufferGeometry();
  const position = new Float32Array(halos.length * 3);
  const color = new Float32Array(halos.length * 3);
  halos.forEach((h, i) => {
    h.at.toArray(position, i * 3);
    h.color.toArray(color, i * 3);
  });
  g.setAttribute("position", new THREE.BufferAttribute(position, 3));
  g.setAttribute("aColor", new THREE.BufferAttribute(color, 3));
  g.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(halos.map((h) => h.size)), 1));
  g.setAttribute("aSeed", new THREE.BufferAttribute(new Float32Array(halos.map((h) => h.seed)), 1));
  return g;
}

/** The drawing height in pixels, which the halo shader needs to size its points in world units. */
export function viewportHeight(gl: THREE.WebGLRenderer) {
  return gl.getDrawingBufferSize(new THREE.Vector2()).y;
}
