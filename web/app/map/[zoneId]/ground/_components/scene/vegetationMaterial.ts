import * as THREE from "three";

/** Shared uniforms of the canopy sway; one object drives every tree material. */
export interface SwayUniforms {
  uTime: { value: number };
  /** 0 disables the sway entirely (reduced motion). */
  uAmp: { value: number };
}

export function createSwayUniforms(amplitude: number): SwayUniforms {
  return { uTime: { value: 0 }, uAmp: { value: amplitude } };
}

/** Advance the sway clock (a plain function so the frame loop stays a call, not a mutation). */
export function setSwayTime(sway: SwayUniforms, seconds: number): void {
  sway.uTime.value = seconds;
}

/**
 * Lambert material for vertex-coloured, instance-tinted vegetation. With
 * `sway` set, vertices drift sideways in proportion to the square of their
 * height above the instance origin (trunk bases stay put, crowns move), out
 * of phase from tree to tree by the instance's world position.
 */
export function createVegetationMaterial(options: {
  doubleSided: boolean;
  sway?: SwayUniforms;
}): THREE.MeshLambertMaterial {
  const material = new THREE.MeshLambertMaterial({
    vertexColors: true,
    side: options.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
  });
  const sway = options.sway;
  if (sway) {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = sway.uTime;
      shader.uniforms.uAmp = sway.uAmp;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uTime;\nuniform float uAmp;")
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
float swayH = max(position.y, 0.0);
float swayA = uAmp * swayH * swayH * 0.0016;
#ifdef USE_INSTANCING
float swayPh = uTime * 1.1 + instanceMatrix[3].x * 0.23 + instanceMatrix[3].z * 0.19;
#else
float swayPh = uTime * 1.1;
#endif
transformed.x += sin(swayPh) * swayA;
transformed.z += cos(swayPh * 0.83 + 1.3) * swayA * 0.7;`,
        );
    };
    material.customProgramCacheKey = () => "vegetation-sway";
  }
  return material;
}
