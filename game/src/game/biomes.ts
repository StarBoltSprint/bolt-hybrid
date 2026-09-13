/**
 * Imagine = short décor plates only.
 * Never draw Bolt / a wolf / a GSD in Imagine stills or loops.
 * Playable Bolt is glTF (`/assets/bolt.glb` via GLTFLoader). A second wolf in the plate is a fail.
 */

export type BiomeId = "ice" | "forest" | "ember" | "void";

export type DecorSlot = "plate" | "near-l" | "near-r";

export type DecorSet = Record<DecorSlot, string>;

/** Remote Imagine stills — empty halls only. No Bolt in the frame. */
export const SMIR_STILL_URLS: Partial<Record<BiomeId, Partial<DecorSet>>> = {
  ice: {},
  forest: {},
  ember: {},
  void: {},
};

/** Remote Imagine breath loop — empty hall, no filmed GSD. Empty = local video slot. */
export const SMIR_BREATH_URL = "";

export const BREATH_URL = SMIR_BREATH_URL.trim() || "/decor/breath-spawn.mp4?v=canyon3";
export const BREATH_POSTER = "/decor/breath-poster.jpg";

export const BIOME_ORDER: BiomeId[] = ["ice", "forest", "ember", "void"];

export type PlateGrammar = {
  aspect: number;
  spawnZ: number;
  spawnX: number;
  spawnFeetV: number;
  farFeetV: number;
  spawnScale: number;
  farScale: number;
  xSpanNear: number;
  xSpanFar: number;
  portalX: number;
  portalZ: number;
  sidePortals: boolean;
  portalL: { u: number; v: number; ru: number; rv: number };
  portalR: { u: number; v: number; ru: number; rv: number };
};

/** 9:16 canyon (breath-b) — start hall. */
export const CANYON: PlateGrammar = {
  aspect: 9 / 16,
  spawnZ: 0.04,
  spawnX: 0,
  spawnFeetV: 0.2,
  farFeetV: 0.38,
  spawnScale: 0.086,
  farScale: 0.05,
  xSpanNear: 0.78,
  xSpanFar: 0.7,
  portalX: 0.55,
  portalZ: 0.48,
  sidePortals: false,
  portalL: { u: 0.22, v: 0.5, ru: 0.155, rv: 0.175 },
  portalR: { u: 0.78, v: 0.5, ru: 0.155, rv: 0.175 },
};

/** 16:9 crystal ice hall (original living biome video). */
export const CRYSTAL: PlateGrammar = {
  aspect: 16 / 9,
  spawnZ: 0.06,
  spawnX: 0,
  spawnFeetV: 0.2,
  farFeetV: 0.34,
  spawnScale: 0.078,
  farScale: 0.046,
  xSpanNear: 0.88,
  xSpanFar: 0.82,
  portalX: 0.7,
  portalZ: 0.08,
  sidePortals: true,
  portalL: { u: 0.13, v: 0.5, ru: 0.13, rv: 0.3 },
  portalR: { u: 0.87, v: 0.5, ru: 0.13, rv: 0.3 },
};

/** 9:16 still/live ember + void halls. */
export const TALL: PlateGrammar = {
  aspect: 9 / 16,
  spawnZ: 0.04,
  spawnX: 0,
  spawnFeetV: 0.205,
  farFeetV: 0.32,
  spawnScale: 0.086,
  farScale: 0.05,
  xSpanNear: 0.8,
  xSpanFar: 0.72,
  portalX: 0.46,
  portalZ: 0.42,
  sidePortals: false,
  portalL: { u: 0.27, v: 0.48, ru: 0.145, rv: 0.175 },
  portalR: { u: 0.73, v: 0.48, ru: 0.145, rv: 0.175 },
};

/** @deprecated alias — start hall grammar */
export const PLATE = CANYON;
export const STILL_PLATE = TALL;

export type BiomeDef = {
  id: BiomeId;
  name: string;
  nextLabel: string;
  prevLabel: string;
  fog: number;
  particle: number;
  mist: [number, number, number];
  live: boolean;
  breathUrl: string;
  grammar: PlateGrammar;
  /** hall = Citadel roam, no dodge. biome = sprint rail + dodge volumes. */
  mode: StageMode;
  /**
   * Invisible SprintCore hitboxes wrapping Imagine-painted obstacles.
   * Add a row: `{ x, z, r, kind, beat }` in meters (x=0 center, z along hall).
   * Always leave a left OR right gap (never fill the full width).
   * `beat` = seconds on the Imagine breath (authoring cue, e.g. 7 = 0:07 arch).
   */
  obstacles: Obstacle[];
};

export const BIOMES: Record<BiomeId, BiomeDef> = {
  ice: {
    id: "ice",
    name: "Canyon",
    nextLabel: "Crystal",
    prevLabel: "Void",
    fog: 0xc4a882,
    particle: 0xffc36a,
    mist: [1.0, 0.86, 0.68],
    live: true,
    breathUrl: BREATH_URL,
    grammar: CANYON,
    mode: "hall",
    obstacles: [],
  },
  forest: {
    id: "forest",
    name: "Crystal Hall",
    nextLabel: "Ember",
    prevLabel: "Canyon",
    fog: 0xb9d7e6,
    particle: 0x9be7f0,
    mist: [0.82, 0.9, 1.0],
    live: true,
    breathUrl: "/decor/forest/breath.mp4?v=crystal1",
    grammar: CRYSTAL,
    mode: "biome",
    obstacles: [
      { x: 1.55, z: 2.9, r: 0.86, kind: "arch", beat: 7 },
      { x: -1.62, z: 5.7, r: 0.9, kind: "fork", beat: 18 },
      { x: 1.38, z: 8.1, r: 0.74, kind: "crystal", beat: 28 },
      { x: -1.45, z: 10.5, r: 0.8, kind: "pillar", beat: 38 },
      { x: 1.5, z: 12.4, r: 0.72, kind: "crystal", beat: 48 },
    ],
  },
  ember: {
    id: "ember",
    name: "Ember Hall",
    nextLabel: "Void",
    prevLabel: "Crystal",
    fog: 0x2c140e,
    particle: 0xff7a3a,
    mist: [1.0, 0.72, 0.48],
    live: true,
    breathUrl: "/decor/ember/breath.mp4?v=ember1",
    grammar: TALL,
    mode: "biome",
    obstacles: [
      { x: -1.48, z: 3.0, r: 0.84, kind: "arch", beat: 7 },
      { x: 1.58, z: 5.8, r: 0.88, kind: "fork", beat: 18 },
      { x: -1.32, z: 8.3, r: 0.72, kind: "pillar", beat: 28 },
      { x: 1.42, z: 10.7, r: 0.78, kind: "crystal", beat: 38 },
    ],
  },
  void: {
    id: "void",
    name: "Void Hall",
    nextLabel: "Canyon",
    prevLabel: "Ember",
    fog: 0x08070f,
    particle: 0x8aa4ff,
    mist: [0.62, 0.68, 0.95],
    live: true,
    breathUrl: "/decor/void/breath.mp4?v=void1",
    grammar: TALL,
    mode: "biome",
    obstacles: [
      { x: 1.5, z: 3.1, r: 0.82, kind: "pillar", beat: 7 },
      { x: -1.55, z: 6.0, r: 0.86, kind: "arch", beat: 18 },
      { x: 1.28, z: 8.6, r: 0.7, kind: "crystal", beat: 28 },
      { x: -1.4, z: 11.0, r: 0.76, kind: "fork", beat: 38 },
    ],
  },
};

export function nextBiome(id: BiomeId): BiomeId {
  const i = BIOME_ORDER.indexOf(id);
  return BIOME_ORDER[(i + 1) % BIOME_ORDER.length] ?? "ice";
}

export function prevBiome(id: BiomeId): BiomeId {
  const i = BIOME_ORDER.indexOf(id);
  return BIOME_ORDER[(i - 1 + BIOME_ORDER.length) % BIOME_ORDER.length] ?? "void";
}

export function decorUrl(biome: BiomeId, slot: DecorSlot): string {
  const override = SMIR_STILL_URLS[biome]?.[slot]?.trim();
  if (override) return override;
  return `/decor/${biome}/${slot}.jpg`;
}

import type { HallMeters, Obstacle, StageMode } from "./sprintcore";
import { DOOR_ARM_MOMENTUM, SOFT_CAP, SPRINT_MS as SPRINT_SPEED, WALK_MS as WALK_SPEED } from "./sprintcore";

export { DOOR_ARM_MOMENTUM, SOFT_CAP, SPRINT_SPEED, WALK_SPEED };

export function hallMeters(g: PlateGrammar): HallMeters {
  const depth = 14;
  const widthNear = 7.2;
  return {
    widthNear,
    widthFar: widthNear * (g.xSpanFar / Math.max(0.001, g.xSpanNear)),
    depth,
    spawnX: g.spawnX * widthNear * 0.5,
    spawnZ: g.spawnZ * depth,
    portalX: g.portalX * widthNear * 0.5,
    portalZ: g.portalZ * depth,
    sidePortals: g.sidePortals,
  };
}
