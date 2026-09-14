# play/ — Bolt biome 2.5D (Mars sprint)

Standalone Vite + React. Imagine plates + playable 2.5D Bolt card.

## Run

```bash
cd play
npm install
npm run dev
```

Open the printed localhost URL. Sprint starts immediately (no hall gates).

## Controls

- Tap left / A / ← : lane L
- Tap right / D / → : lane R
- Tap top / W / Space : hop
- P : pause — freezes plate + gait + hop
- H : howl — does **not** pause the plate

Gait frames advance from `video.currentTime` delta (clamped). Contact shadow is soft Multiply over the plate so the path glow stays readable. Paw line is pinned to the plate ground line.

## Live rate(t) + tint (COOK-BIOME-25D)

Same 0.1s stack as boltverse-odyssey `scripts/biome-25d-speed.mjs` (PR #19). Helpers are ported in `src/biome-25d-speed.ts`.

- **`playlist.json`** — `public/biomes/asteroid/playlist.json` is analyze output (`SAMPLE_DT=0.1`). Each plate stores `rateCurve: [{ t, rate }, …]`. `playbackRate` on the row is a **mean summary only**. Drop a new analyze file here to rewire the four plates.
- **Live rate** — every frame (≥10 Hz) `video.playbackRate = rateAt(plate.rateCurve, pictureTime)`. Plate 1 KEEP is `rate(t)=1`. Band **1.0–1.6**. Never a single constant for the clip.
- **Gait** — stride follows `pictureTime` (`video.currentTime`). Live rate speeds the plate clock; legs are **not** multiplied again (no skate / legs-only).
- **Tint** — every **~0.1 s** sample lower-third ground+haze under Bolt → `applyLiveTint` (soft Multiply, amount ≤ 0.45) + `identityGuard`. Full-white coat forever — no grey/black morph.

`cd play && npm test` checks the ported helpers. PathGen stays HOLD.

## Layout

```
play/
  src/hall.tsx                 2.5D Bolt card + sprint loop
  src/biome-25d-speed.ts       rateAt / applyLiveRate / applyLiveTint (odyssey port)
  src/playlist.ts              load per-plate rateCurve
  src/dom-swap.ts              vis/hid video engine (first/last continuity)
  src/pack.ts                  plate URLs + cues
  public/biomes/asteroid/playlist.json   analyze rateCurve (MATCH)
  public/biomes/asteroid/films/*.mp4     4×15s plates + decay
  public/hybrid/run/01.png…16.png        Bolt gait flipbook
  public/hybrid/bolt-run.png             identity still
```

Plates are web-ready 720×1280 mp4. Gait frames are keyed PNGs.
