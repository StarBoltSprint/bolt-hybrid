# 05 — Controls

Modes de contrôle Bolt Hybrid.

## Wide rail — CLEAR + strafe dodge

- Rail large : avance autorisée (**CLEAR**).
- **Strafe dodge** : esquive latérale sur le rail (pas full 3D roam).
- Obstacles = volumes timed ; dodge = input latéral + état SprintCore.

## Howl

- **Howl** → **pause média** (MediaPlayer pause).
- Gameplay / pose peuvent tenir ; le décor freeze pendant Howl.
- Resume média sur fin Howl (règle produit à figer en proto).

## Full roam — heightfield (proto actuel)

- Mode **heightfield** : roam libre sur relief (proto Three.js actuel).
- Distinct du rail CLEAR production.
- Proto = exploration feel ; cible hybrid = rail + dodge d’abord.

## Rappel caméra

Caméra suit le **mesh** uniquement — jamais la caméra du clip.
