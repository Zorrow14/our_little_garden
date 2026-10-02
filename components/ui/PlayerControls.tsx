"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useGardenStore } from "@/lib/gardenStore";
import { playerInput } from "@/lib/playerInput";
import { usePlantStore } from "@/lib/plantStore";
import { usePresence } from "@/lib/presence";

const KEYS: Record<string, [number, number]> = {
  KeyW: [0, 1],
  ArrowUp: [0, 1],
  KeyS: [0, -1],
  ArrowDown: [0, -1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

/** Keys typed into a form (the planting form, the volume slider) aren't for walking. */
function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/**
 * Steering your gardener: WASD or the arrow keys, and on touch screens a
 * joystick in the bottom-left corner. Both feed `playerInput`, which the
 * scene reads every frame.
 */
export default function PlayerControls() {
  const walking = useGardenStore((s) => s.stage === "garden" && !s.activeId && !s.celebrating);
  const formOpen = usePlantStore((s) => s.formOpen);
  const me = usePresence((s) => s.me);
  const [touch, setTouch] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(hover: none) and (pointer: coarse)");
    const update = () => setTouch(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    // `code` for letters, so WASD sits in the same place on any keyboard layout.
    const held = new Set<string>();
    const apply = () => {
      let x = 0;
      let y = 0;
      for (const code of held) {
        x += KEYS[code][0];
        y += KEYS[code][1];
      }
      playerInput.keys.x = Math.sign(x);
      playerInput.keys.y = Math.sign(y);
    };
    const down = (e: KeyboardEvent) => {
      const code = KEYS[e.code] ? e.code : KEYS[e.key] ? e.key : null;
      if (!code || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (e.key.startsWith("Arrow")) e.preventDefault();
      held.add(code);
      apply();
    };
    const up = (e: KeyboardEvent) => {
      held.delete(e.code);
      held.delete(e.key);
      apply();
    };
    // Keys released while the window was in the background never send a keyup.
    const reset = () => {
      held.clear();
      apply();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", reset);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", reset);
      reset();
    };
  }, []);

  return (
    <AnimatePresence>
      {touch && me && walking && !formOpen && (
        <motion.div
          key="joystick"
          className="absolute bottom-[calc(max(1.75rem,env(safe-area-inset-bottom))+4.75rem)] left-5 z-30"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Joystick />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const RADIUS = 44;

function Joystick() {
  const base = useRef<HTMLDivElement>(null);
  const pointer = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const steer = (clientX: number, clientY: number) => {
    const rect = base.current!.getBoundingClientRect();
    let x = clientX - (rect.left + rect.width / 2);
    let y = clientY - (rect.top + rect.height / 2);
    const length = Math.hypot(x, y);
    if (length > RADIUS) {
      x = (x / length) * RADIUS;
      y = (y / length) * RADIUS;
    }
    setKnob({ x, y });
    playerInput.stick.x = x / RADIUS;
    // Screen y points down; pushing up walks away from the camera.
    playerInput.stick.y = -y / RADIUS;
  };

  const release = () => {
    pointer.current = null;
    setKnob({ x: 0, y: 0 });
    playerInput.stick.x = 0;
    playerInput.stick.y = 0;
  };

  useEffect(() => release, []);

  return (
    <div
      ref={base}
      role="presentation"
      className="relative h-[7.25rem] w-[7.25rem] touch-none select-none rounded-full bg-night/40 ring-1 ring-moon/20 backdrop-blur-sm"
      onPointerDown={(e) => {
        pointer.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        steer(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (pointer.current === e.pointerId) steer(e.clientX, e.clientY);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
    >
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-12 w-12 rounded-full bg-moon/25 ring-1 ring-moon/40"
        style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
      />
    </div>
  );
}
