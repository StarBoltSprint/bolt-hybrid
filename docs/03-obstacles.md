# 03 — Obstacles

Volumes invisibles alignés sur les **beats peints** Imagine. Jamais extraits des pixels.

## Modèle

```
AObstacle { x, z, r, kind }
```

| Champ | Rôle |
|-------|------|
| `x`, `z` | Position plan (rail / world) |
| `r` | Rayon / half-extent |
| `kind` | Type hit (cut, knock, soft, …) |

## Timing

- **DataTable** (ou timeline plate) : temps / beat → spawn ou activate volume.
- Alignement éditorial sur les beats du clip Imagine — placement **manuel / data**, pas CV.

## Hit

- Hit → **cut `m`** (momentum) + **knock** (impulsion latérale / recul selon `kind`).
- Pas de « le loup vidéo a esquivé ».

## Debug

- **Cubes debug only** (wire / translucent) en DEV.
- Shipping : volumes invisibles, collision query seule.

## Interdit

- Extraire obstacles depuis pixels vidéo.
- Faire confiance au « wolf dans le clip » pour le dodge.
