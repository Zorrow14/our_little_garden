"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { festivalGlow } from "@/components/garden/festival/glow";
import { garden } from "@/lib/growth";
import { MOON_DIRECTION } from "@/lib/layout";
import { night } from "@/lib/stargazing";

const MOON_POSITION = MOON_DIRECTION.clone().multiplyScalar(20).toArray();

const SKY = new THREE.Color("#8f96d6");
const GROUND = new THREE.Color("#1c2b24");
const MOON = new THREE.Color("#d4dcff");
const FLASH = new THREE.Color("#ffd7a0");

/** A festival's light colours, made once each. */
const festiveColors = new Map<string, { sky: THREE.Color; ground: THREE.Color; moon: THREE.Color }>();
function colorsFor(id: string, light: { sky: string; ground: string; moon: string }) {
  let c = festiveColors.get(id);
  if (!c) festiveColors.set(id, (c = { sky: new THREE.Color(light.sky), ground: new THREE.Color(light.ground), moon: new THREE.Color(light.moon) }));
  return c;
}

/**
 * Moonlight plus a cool sky fill. Both brighten a little as the garden grows,
 * and dim when night falls for stargazing. During a festival they warm toward
 * dusk, and a firework bursting overhead lights everything warmly for a moment.
 */
export default function Lights() {
  const sky = useRef<THREE.HemisphereLight>(null!);
  const moon = useRef<THREE.DirectionalLight>(null!);

  useFrame(() => {
    const flash = festivalGlow.flash;
    sky.current.intensity = (1.1 + 0.5 * garden.growth) * (1 - 0.5 * night.amount) + flash * 0.7;
    moon.current.intensity = (1.5 + 0.5 * garden.growth) * (1 - 0.3 * night.amount);

    sky.current.color.copy(SKY);
    sky.current.groundColor.copy(GROUND);
    moon.current.color.copy(MOON);
    const festival = festivalGlow.festival;
    const warm = festivalGlow.amount * (1 - 0.6 * night.amount);
    if (festival && warm > 0) {
      const c = colorsFor(festival.id, festival.theme.light);
      sky.current.color.lerp(c.sky, warm * 0.6);
      sky.current.groundColor.lerp(c.ground, warm * 0.6);
      moon.current.color.lerp(c.moon, warm * 0.5);
    }
    if (flash > 0) sky.current.color.lerp(FLASH, flash * 0.5);
  });

  return (
    <>
      <hemisphereLight ref={sky} args={["#8f96d6", "#1c2b24", 1.1]} />
      <directionalLight ref={moon} position={MOON_POSITION} color="#d4dcff" intensity={1.5} />
    </>
  );
}
