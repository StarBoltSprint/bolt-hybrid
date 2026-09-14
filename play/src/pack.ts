export const PACK = 37;
export const DISSOLVE_MS = 280;

const ROOT = "/packs/mars";
export const BIOME = "/biomes/asteroid";
export const PLAYLIST_URL = `${BIOME}/playlist.json?u${PACK}`;

export function packUrl(rel: string) {
  return `${ROOT}/${rel}?u${PACK}`;
}

export const stills = {
  spawn: packUrl("stills/spawn.jpg"),
  atA: packUrl("stills/at-a.jpg"),
  atB: packUrl("stills/at-b.jpg"),
} as const;

export const films = {
  "breath-spawn": packUrl("films/breath-spawn.mp4"),
  "breath-A": packUrl("films/breath-a.mp4"),
  "breath-B": packUrl("films/breath-b.mp4"),
  "walk-spawn-A": packUrl("films/walk-spawn-a.mp4"),
  "walk-spawn-B": packUrl("films/walk-spawn-b.mp4"),
  "walk-A-B": packUrl("films/walk-a-b.mp4"),
  "walk-B-A": packUrl("films/walk-b-a.mp4"),
} as const;

/** Hung Mars sprint — 4 × 15s. Door B 2nd tap. */
export const sprintFilms = [
  `${BIOME}/films/asteroid-run-0.mp4?u${PACK}`,
  `${BIOME}/films/asteroid-run-1.mp4?u${PACK}`,
  `${BIOME}/films/asteroid-run-2.mp4?u${PACK}`,
  `${BIOME}/films/asteroid-run-3.mp4?u${PACK}`,
] as const;

export const decayFilm = `${BIOME}/films/asteroid-decay.mp4?u${PACK}`;

/** Year-0: 1 tap / plate. side L|R. Glow in the picture is the telegraph. */
export const sprintCues = [
  [{ id: "c0", kind: "tap", side: "L", on: 4.5, off: 9.5 }],
  [{ id: "c0", kind: "tap", side: "L", on: 3.0, off: 8.0 }],
  [{ id: "c0", kind: "tap", side: "R", on: 4.0, off: 9.0 }],
  [{ id: "c0", kind: "tap", side: "R", on: 3.5, off: 8.5 }],
] as const;

export const SPRINT_WIN = 2.4;

export type Pose = "spawn" | "atA" | "atB";
export type Tap = "A" | "B";
export type Edge =
  | { clip: keyof typeof films; arrive: Pose }
  | { stay: true }
  | { sprint: true };

export function stillFor(pose: Pose) {
  if (pose === "atA") return stills.atA;
  if (pose === "atB") return stills.atB;
  return stills.spawn;
}

export function edgeFor(pose: Pose, tap: Tap): Edge {
  if (pose === "spawn" && tap === "A") return { clip: "walk-spawn-A", arrive: "atA" };
  if (pose === "spawn" && tap === "B") return { clip: "walk-spawn-B", arrive: "atB" };
  if (pose === "atA" && tap === "B") return { clip: "walk-A-B", arrive: "atB" };
  if (pose === "atB" && tap === "A") return { clip: "walk-B-A", arrive: "atA" };
  if (pose === "atB" && tap === "B") return { sprint: true };
  return { stay: true };
}

export function breathFor(pose: Pose): keyof typeof films {
  if (pose === "atA") return "breath-A";
  if (pose === "atB") return "breath-B";
  return "breath-spawn";
}

/** Hits on the 9:16 contained plate, not the letterbox. nx < 0.4 → A, nx > 0.6 → B. */
export function containPlate(
  stage: HTMLElement,
  clientX: number,
  clientY: number,
): Tap | null {
  const r = stage.getBoundingClientRect();
  const plateW = Math.min(r.width, (r.height * 9) / 16);
  const plateH = (plateW * 16) / 9;
  const left = r.left + (r.width - plateW) / 2;
  const top = r.top + (r.height - plateH) / 2;
  const nx = (clientX - left) / plateW;
  const ny = (clientY - top) / plateH;
  if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return null;
  if (nx < 0.4) return "A";
  if (nx > 0.6) return "B";
  return null;
}
