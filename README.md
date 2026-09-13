# Bolt Hybrid — Architecture Bible

> **Loi :** Unreal dessine ; SprintCore décide ; Imagine habille.

Bible publique d’architecture pour **Bolt Hybrid** / **SprintCore** / **Unreal** / **Grok Imagine**.  
Lock architecture. Proto Three.js existant. Scaffold UE : TBD.

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
| Proto Three.js (`bolt-hybrid`) | Existe (SprintCore + hall + doors + sky hash) |
| UE scaffold | **TBD** |
| Obstacle track / VideoTexture / plate timeline | Missing (cubes first → Imagine clips) |

## Stack mental model

```
Imagine  →  décor (MediaTexture, sky, ribbon, relics)
SprintCore →  décision (pats, m, w, integrator 1/60)
Unreal   →  dessin (mesh, cam boom, volumes, PCG)
```

Pas de secrets. Pas d’API keys. Directeur-first.
