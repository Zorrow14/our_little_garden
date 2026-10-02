"use client";

import { useEffect, useState } from "react";
import { useGardenStore } from "@/lib/gardenStore";
import { presenceDebug, usePresence } from "@/lib/presence";
import { useZone } from "@/lib/zones";

/**
 * TEMPORARY: a corner readout of what this device sees of live presence, for
 * comparing two devices side by side while troubleshooting. To remove it,
 * delete this file and its line in `GardenExperience` (and `presenceDebug`
 * in `lib/presence.ts`, which only this uses).
 */
export default function PresenceDebug() {
  const me = usePresence((s) => s.me);
  const online = usePresence((s) => s.online);
  const zones = usePresence((s) => s.zones);
  const zone = useZone((s) => s.zone);
  const leaving = useZone((s) => s.leaving);
  const stage = useGardenStore((s) => s.stage);
  // The channel's own state isn't in a store, so look at it twice a second.
  const [channel, setChannel] = useState(presenceDebug);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setChannel(presenceDebug());
      setNow(Date.now());
    }, 500);
    return () => clearInterval(timer);
  }, []);

  const ago = channel.at ? `${Math.round((now - channel.at) / 1000)}s ago` : "never";
  const lines = [
    `me       ${me ?? "(none)"}`,
    `zone     ${zone}${leaving ? ` -> ${leaving.to}` : ""}`,
    `stage    ${stage}`,
    `online   ${JSON.stringify(online)}`,
    `zones    ${JSON.stringify(zones)}`,
    `joined   ${channel.joined}`,
    `status   ${channel.status} (${ago})`,
    `channel  ${channel.channelState}`,
    `tracking ${channel.tracked ?? "(nothing)"}`,
    ...(channel.error ? [`error    ${channel.error}`] : []),
  ];

  return (
    <pre className="pointer-events-none fixed left-2 top-[max(4rem,calc(env(safe-area-inset-top)+3rem))] z-[100] m-0 max-w-[calc(100vw-1rem)] whitespace-pre-wrap break-all rounded bg-black/55 px-2 py-1.5 font-mono text-[10px] leading-[1.35] text-white/85">
      {lines.join("\n")}
    </pre>
  );
}
