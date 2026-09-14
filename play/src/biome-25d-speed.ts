/**
 * Player-side 2.5D biome speed + tint helpers.
 *
 * Ported from boltverse-odyssey `scripts/biome-25d-speed.mjs`
 * (PR #19 / COOK-BIOME-25D). Pure functions only — no ffmpeg, no cook.
 *
 * Law:
 *   SAMPLE_DT = LIVE_RATE_DT = TINT_DT = 0.1
 *   rate(t) = clamp(ref/meas, 1.0, 1.6)
 *   video.playbackRate = rateAt(plate.rateCurve, pictureTime)   // live ≥10Hz
 *   stride follows pictureTime + live rate — never legs alone
 *   every ~0.1s: lower-third ground+haze → softMultiply + identityGuard
 *   full-white coat forever — light wrap only, never grey/black morph
 */

export const RATE_MIN = 1.0;
export const RATE_MAX = 1.6;
export const SAMPLE_DT = 0.1;
export const LIVE_RATE_DT = 0.1;
export const LIVE_RATE_HZ_MIN = 10;
export const TINT_DT = 0.1;
export const TINT_HZ = 10;
export const TINT_LUMA_FLOOR = 180;
export const TINT_AMOUNT_DEFAULT = 0.28;
export const TINT_AMOUNT_MAX = 0.45;
export const WHITE_CARD = { r: 250, g: 250, b: 250 };

export const TINT_LAW = {
  hz: TINT_HZ,
  dt: TINT_DT,
  region: "lower-third ground + haze",
  mode: "soft-multiply",
  identity: "full-white coat forever — light wrap only, never grey/black morph",
} as const;

export type RatePoint = { t: number; rate: number };
export type Rgb = { r: number; g: number; b: number };
export type GuardedRgb = Rgb & { pulled: boolean; luma: number };
export type RateVideo = { currentTime: number; playbackRate: number };

export function rateAt(curve: RatePoint[] | null | undefined, t: number): number {
  if (!curve || !curve.length) return 1;
  if (t <= curve[0].t) return curve[0].rate;
  const last = curve[curve.length - 1];
  if (t >= last.t) return last.rate;
  for (let i = 1; i < curve.length; i++) {
    if (t <= curve[i].t) {
      const a = curve[i - 1];
      const b = curve[i];
      const u = (t - a.t) / Math.max(1e-6, b.t - a.t);
      return a.rate + (b.rate - a.rate) * u;
    }
  }
  return last.rate;
}

/** Live playbackRate from pictureTime. Call ≥10Hz (every LIVE_RATE_DT). Gait uses both. */
export function applyLiveRate(video: RateVideo | null | undefined, curve: RatePoint[] | null | undefined) {
  const pictureTime = Number(video && video.currentTime) || 0;
  const rate = rateAt(curve, pictureTime);
  if (video) video.playbackRate = rate;
  return { pictureTime, rate };
}

export function pictureTime(currentTime: number, rate: number, rateOnElement = true) {
  const t = Number(currentTime) || 0;
  const r = Number(rate) || 1;
  return rateOnElement ? t : t * r;
}

export function clamp01(n: number) {
  return Math.min(1, Math.max(0, Number(n) || 0));
}

export function clampRate(n: number) {
  const r = Number(n);
  if (!Number.isFinite(r)) return RATE_MIN;
  return Math.min(RATE_MAX, Math.max(RATE_MIN, r));
}

export function softMultiply(card: Rgb, ambient: Rgb, amount = TINT_AMOUNT_DEFAULT): Rgb {
  const a = Math.min(TINT_AMOUNT_MAX, Math.max(0, Number(amount) || 0));
  const mix = (c: number, p: number) => c * (1 - a) + ((c * p) / 255) * a;
  return {
    r: mix(card.r, ambient.r),
    g: mix(card.g, ambient.g),
    b: mix(card.b, ambient.b),
  };
}

export function luma(rgb: Rgb) {
  return 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
}

export function identityGuard(rgb: Rgb, floor = TINT_LUMA_FLOOR): GuardedRgb {
  const y = luma(rgb);
  if (y >= floor) return { ...rgb, pulled: false, luma: y };
  const k = floor / Math.max(1, y);
  return {
    r: Math.min(255, rgb.r * k),
    g: Math.min(255, rgb.g * k),
    b: Math.min(255, rgb.b * k),
    pulled: true,
    luma: floor,
  };
}

/** Soft-multiply + identity guard. Call every TINT_DT (~0.1s / 10Hz). */
export function applyLiveTint(card: Rgb, ambient: Rgb, amount = TINT_AMOUNT_DEFAULT): GuardedRgb {
  return identityGuard(softMultiply(card, ambient, amount));
}

/** Multiply fill that maps WHITE_CARD → wrap (identity when wrap is the white card). */
export function wrapFill(wrap: Rgb, card = WHITE_CARD): Rgb {
  const kr = 255 / Math.max(1, card.r);
  const kg = 255 / Math.max(1, card.g);
  const kb = 255 / Math.max(1, card.b);
  return {
    r: Math.min(255, wrap.r * kr),
    g: Math.min(255, wrap.g * kg),
    b: Math.min(255, wrap.b * kb),
  };
}

export function selftest(): string[] {
  const pass: string[] = [];
  const must = (ok: boolean, msg: string) => {
    if (!ok) throw new Error("FAIL  " + msg);
    pass.push(msg);
  };

  const curve = [
    { t: 0, rate: 1 },
    { t: 1, rate: 1.4 },
    { t: 2, rate: 1.2 },
  ];
  must(Math.abs(rateAt(curve, 0.5) - 1.2) < 1e-9, "rateAt lerps mid-segment");
  must(rateAt(curve, -1) === 1, "rateAt clamps before first");
  must(rateAt(curve, 9) === 1.2, "rateAt clamps after last");
  must(rateAt([], 1) === 1, "empty curve → 1");

  const video = { currentTime: 1, playbackRate: 1 };
  const live = applyLiveRate(video, curve);
  must(live.pictureTime === 1 && Math.abs(live.rate - 1.4) < 1e-9, "applyLiveRate from pictureTime");
  must(video.playbackRate === live.rate, "applyLiveRate writes playbackRate");
  must(pictureTime(4, 1.4, true) === 4, "element rate: pictureTime = currentTime");
  must(pictureTime(4, 1.4, false) === 5.6, "external rate: pictureTime = currentTime * rate");

  const wrapped = softMultiply(WHITE_CARD, { r: 80, g: 140, b: 200 }, 0.3);
  must(luma(wrapped) > 150, "softMultiply keeps a bright coat");
  const guarded = identityGuard({ r: 40, g: 40, b: 40 });
  must(guarded.pulled && luma(guarded) >= TINT_LUMA_FLOOR, "identityGuard pulls grey/black back to white");
  const liveTint = applyLiveTint(WHITE_CARD, { r: 20, g: 20, b: 20 }, 0.45);
  must(liveTint.luma >= TINT_LUMA_FLOOR && liveTint.pulled, "applyLiveTint never greys the coat");
  const id = wrapFill(WHITE_CARD);
  must(id.r === 255 && id.g === 255 && id.b === 255, "wrapFill(white) is multiply-identity");
  must(SAMPLE_DT === 0.1 && LIVE_RATE_DT === 0.1 && TINT_DT === 0.1, "0.1s stack");
  must(TINT_LAW.hz === 10 && /light wrap/.test(TINT_LAW.identity), "tint law 10Hz light wrap");
  must(RATE_MIN === 1 && RATE_MAX === 1.6, "rate band 1.0–1.6");
  return pass;
}
