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
