# Bolt Hybrid — playable proto

Browser Three.js + SprintCore. Imagine plates are the world. KEEP `bolt.glb` is the pawn. Unreal is out.

Live: https://olive-lion-quartz-craft.grok.me

## Run

```bash
cd game
npm i
npm run dev
```

Open the local URL Vite prints. Click **Start**.

## Law

- **Blender = asset only.** KEEP glb via GLTFLoader. White coat. Withers 0.6 m. Idle in-place; SprintCore owns translation.
- **Three.js = game.** Video décor, camera, pose. Does not integrate motion.
- **SprintCore JS owns movement.** Meters / world, fixed `1/60`. Walk 2.4 m/s, sprint 5.2 m/s. Writes position / speed / momentum / worldInfluence only.
- **Imagine = short décor plates only.** Never draw Bolt in Imagine. Paints obstacles; we wrap them with invisible `{x,z,r,kind,beat}` volumes.
- **Hall / Citadel = calm roam, no dodge.** **Biome = sprint rail + dodge.**
- **Unreal = OUT.**

## Controls

| Input | Action |
| --- | --- |
| WASD / arrows | Walk |
| Shift | Sprint |
| Bottom-left drag | Stick (ghost only while held) |
| Bottom-right hold | Sprint |
| Horizontal swipe (outside stick) | Strafe — no spin |
| Q / Ctrl / C or double-tap A/D | Dodge (**biome only**) |
| Flick | Dodge (**biome only**) |
| Space | Jump |
| E or tap portal | Enter once armed (momentum ≥ 6) |
| H | Howl |
| P | Pause |
| L or `?wire=1` | Debug dodge volumes |

## Hall vs biome

Canyon start (`ice`) is the Citadel hall: roam, sprint to arm doors, **no dodge**.

Gold (right): Canyon → Crystal → Ember → Void → Canyon. Cyan walks backward.

In a **biome**, SprintCore loads the obstacle table. Strafe the CLEAR gap (always a left **or** right opening). Clip a volume → cut momentum + small lateral knock. Miss → keep flow.

## Adding dodge volumes

Edit the biome in [`src/game/biomes.ts`](src/game/biomes.ts). Imagine paints the arch/crystal/pillar; we only wrap it.

```ts
obstacles: [
  { x: 1.55, z: 2.9, r: 0.86, kind: "arch", beat: 7 },   // 0:07 right arch, left gap
  { x: -1.62, z: 5.7, r: 0.90, kind: "fork", beat: 18 }, // 0:18 left fork, right gap
]
```

| Field | Meaning |
| --- | --- |
| `x` | Meters, `0` = hall center. Positive = right. |
| `z` | Meters along the hall (`0` = spawn, `14` = far). |
| `r` | Radius meters. Keep `\|x\| + r` under half-width so a gap remains. |
| `kind` | `arch` \| `crystal` \| `pillar` \| `fork` |
| `beat` | Seconds on the Imagine breath (`7` = 0:07). Authoring cue. |

Hall biomes use `mode: "hall"` and `obstacles: []`.

## Layout

```
game/
  src/game/sprintcore.ts   SprintCore (m/w, 1/60)
  src/game/biomes.ts       plates, obstacle tables, hall vs biome
  src/game/engine.ts       Three.js hall, stick, boom, wires
  src/game/bolt.ts         KEEP glTF load + in-place clips
  src/game/GameApp.tsx     canvas + Start
  public/assets/bolt.glb   KEEP mesh
  public/decor/            Imagine breath loops + stills
```

No wallet. No player API keys. No Unreal.
