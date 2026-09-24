"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { withGrowth } from "@/lib/growth";
import { distanceToFlowers, distanceToPath } from "@/lib/layout";
import { createRandom, distanceToPond, groundHeight, POND } from "@/lib/terrain";

const ROCK_COLORS = ["#77716a", "#837c73", "#6b675f", "#7c7770"].map((c) => new THREE.Color(c));

interface Rock {
  x: number;
  z: number;
  size: number;
  spin: number;
  color: THREE.Color;
}

export default function Rocks() {
  const rocks = useMemo(() => {
    const rand = createRandom(21);
    const list: Rock[] = [];
    const color = () => ROCK_COLORS[Math.floor(rand() * ROCK_COLORS.length)];

    // Stones around the pond, leaving the side that faces the camera open so the lotus stays in view.
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2 + rand() * 0.12;
      if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.6) continue;
      const r = POND.radius * (0.92 + rand() * 0.12);
      list.push({ x: POND.x + Math.sin(a) * r, z: POND.z + Math.cos(a) * r, size: 0.16 + rand() * 0.2, spin: rand() * 6, color: color() });
    }

    // A scattering through the rest of the garden.
    let placed = 0;
    while (placed < 36) {
      const r = 4 + rand() * 9.5;
      const a = rand() * Math.PI * 2;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r - 1;
      if (distanceToPond(x, z) < POND.radius * 1.25 || distanceToPath(x, z) < 0.7 || distanceToFlowers(x, z) < 0.9) continue;
      list.push({ x, z, size: 0.1 + rand() * rand() * 0.45, spin: rand() * 6, color: color() });
      placed++;
    }
    return list;
  }, []);

  const geometry = useMemo(() => new THREE.DodecahedronGeometry(1, 0), []);
  const material = useMemo(() => withGrowth(new THREE.MeshLambertMaterial({ flatShading: true })), []);
  const mesh = useRef<THREE.InstancedMesh>(null!);

  useLayoutEffect(() => {
    const m = new THREE.Object3D();
    rocks.forEach((rock, i) => {
      m.position.set(rock.x, groundHeight(rock.x, rock.z) - rock.size * 0.3, rock.z);
      m.rotation.set(rock.spin, rock.spin * 1.7, 0);
      m.scale.set(rock.size * 1.3, rock.size * 0.75, rock.size);
      m.updateMatrix();
      mesh.current.setMatrixAt(i, m.matrix);
      mesh.current.setColorAt(i, rock.color);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [rocks]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  return <instancedMesh ref={mesh} args={[geometry, material, rocks.length]} />;
}
