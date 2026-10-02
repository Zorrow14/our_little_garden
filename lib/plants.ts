import * as THREE from "three";
import { FLOWER_REGISTRY, FLOWER_TYPES, type FlowerType } from "@/lib/flowerSpecs";
import { distanceToFlowers, distanceToPath, FENCE, FLOWER_SPOTS } from "@/lib/layout";
import { MEDIA_BUCKET, supabase } from "@/lib/supabase";
import { distanceToPond, groundHeight, hashString, POND, WATER_Y } from "@/lib/terrain";

/** A row of the `plants` table: a letter one of you planted in the shared garden. */
export interface Plant {
  id: string;
  flower_type: string;
  category_label: string;
  message: string;
  photo_url: string | null;
  audio_url: string | null;
  position_x: number;
  position_y: number;
  position_z: number;
  planted_by: string;
  created_at: string;
}

export type NewPlant = Pick<Plant, "flower_type" | "category_label" | "message" | "planted_by">;

/**
 * The planting form's choices: every registry flower marked plantable, whether
 * or not it's pre-placed. (The moon lotus is reserved for the last original letter.)
 */
export const PLANT_KINDS: FlowerType[] = FLOWER_TYPES.filter((type) => FLOWER_REGISTRY[type].plantable);

/** The flower to draw for a stored type. Anything unfamiliar still gets a flower, picked by its name. */
export function plantKind(type: string): FlowerType {
  const t = type.trim().toLowerCase();
  return (PLANT_KINDS as string[]).includes(t) ? (t as FlowerType) : PLANT_KINDS[hashString(t) % PLANT_KINDS.length];
}

/**
 * SHA-256 of the passcode, so the word itself isn't sitting in the page source.
 * The check runs in the browser: it keeps the garden from being fully public if
 * the link leaks, not a determined visitor out. To change it, run
 *   node -e "console.log(require('crypto').createHash('sha256').update('NEW PASSCODE').digest('hex'))"
 * and paste the result here.
 */
const PASSCODE_SHA256 = "c25683e055bef380af1bb029b3cfd13d770fcc41393efd937494adfa783202df";

export async function checkPasscode(input: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input.trim()));
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  return hex === PASSCODE_SHA256;
}

// Where new plants may grow: inside the fence clear of the path and pond, or on the water for a lotus.
const LAND_REACH = FENCE.radius - 2.2;
const POND_REACH = 1.55;
const LETTER_LOTUS = FLOWER_SPOTS.lotus;

interface Candidate {
  x: number;
  z: number;
  water: boolean;
}

function candidate(water: boolean): Candidate {
  const r = Math.sqrt(Math.random());
  const a = Math.random() * Math.PI * 2;
  return water
    ? { x: POND.x + Math.cos(a) * r * POND_REACH, z: POND.z + Math.sin(a) * r * POND_REACH, water }
    : { x: FENCE.x + Math.cos(a) * r * LAND_REACH, z: FENCE.z + Math.sin(a) * r * LAND_REACH, water };
}

function clearOfGarden({ x, z, water }: Candidate) {
  if (water) return Math.hypot(x - LETTER_LOTUS.x, z - LETTER_LOTUS.z) > 1.45;
  return distanceToPond(x, z) > POND.radius * 1.25 && distanceToPath(x, z) > 0.8 && distanceToFlowers(x, z) > 1.4;
}

/**
 * Picks where a new plant grows: somewhere open, not crowding the letters or
 * other plants, and preferably in view so the planter can watch it come up.
 * A lotus floats on the pond while there's room there.
 */
export function choosePlantSpot(
  kind: FlowerType,
  taken: { x: number; z: number }[],
  camera: THREE.Camera | null,
): [number, number, number] {
  const projected = new THREE.Vector3();
  const tryWater = kind === "lotus";
  // Relax the spacing if the garden is getting full.
  for (const spacing of [1.25, 0.9, 0.55]) {
    let best: Candidate | null = null;
    let bestScore = -Infinity;
    for (let i = 0; i < 600; i++) {
      const c = candidate(tryWater && i % 2 === 0);
      if (!clearOfGarden(c)) continue;
      let clearance = Infinity;
      for (const t of taken) clearance = Math.min(clearance, Math.hypot(t.x - c.x, t.z - c.z));
      if (clearance < spacing) continue;

      let score = Math.min(clearance, 3) + (c.water ? 4 : 0);
      score -= Math.hypot(c.x - FENCE.x, c.z - FENCE.z) * 0.08;
      if (camera) {
        projected.set(c.x, groundHeight(c.x, c.z) + 0.5, c.z);
        const near = camera.position.distanceTo(projected) < 3;
        projected.project(camera);
        const inView = projected.z < 1 && Math.abs(projected.x) < 0.78 && projected.y > -0.55 && projected.y < 0.7;
        if (inView && !near) score += 3;
      }
      if (score > bestScore) {
        best = c;
        bestScore = score;
      }
    }
    if (best) return [best.x, best.water ? WATER_Y : groundHeight(best.x, best.z), best.z];
  }
  const c = candidate(false);
  return [c.x, groundHeight(c.x, c.z), c.z];
}

const MAX_PHOTO_EDGE = 2000;

/** Phone photos can be 10MB+; scale them down before upload so the letter opens quickly on her end. */
async function shrinkPhoto(file: File): Promise<Blob> {
  if (file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_PHOTO_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1_500_000) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return (await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86))) ?? file;
  } catch {
    // A format the browser can't decode (e.g. HEIC outside Safari): upload it as it is.
    return file;
  }
}

function extensionFor(blob: Blob, name: string) {
  if (blob.type === "image/jpeg") return "jpg";
  const fromName = name.includes(".") ? name.split(".").pop() : "";
  return (fromName || blob.type.split("/")[1] || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Uploads a photo or voice note to Supabase Storage and returns its public URL.
 * `photos` and `audio` are for planted letters; `house-photos` for the cottage's photo wall.
 */
export async function uploadMedia(file: File, folder: "photos" | "audio" | "house-photos") {
  const body = folder === "audio" ? file : await shrinkPhoto(file);
  const path = `${folder}/${crypto.randomUUID()}.${extensionFor(body, file.name)}`;
  const bucket = supabase.storage.from(MEDIA_BUCKET);
  const { error } = await bucket.upload(path, body, {
    contentType: body.type || file.type || undefined,
    cacheControl: "31536000",
  });
  if (error) throw error;
  return bucket.getPublicUrl(path).data.publicUrl;
}

export async function insertPlant(row: Omit<Plant, "created_at">) {
  const { data, error } = await supabase.from("plants").insert(row).select().single<Plant>();
  if (error) throw error;
  return data;
}

export async function fetchPlants() {
  const { data, error } = await supabase.from("plants").select("*").order("created_at").returns<Plant[]>();
  if (error) throw error;
  return data;
}
