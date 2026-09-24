import type * as THREE from "three";

/**
 * Live garden values shared by the scene. GrowthDriver writes them every frame
 * and components read them inside useFrame, so animating them never re-renders React.
 */
export const garden = {
  /** 0 before any letter is opened, 1 once all six are. Eases toward its target. */
  growth: 0,
};

/** Uniforms shared by reference across materials, so one write updates all of them. */
export const sharedUniforms = {
  uTime: { value: 0 },
  /** 1 = full colour. The garden starts muted and saturates as it grows. */
  uSaturation: { value: 1 },
  uWind: { value: 0 },
};

/** Pulls the final fragment colour toward grey by (1 - uSaturation). */
export const SATURATION_GLSL = /* glsl */ `
  gl_FragColor.rgb = mix(vec3(dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722))), gl_FragColor.rgb, uSaturation);
`;

/**
 * Fades each instance out as the camera comes within `far` units of it (fully gone
 * inside `near`), so orbiting never clips through a tree. It drops a growing share
 * of pixels in a fine dither pattern rather than blending, so nothing needs sorting.
 * Apply after withGrowth.
 */
export function withCameraFade<T extends THREE.Material>(material: T, near: number, far: number): T {
  const previousPatch = material.onBeforeCompile.bind(material);
  const previousKey = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    previousPatch(shader, renderer);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying float vCameraFade;")
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>
        #ifdef USE_INSTANCING
          vec3 fadeCenter = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        #else
          vec3 fadeCenter = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        #endif
        vCameraFade = smoothstep(${near.toFixed(2)}, ${far.toFixed(2)}, distance(fadeCenter.xz, cameraPosition.xz));`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vCameraFade;")
      .replace(
        "#include <clipping_planes_fragment>",
        `#include <clipping_planes_fragment>
        if (vCameraFade < fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))))) discard;`,
      );
  };
  // Keep this program apart from materials that share the base patch but not the fade.
  material.customProgramCacheKey = () => `${previousKey}|camera-fade:${near}:${far}`;
  return material;
}

/** Makes a built-in material follow the garden's growth saturation. */
export function withGrowth<T extends THREE.Material>(material: T): T {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSaturation = sharedUniforms.uSaturation;
    shader.fragmentShader =
      "uniform float uSaturation;\n" +
      shader.fragmentShader.replace(
        "#include <dithering_fragment>",
        `#include <dithering_fragment>\n${SATURATION_GLSL}`,
      );
  };
  return material;
}
