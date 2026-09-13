# 06 — Proto status (Three.js)

État du proto `game/` (Three.js) vs cible hybrid.

Live: https://olive-lion-quartz-craft.grok.me

## Présent

| Feature | Status |
|---------|--------|
| SprintCore (m/w, 1/60) | ✅ |
| Hall / Citadel roam (no dodge) | ✅ |
| Doors (cyan L / gold R in picture) | ✅ |
| Imagine VideoTexture plates | ✅ |
| KEEP `bolt.glb` (white coat, 0.6 m withers) | ✅ |
| Stick / strafe (no spin-in-place) | ✅ |
| Biome dodge volumes `{x,z,r,kind,beat}` | ✅ |
| Wire debug (`L` / `?wire=1`) | ✅ |

## Missing

| Feature | Status |
|---------|--------|
| Beat-gated volumes vs spatial-only | ⏳ volumes are spatial; `beat` is authoring cue |
| Plate timeline / stitch | ❌ |
| UE scaffold | TBD |

## Ordre d’attaque

1. ~~Cubes~~ → **invisible volumes** wrapping Imagine paint (shipped)  
2. Tune `beat` rows to Imagine seconds  
3. Plate timeline + stitch momentum  

## UE

Scaffold Unreal = **TBD**. Architecture lock côté docs. Playable path is browser-only (`game/`).
