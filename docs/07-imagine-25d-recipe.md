# 07 — Imagine-only 2.5D biome recipe

**Biome sprint only.** Not Unreal. Not mesh-first. Not Hall / Citadel.

Lock: Imagine plates + a playable Bolt card. PathGen and obstacles come later as Imagine 2.5D assets — never as CSS neon, never as pixel CV.

## Stack identity

Engine = **Imagine gamified**: plates + playable Bolt card + (later) PathGen / obstacles as Imagine 2.5D assets.

| Lock | Value |
|------|--------|
| Artists | No paid artists |
| Unreal | Not required |
| Player API keys | None |

Hall / Citadel stays **film / hall grammar**. This recipe does not apply there.

## Layers

1. **Plate behind** — Imagine mp4, full-frame previs. The clip never touches the playable paws.
2. **Bolt** — 2.5D Imagine card in front (lower third, back view).
3. **PathGen** — **HOLD.** Build neon sticker is rejected. When revisited: real Imagine 2.5D tiles, not CSS neon.
4. **Obstacles** — later. Imagine 2.5D props + time-rail hits `(t, lane)`. No CV on pixels.

```
[ plate mp4 — full frame, empty ]
        │  never draws Bolt, never draws path
        ▼
[ Bolt card — lower third, planted ]
        │  paws = pivot, X strafe only
        ▼
[ PathGen / obstacles — HOLD / later ]
          Imagine 2.5D assets + (t, lane)
```

## Plate cook rails

| Rail | Lock |
|------|------|
| Aspect | 9:16 |
| Length | ~8–12s |
| Camera | lock-off |
| Travel | sprint travelling **baked in the cook** |
| Path | **ZERO** luminous path in the plate |
| Cast | **ZERO** Bolt / dog in the plate |
| Stitch | plate N+1 **first frame = plate N last frame** |
| Rate | Cook travelling in-clip. Player applies live `rate(t)` from `playlist.json` `rateCurve` (1.0–1.6, ≥10 Hz). A constant `playbackRate` is summary only. |

Travel is cooked. Do not fake a pan on a still. Do not run `playbackRate` 2×+ to fake speed.

Playlist stitch uses first+last / `last_frame` hooks — the same continuity idea as boltverse-odyssey **cook-room** / **imagine-hooks**.

### Plate 2 cook

Continues from **plate 1 last frame** (first+last / `last_frame`). Same sprint speed. Same rails: **ZERO** path, **ZERO** Bolt.

**Reveal:** futuristic city begins to emerge from haze — distant domes / spires / neon. Keep a **CLEAR** center corridor (playable lane stays empty).

| Keep | Drop |
|------|------|
| Stitch from plate 1 last frame | New establishing shot / cut |
| Sprint travelling at plate 1 speed | Slow-down, still, or 2×+ rate |
| City as far haze (domes / spires / neon) | City filling the corridor |
| CLEAR center | Luminous path, Bolt, clutter in the lane |

## Bolt card

**Plant**

- Pivot at paws / `groundY`
- Strafe **X only**
- Stride from `pictureTime` + live `rate(t)` (plate clock, not a free gait clock, not legs-only)
- Soft contact shadow under the paws
- Ambient tint every **~0.1 s** — soft Multiply + identityGuard (full-white coat)

**Skating** = the card is not planted. That is a plant bug. It is not “Imagine bad paws.”

**Look**

- Prefer a flat back-view run cycle
- Warm grade match to the plate when possible

## Play loop order

One thing at a time.

1. **KEEP** one fast empty plate
2. Erase bad PathGen overlays
3. Cook plate 2 from the last frame of plate 1 + stitch — city from haze, sprint speed, CLEAR center, zero path, zero Bolt
4. Later: Imagine PathGen assets, then obstacles

## Anti-patterns

Reject in review.

| Reject | Why |
|--------|-----|
| Orbit + hall mesh + far poster | Hall / Citadel / mesh-first. Wrong stack. |
| Neon PathGen sticker / CSS bars as “PathGen” | Build neon sticker rejected. PathGen = Imagine 2.5D tiles. |
| Speeding Bolt legs without speeding the plate | Stride follows `pictureTime`. The card cannot outrun the cook. |
| Dual dogs (Bolt in plate + card) | Clip never draws Bolt. |
| Reading obstacles from video pixels | Hits are `(t, lane)` on the time-rail. No CV. |

## Repo pointers

| Path | Role |
|------|------|
| [`play/`](../play/) | 2.5D biome Vite app — branch `biome-25d` |
| [`game/`](../game/) | Three.js hybrid proto (mesh + SprintCore; different stack) |
| Continuity | boltverse-odyssey **cook-room** / **imagine-hooks** first+last / `last_frame` |

Run the biome app: `cd play && npm i && npm run dev`.

Plates: `play/public/biomes/asteroid/films/`. Bolt card: `play/public/hybrid/run/`. Vis/hid stitch: `play/src/dom-swap.ts`.

**Playlist rateCurve + tint:** drop odyssey analyze `playlist.json` next to the films (`play/public/biomes/asteroid/playlist.json`). `play/` reads `plates[].rateCurve` and drives `video.playbackRate` live from `pictureTime` every frame / ~0.1 s. Tint samples lower-third ground+haze at the same 0.1 s cadence (`src/biome-25d-speed.ts`). See [`play/README.md`](../play/README.md).
