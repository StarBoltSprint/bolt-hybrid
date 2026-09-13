# 04 — Pipeline Unreal

Flux runtime minimal. CMC out.

## Tick loop

```
SprintCore.fixedUpdate (1/60)
        │
        ▼
   Pawn pose (mesh transform)
        │
        ▼
   Camera boom (follow MESH only)
```

## Media Framework

- `MediaPlayer` + playlist plates.
- `MediaTexture` → materials sky / ribbon / décor.
- Material sky : **lerp** entre états / plates (pas Lumen sur le média).

## Pourquoi pas CMC

- CMC = Character Movement « black box » ; SprintCore est l’autorité (pats, `m`, `w`, hits).
- Custom `USprintCoreComponent` on `APawn` = source unique de vérité mouvement.
- Chaos ragdoll = contact only ; sprint reste fixed-step.

## Content / map minimale

```
Content/
  SprintCore/     # component, pawn, data
  Obstacles/      # BP AObstacle, DataTables
  Media/          # MediaPlayer, textures, playlist
  Maps/           # map minimale (rail + lights + pawn)
  Debug/          # cubes volumes (DEV)
```

## Nanite / Lumen notes

| Surface | Note |
|---------|------|
| Mesh joueur / env static | Nanite OK si assets le permettent |
| **MediaTexture** | **Unlit** — pas de Lumen sur le média |
| Décor média | Pas d’éclairage global Lumen sur la plaque vidéo |

Media = plaque décor ; mesh = monde lit.
