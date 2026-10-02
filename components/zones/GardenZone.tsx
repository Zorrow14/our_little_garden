"use client";

import CameraRig from "@/components/garden/CameraRig";
import Cottage from "@/components/garden/Cottage";
import FallingPetals from "@/components/garden/FallingPetals";
import Fence from "@/components/garden/Fence";
import Fireflies from "@/components/garden/Fireflies";
import Flowers from "@/components/garden/Flowers";
import Grass from "@/components/garden/Grass";
import Ground from "@/components/garden/Ground";
import Lights from "@/components/garden/Lights";
import Path from "@/components/garden/Path";
import Plants from "@/components/garden/Plants";
import Pond from "@/components/garden/Pond";
import Rocks from "@/components/garden/Rocks";
import Sky from "@/components/garden/Sky";
import Trees from "@/components/garden/Trees";
import Wildflowers from "@/components/garden/Wildflowers";
import Dock from "@/components/garden/props/Dock";
import Mailbox from "@/components/garden/props/Mailbox";
import { PropHoverLight } from "@/components/garden/props/shared";
import StargazingHill from "@/components/garden/props/StargazingHill";
import Swing from "@/components/garden/props/Swing";
import TogetherCue from "@/components/garden/props/TogetherCue";

/**
 * The garden zone: the night garden inside its fence, with its swing, dock,
 * mailbox and stargazing hill, and the cottage outside the gate.
 */
export default function GardenZone() {
  return (
    <>
      <fog attach="fog" args={["#262a4e", 16, 62]} />
      <Sky />
      <Lights />
      <Ground />
      <Pond />
      <Rocks />
      <Path />
      <Trees />
      <Fence />
      <Grass />
      <Wildflowers />
      <Flowers />
      <Plants />
      <Swing />
      <Dock />
      <Mailbox />
      <StargazingHill />
      <TogetherCue />
      <PropHoverLight />
      <Cottage />
      <Fireflies />
      <FallingPetals />
      <CameraRig />
    </>
  );
}
