"use client";

import { OrbitControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

const GARDEN_POSE = {
  position: new THREE.Vector3(0.8, 3.7, 11.4),
  target: new THREE.Vector3(0, 0.3, -0.9),
};

/** Tall phone screens back the camera off so the whole garden still fits side to side. */
function portraitPull(aspect: number) {
  return aspect >= 1 ? 1 : THREE.MathUtils.lerp(1.45, 1, THREE.MathUtils.clamp((aspect - 0.45) / 0.55, 0, 1));
}

function gardenPose(aspect: number) {
  const offset = GARDEN_POSE.position.clone().sub(GARDEN_POSE.target).multiplyScalar(portraitPull(aspect));
  return { position: GARDEN_POSE.target.clone().add(offset), target: GARDEN_POSE.target.clone() };
}

export default function CameraRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const aspect = useThree((s) => s.size.width / s.size.height);
  const controls = useRef<OrbitControlsImpl>(null!);

  useEffect(() => {
    camera.fov = aspect >= 1 ? 45 : THREE.MathUtils.lerp(58, 45, THREE.MathUtils.clamp((aspect - 0.45) / 0.55, 0, 1));
    camera.updateProjectionMatrix();
  }, [camera, aspect]);

  useLayoutEffect(() => {
    const pose = gardenPose(camera.aspect);
    camera.position.copy(pose.position);
    controls.current.target.copy(pose.target);
    controls.current.update();
  }, [camera]);

  const pull = portraitPull(aspect);
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
      maxDistance={15 * pull}
      minPolarAngle={0.5}
      maxPolarAngle={1.32}
      minAzimuthAngle={-1.5}
      maxAzimuthAngle={1.5}
    />
  );
}
