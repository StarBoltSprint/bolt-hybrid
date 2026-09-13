# 02 — Architecture 60s (plates)

Run ~60s = chaîne de **plates** 8–12s. Momentum survit au changement de plate.

## Plates (exemple stitch)

| # | Plate | Durée cible | Feel |
|---|-------|-------------|------|
| 1 | `forest-rail` | 8–12s | Rail large, CLEAR |
| 2 | `ember-narrow` | 8–12s | Couloir serré, pression |
| 3 | `void-fork` | 8–12s | Bifurcation / choix |
| 4 | `gold-peak` | 8–12s | Crest, payoff |
| 5 | `forest-exit` | 8–12s | Sortie / boucle |

Total ≈ 40–60s selon timing éditorial.

## MediaPlayer playlist

- Une **playlist** Media Framework : une entrée média (ou segment) par plate.
- Changement de plate = next item playlist + sync DataTable obstacles.
- **Momentum `m` survit** : pas de reset soft au stitch ; le joueur emporte sa vitesse.

## Diagramme ASCII

```
[ Imagine clips / MediaPlayer playlist ]
        │  décor scroll (sky / ribbon / relics)
        ▼
 ┌────────────── plates 8–12s ──────────────┐
 │ forest-rail → ember-narrow → void-fork   │
 │            → gold-peak → forest-exit     │
 └──────────────────┬───────────────────────┘
                    │ beats → obstacle DataTable
                    ▼
        [ SprintCore 1/60 | mesh | cam boom ]
                    │
                    ▼
              hit: cut m + knock
```

## Stitch rules

1. Plate change ≠ reset gameplay.
2. Media crossfade / cut OK ; **état SprintCore continu**.
3. Obstacles re-timés par plate, même schéma `AObstacle`.
