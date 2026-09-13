# 00 — Lois dures

Non négociables. Si ça contredit une loi → la loi gagne.

## 1. Imagine never draws Bolt

**No double wolf.** Imagine habille le décor (ciel, ruban, reliques, ambiance).  
Le loup jouable = **mesh** piloté par SprintCore. Jamais un Bolt peint dans le clip + un mesh par-dessus.

## 2. Video = décor qui scroll ; mesh + SprintCore = le jeu

| Rôle | Source |
|------|--------|
| Décor qui défile | Clip Imagine / MediaTexture |
| Gameplay | Mesh + SprintCore (pats, momentum, collisions volumes) |

Le pixel vidéo n’est **pas** l’état du jeu.

## 3. Ne pas migrer la physique vers Chaos « because UE »

SprintCore reste l’intégrateur fixe **1/60**.  
Chaos = optionnel (ragdoll au contact uniquement).  
Ne pas réécrire le sprint dans Chaos / PhysX « pour faire propre UE ».

## 4. Camera follows MESH only

La caméra suit le **mesh** (boom sur le pawn).  
**Jamais** la caméra encodée dans le clip Imagine. Le clip n’impose pas le framing.

## 5. Obstacles = volumes 3D timed — pas de CV sur pixels

Obstacles = volumes invisibles placés en 3D, synchronisés aux beats Imagine (DataTable / timeline).  
**Interdit :** computer vision / extraction d’obstacles depuis les pixels vidéo.

## 6. CMC OUT — custom `USprintCoreComponent` on `APawn`

Character Movement Component = **OUT**.  
Mouvement = `USprintCoreComponent` custom sur `APawn`. Pas de Character + CMC « par défaut Unreal ».
