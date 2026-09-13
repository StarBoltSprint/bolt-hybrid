# Bolt Hybrid — Architecture Bible

> **Loi :** Unreal dessine ; SprintCore décide ; Imagine habille.

Bible publique d’architecture pour **Bolt Hybrid** / **SprintCore** / **Unreal** / **Grok Imagine**.  
Lock architecture. Proto Three.js existant. Scaffold UE : TBD.

## Playable proto (browser)

The Three.js + SprintCore hybrid is in [`game/`](game/). Imagine plates are the world. KEEP `bolt.glb` is the pawn. Hall = calm roam. Biome = sprint + dodge volumes.

```bash
cd game
npm i
npm run dev
```

Live: https://olive-lion-quartz-craft.grok.me  
How to run, controls, and how to add `Obstacle` rows: [`game/README.md`](game/README.md)

## Quick start — carte des docs

| Doc | Contenu |
|-----|---------|
| [00-law](docs/00-law.md) | Lois dures (non négociables) |
| [01-layers](docs/01-layers.md) | Couche \| Reste \| Dans UE |
| [02-architecture-60s](docs/02-architecture-60s.md) | Plates 8–12s, MediaPlayer, momentum |
| [03-obstacles](docs/03-obstacles.md) | Volumes 3D timed, DataTable, never CV |
| [04-unreal-pipeline](docs/04-unreal-pipeline.md) | fixedUpdate → pose → cam ; Media ; anti-CMC |
| [05-controls](docs/05-controls.md) | Rail CLEAR, Howl, heightfield roam |
| [06-proto-status](docs/06-proto-status.md) | Three.js : ce qui tourne / ce qui manque |
| [anti-patterns](docs/anti-patterns.md) | Pièges à ne pas reproduire |

## Status

| Item | État |
|------|------|
| Architecture | **LOCK** |
| Proto Three.js (`game/`) | **Playable** — SprintCore + Imagine hall + KEEP mesh + biome dodge volumes |
| UE scaffold | **TBD** |
| Obstacle track | **Proto shipped** (invisible `{x,z,r,kind,beat}` in biome; hall = none) |

## Stack mental model

```
Imagine  →  décor (MediaTexture, sky, ribbon, relics)
SprintCore →  décision (pats, m, w, integrator 1/60)
Unreal   →  dessin (mesh, cam boom, volumes, PCG)
```

Browser proto: Imagine paints ; SprintCore decides ; Three.js draws. Unreal is out of the playable path.

Pas de secrets. Pas d’API keys. Directeur-first.
