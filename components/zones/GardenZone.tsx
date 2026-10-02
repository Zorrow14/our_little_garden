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
import SteppingStones from "@/components/garden/SteppingStones";
import Wildflowers from "@/components/garden/Wildflowers";
import { GARDEN_BRIDGE, GARDEN_BRIDGE_PATH } from "@/lib/props";
import { GARDEN_BROOK, groundHeight } from "@/lib/terrain";
import { takeExit } from "./registry";
import Bridge from "@/components/garden/props/Bridge";
import BrookWater from "@/components/garden/props/Brook";
import Dock from "@/components/garden/props/Dock";
import Mailbox from "@/components/garden/props/Mailbox";
import { PropHoverLight } from "@/components/garden/props/shared";
import StargazingHill from "@/components/garden/props/StargazingHill";
import Swing from "@/components/garden/props/Swing";
import TogetherCue from "@/components/garden/props/TogetherCue";

/**
 * The garden zone: the night garden inside its fence, with its swing, dock,
 * mailbox and stargazing hill; the cottage outside the gate; and the bridge
 * over the brook at the back, to the far garden.
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
      <BrookWater brook={GARDEN_BROOK} height={groundHeight} />
      <Bridge span={GARDEN_BRIDGE} tag="The bridge" note="to the far garden" onSelect={() => takeExit("garden", "bridge")} />
      <SteppingStones runs={GARDEN_BRIDGE_PATH} height={groundHeight} seed={13} />
      <TogetherCue />
      <PropHoverLight />
      <Cottage />
      <Fireflies />
      <FallingPetals />
      <CameraRig />
    </>
  );
}
