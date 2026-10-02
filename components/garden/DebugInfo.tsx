"use client";

import { Stats } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import * as THREE from "three";
import { useGardenStore } from "@/lib/gardenStore";
import { useNotes } from "@/lib/notes";
import { player } from "@/lib/playerInput";
import { usePlantStore } from "@/lib/plantStore";
import { useZone } from "@/lib/zones";
import { zoneDefinition, ZONES } from "@/components/zones/registry";

/**
 * ?debug: an FPS meter, plus on window the renderer (for draw calls), your
 * gardener's position and zone, and `toScreen(x, y, z)` for finding where
 * something in the scene is on screen.
 */
export default function DebugInfo() {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__gardenRenderer = gl;
    w.__garden = {
      player,
      zone: () => useZone.getState().zone,
      zones: ZONES,
      /** The stores, so a test can stage letters, plants or notes in this page only. */
      stores: { garden: useGardenStore, plants: usePlantStore, notes: useNotes, zone: useZone },
      toScreen,
      /** Where the current zone's exits (doors) are on screen. */
      exitsOnScreen: () => {
        const { exits, ground } = zoneDefinition(useZone.getState().zone);
        return exits.map((e) => ({ name: e.name, ...toScreen(e.at.x, ground.height(e.at.x, e.at.z) + 0.7, e.at.z) }));
      },
    };
    function toScreen(x: number, y: number, z: number) {
      const p = new THREE.Vector3(x, y, z).project(camera);
      return { x: ((p.x + 1) / 2) * size.width, y: ((1 - p.y) / 2) * size.height };
    }
  }, [gl, camera, size]);
  return <Stats />;
}
