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

## Layout

```
play/
  src/hall.tsx          2.5D Bolt card + sprint loop
  src/dom-swap.ts       vis/hid video engine (first/last continuity)
  src/pack.ts           plate URLs + cues
  public/biomes/asteroid/films/*.mp4   4×15s plates + decay
  public/hybrid/run/01.png…16.png      Bolt gait flipbook
  public/hybrid/bolt-run.png           identity still
```

Plates are web-ready 720×1280 mp4. Gait frames are keyed PNGs.
