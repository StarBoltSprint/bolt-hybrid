# 01 — Couches (Reste | Dans UE)

Qui décide quoi. SprintCore garde le cerveau ; UE rend et héberge les bindings.

## Table

| Couche | Reste (SprintCore / data) | Dans UE |
|--------|---------------------------|---------|
| Sprint / pats / momentum `m` / width `w` | Intégrateur fixe 1/60, pats, `m`, `w` | `USprintCoreComponent` → pose pawn |
| Sol / obstacles / camera | Timing obstacles, rail, follow mesh | Volumes 3D, boom cam, collision query |
| Sky / ribbon / relics | Playlist / plate IDs, beats | MediaTexture, MediaPlayer, materials |
| Mesh look | — | Mesh + materials (pas le Bolt Imagine) |
| Densité PCG | `w` (largeur / densité) | PCG sample density = `w` |

## Chaos (optionnel)

- **Ragdoll** au contact uniquement (hit → optional Chaos).
- Le **sprint** ne passe **pas** en Chaos : reste l’intégrateur fixe **1/60**.

## Règle de séparation

```
SprintCore  →  décide (pats, m, w, hits)
UE render   →  dessine (mesh, MediaTexture, volumes debug)
Imagine     →  habille (clips décor, pas le joueur)
```
