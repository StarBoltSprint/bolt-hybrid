# Anti-patterns

Pièges. Si tu les vois en review → reject.

## Bolt in Imagine + mesh

Double wolf : clip peint un Bolt **et** mesh jouable.  
→ **Loi :** Imagine never draws Bolt.

## « Le wolf vidéo dodge sur D »

Espérer que le loup du clip réagisse à l’input.  
→ Input = SprintCore + mesh. Vidéo = décor.

## Single 60s cook

Un seul clip monolithique 60s sans plates / playlist / DataTable.  
→ Stitch plates 8–12s ; MediaPlayer playlist ; obstacles par plate.

## Physics of the clip

Lire la physique / collisions dans les pixels ou la caméra encodée.  
→ Volumes 3D timed ; caméra boom mesh ; SprintCore 1/60. Pas de CV. Pas de Chaos-pour-le-sprint.

## Bonus rejects

| Anti-pattern | Correctif |
|--------------|-----------|
| CMC « parce que UE » | `USprintCoreComponent` on `APawn` |
| Lumen sur MediaTexture | Unlit media |
| Reset `m` à chaque plate | Momentum survit |
| Obstacles from pixels | DataTable + volumes |
