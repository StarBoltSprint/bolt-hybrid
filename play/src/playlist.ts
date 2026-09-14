/**
 * Playlist loader for live rate(t).
 * Drop analyze output from boltverse-odyssey `scripts/biome-25d-speed.mjs`
 * at `public/biomes/<style>/playlist.json` (plates[].rateCurve).
 */
import {
  clampRate,
  LIVE_RATE_DT,
  RATE_MIN,
  SAMPLE_DT,
  TINT_DT,
  type RatePoint,
} from "./biome-25d-speed.ts";
import { PLAYLIST_URL, sprintFilms } from "./pack.ts";

export type PlaylistPlate = {
  id: string;
  file?: string;
  playbackRate: number;
  rateCurve: RatePoint[];
  match?: string;
};

export type Playlist = {
  ok: boolean;
  law: string;
  style?: string;
  sampleDt: number;
  liveRateDt: number;
  tintDt: number;
  plates: PlaylistPlate[];
};

export function normalizeCurve(raw: unknown, fallbackRate = RATE_MIN): RatePoint[] {
  if (Array.isArray(raw) && raw.length) {
    return raw
      .map((p) => {
        const row = p && typeof p === "object" ? (p as { t?: unknown; rate?: unknown }) : {};
        return { t: Number(row.t) || 0, rate: clampRate(Number(row.rate)) };
      })
      .sort((a, b) => a.t - b.t);
  }
  return [{ t: 0, rate: clampRate(fallbackRate) }];
}

function filmRel(src: string | undefined) {
  const path = String(src || "").split("?")[0];
  const i = path.lastIndexOf("/films/");
  return i >= 0 ? path.slice(i + 1) : path.split("/").pop() || "";
}

export function fallbackPlaylist(n = sprintFilms.length): Playlist {
  return {
    ok: true,
    law: "COOK-BIOME-25D",
    style: "asteroid",
    sampleDt: SAMPLE_DT,
    liveRateDt: LIVE_RATE_DT,
    tintDt: TINT_DT,
    plates: Array.from({ length: n }, (_, i) => ({
      id: `plate-${i + 1}`,
      file: filmRel(sprintFilms[i]),
      playbackRate: 1,
      rateCurve: [{ t: 0, rate: 1 }],
      match: i === 0 ? "KEEP reference — rate(t)=1" : "fallback rate(t)=1 (no playlist curve)",
    })),
  };
}

function pickPlate(platesIn: unknown[], i: number, fallbackFile?: string) {
  const base = fallbackFile ? fallbackFile.split("/").pop() : "";
  const hit = platesIn.find((p) => {
    if (!p || typeof p !== "object") return false;
    const file = String((p as { file?: unknown }).file || "");
    return !!base && (file.endsWith(base) || file.endsWith("films/" + base));
  });
  return (hit || platesIn[i] || null) as Record<string, unknown> | null;
}

export function parsePlaylist(json: unknown): Playlist {
  const raw = json && typeof json === "object" ? (json as Record<string, unknown>) : {};
  const platesIn = Array.isArray(raw.plates) ? raw.plates : [];
  const base = fallbackPlaylist();
  const plates = base.plates.map((fallback, i) => {
    const p = pickPlate(platesIn, i, fallback.file);
    if (!p) return fallback;
    const keep = i === 0 || /KEEP/i.test(String(p.match || ""));
    const curve = normalizeCurve(p.rateCurve, keep ? 1 : Number(p.playbackRate) || 1);
    return {
      id: String(p.id || fallback.id),
      file: String(p.file || fallback.file),
      playbackRate: keep ? 1 : clampRate(Number(p.playbackRate) || 1),
      rateCurve: keep ? curve.map((c) => ({ t: c.t, rate: 1 })) : curve,
      match: String(p.match || fallback.match),
    };
  });
  return {
    ok: true,
    law: String(raw.law || "COOK-BIOME-25D"),
    style: typeof raw.style === "string" ? raw.style : base.style,
    sampleDt: Number(raw.sampleDt) > 0 ? Number(raw.sampleDt) : SAMPLE_DT,
    liveRateDt: Number(raw.liveRateDt) > 0 ? Number(raw.liveRateDt) : LIVE_RATE_DT,
    tintDt: Number(raw.tintDt) > 0 ? Number(raw.tintDt) : TINT_DT,
    plates,
  };
}

export async function loadPlaylist(url = PLAYLIST_URL): Promise<Playlist> {
  try {
    const r = await fetch(url);
    if (!r.ok) return fallbackPlaylist();
    return parsePlaylist(await r.json());
  } catch {
    return fallbackPlaylist();
  }
}

export function plateAt(playlist: Playlist | null | undefined, i: number): PlaylistPlate {
  const plates = playlist?.plates;
  if (plates && plates[i]) return plates[i];
  return fallbackPlaylist().plates[i] ?? fallbackPlaylist().plates[0];
}
