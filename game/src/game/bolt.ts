/**
 * Runtime Bolt — KEEP glb via GLTFLoader.
 * White coat. In-place clips. Translation = SprintCore only.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { PAWN_WITHERS_M, SPRINT_MS, WALK_MS } from "./sprintcore";

export const BOLT_GLB_KEEP =
  "https://raw.githubusercontent.com/StarBoltSprint/bolt-hybrid/master/assets/bolt.glb";
export const BOLT_GLB_LOCAL = "/assets/bolt.glb?v=keep";

export type BoltMesh = {
  root: THREE.Group;
  body: THREE.Object3D;
  shadow: THREE.Mesh;
  legs: THREE.Object3D[];
  head: THREE.Object3D | null;
  tail: THREE.Object3D | null;
  earL: THREE.Object3D | null;
  earR: THREE.Object3D | null;
  aspect: number;
  feetOrigin: boolean;
  rigged: boolean;
  mixer: THREE.AnimationMixer | null;
  clips: { idle?: THREE.AnimationClip; walk?: THREE.AnimationClip; run?: THREE.AnimationClip; jump?: THREE.AnimationClip };
  action: THREE.AnimationAction | null;
  gait: "idle" | "walk" | "run" | "jump";
  armature: THREE.Object3D | null;
};

function tintWhiteCoat(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.frustumCulled = false;
    m.renderOrder = 8;
    m.castShadow = false;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const raw of mats) {
      const mat = raw as THREE.MeshStandardMaterial;
      if (!mat) continue;
      mat.vertexColors = false;
      mat.color.setHex(0xf7f4ef);
      mat.roughness = 0.58;
      mat.metalness = 0.0;
      mat.emissive.setHex(0x1c2a30);
      mat.emissiveIntensity = 0.05;
      mat.side = THREE.DoubleSide;
      if (mat.map) mat.map = null;
    }
  });
}

function stripRootMotion(clip: THREE.AnimationClip) {
  clip.tracks = clip.tracks.filter((t) => {
    const n = t.name.toLowerCase();
    return !(n.startsWith("scene.position") || n.startsWith("animalarmature.position") || n.startsWith("root.position"));
  });
}

function pickClip(clips: THREE.AnimationClip[], names: string[]) {
  const lower = names.map((n) => n.toLowerCase());
  return (
    clips.find((c) => lower.includes(c.name.toLowerCase())) ||
    clips.find((c) => lower.some((n) => c.name.toLowerCase().includes(n)))
  );
}

function findBone(root: THREE.Object3D, names: string[]) {
  for (const n of names) {
    const hit = root.getObjectByName(n);
    if (hit) return hit;
  }
  let found: THREE.Object3D | null = null;
  const lower = names.map((n) => n.toLowerCase());
  root.traverse((o) => {
    if (!found && o.name && lower.includes(o.name.toLowerCase())) found = o;
  });
  return found;
}

async function loadGltf() {
  const loader = new GLTFLoader();
  try {
    return { gltf: await loader.loadAsync(BOLT_GLB_KEEP), src: BOLT_GLB_KEEP };
  } catch {
    return { gltf: await loader.loadAsync(BOLT_GLB_LOCAL), src: BOLT_GLB_LOCAL };
  }
}

export async function createBoltMesh(): Promise<BoltMesh> {
  const { gltf, src } = await loadGltf();
  const scene = gltf.scene;
  scene.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  const nativeWithers = Math.max(0.2, size.y * 0.72);
  const k = PAWN_WITHERS_M / nativeWithers;
  scene.position.y = -box.min.y * k;
  scene.scale.setScalar(k);
  scene.traverse((o) => {
    const sm = o as THREE.SkinnedMesh;
    if (sm.isSkinnedMesh) sm.bindMode = THREE.AttachedBindMode;
  });
  tintWhiteCoat(scene);

  const clips = gltf.animations ?? [];
  for (const c of clips) stripRootMotion(c);

  const idle = pickClip(clips, ["Idle", "idle"]);
  const walk = pickClip(clips, ["Walk", "Trot", "walk"]);
  const run = pickClip(clips, ["Run", "Sprint", "Gallop", "run"]);
  const jump = pickClip(clips, ["Run_Jump", "Jump", "jump"]);

  const armature = findBone(scene, ["BoltArmature", "AnimalArmature", "Armature"]) ?? scene;
  const mixer = clips.length ? new THREE.AnimationMixer(scene) : null;

  const legs = [
    findBone(scene, ["FL_upper", "LegFL"]),
    findBone(scene, ["FR_upper", "LegFR"]),
    findBone(scene, ["BL_upper", "LegBL"]),
    findBone(scene, ["BR_upper", "LegBR"]),
  ].filter((n): n is THREE.Object3D => !!n);
  for (const leg of legs) leg.userData.restX = leg.rotation.x;

  const body = new THREE.Group();
  body.name = "BoltBody";
  body.add(scene);

  const shCanvas = document.createElement("canvas");
  shCanvas.width = 128;
  shCanvas.height = 128;
  const sctx = shCanvas.getContext("2d");
  if (sctx) {
    const g = sctx.createRadialGradient(64, 72, 6, 64, 64, 62);
    g.addColorStop(0, "rgba(6,10,16,0.7)");
    g.addColorStop(0.35, "rgba(8,16,24,0.32)");
    g.addColorStop(0.7, "rgba(10,22,32,0.1)");
    g.addColorStop(1, "rgba(10,22,32,0)");
    sctx.fillStyle = g;
    sctx.fillRect(0, 0, 128, 128);
  }
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(shCanvas),
      color: 0x071018,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      depthTest: false,
    }),
  );
  shadow.renderOrder = 7;
  shadow.frustumCulled = false;

  const root = new THREE.Group();
  root.add(shadow);
  root.add(body);
  root.visible = false;

  const bolt: BoltMesh = {
    root,
    body,
    shadow,
    legs,
    head: findBone(scene, ["head", "Head"]),
    tail: findBone(scene, ["tail", "Tail", "Tail1"]),
    earL: findBone(scene, ["Ear1L", "EarL"]),
    earR: findBone(scene, ["Ear1R", "EarR"]),
    aspect: 0.72,
    feetOrigin: true,
    rigged: !!mixer,
    mixer,
    clips: { idle, walk, run, jump },
    action: null,
    gait: "idle",
    armature,
  };

  if (mixer && idle) {
    bolt.action = mixer.clipAction(idle);
    bolt.action.play();
  }

  window.__boltMeshInfo = {
    src,
    size: [+size.x.toFixed(3), +size.y.toFixed(3), +size.z.toFixed(3)],
    anims: clips.map((c) => c.name),
    keep: true,
  };

  return bolt;
}

function playGait(bolt: BoltMesh, gait: BoltMesh["gait"], timeScale: number) {
  if (!bolt.mixer) return;
  const clip = bolt.clips[gait === "jump" ? "jump" : gait] ?? (gait === "jump" ? bolt.clips.run : undefined) ?? bolt.clips.idle;
  if (!clip) return;
  if (bolt.gait === gait && bolt.action) {
    bolt.action.timeScale = timeScale;
    return;
  }
  const next = bolt.mixer.clipAction(clip);
  next.reset();
  next.setLoop(THREE.LoopRepeat, Infinity);
  next.timeScale = timeScale;
  next.enabled = true;
  if (bolt.action && bolt.action !== next) {
    bolt.action.crossFadeTo(next, 0.16, false);
  }
  next.play();
  bolt.action = next;
  bolt.gait = gait;
}

export function poseBoltMesh(
  bolt: BoltMesh,
  dt: number,
  speed: number,
  sprinting: boolean,
  grounded: boolean,
  hop: number,
  heading: number,
  dodgeT: number,
  dodgeDir: number,
  _howl: number,
  phase: { t: number },
) {
  const moving = grounded && speed > 0.35 && dodgeT <= 0;
  if (moving) phase.t += dt * (sprinting ? 12.2 : 7.4) * Math.min(1.35, speed / SPRINT_MS);
  else phase.t += dt * (dodgeT > 0 ? 18 : 1.05);

  if (bolt.mixer) {
    const hasMoveClip = !!(bolt.clips.walk || bolt.clips.run);
    if (moving && !hasMoveClip) {
      if (bolt.action) {
        bolt.action.fadeOut(0.12);
        bolt.action = null;
      }
      bolt.gait = sprinting ? "run" : "walk";
      bolt.mixer.update(dt);
    } else {
      let gait: BoltMesh["gait"] = "idle";
      let scale = 1;
      if (!grounded && hop > 0.08 && bolt.clips.jump) gait = "jump";
      else if (moving && sprinting && speed > WALK_MS * 1.15) {
        gait = bolt.clips.run ? "run" : "walk";
        scale = Math.max(0.75, Math.min(1.45, speed / SPRINT_MS));
      } else if (moving) {
        gait = bolt.clips.walk ? "walk" : "run";
        scale = Math.max(0.7, Math.min(1.35, speed / WALK_MS));
      }
      playGait(bolt, gait, scale);
      bolt.mixer.update(dt);
    }
    const rootBone = findBone(bolt.body, ["root"]);
    if (rootBone) {
      rootBone.position.x = 0;
      rootBone.position.z = 0;
    }
  }

  if (bolt.gait !== "idle" && bolt.legs.length >= 4) {
    const p = phase.t;
    const swing = Math.sin(p * Math.PI) * (sprinting ? 0.48 : 0.32);
    const [fl, fr, bl, br] = bolt.legs;
    const rx = (leg: THREE.Object3D | undefined, add: number) => {
      if (!leg) return;
      const rest = Number(leg.userData.restX ?? 0);
      leg.rotation.x = rest + add;
    };
    rx(fl, swing);
    rx(br, swing);
    rx(fr, -swing);
    rx(bl, -swing);
  }

  const dodgeRoll = dodgeT > 0 ? Math.sin((1 - dodgeT / 0.22) * Math.PI) * dodgeDir * 1.05 : 0;
  bolt.body.rotation.order = "YXZ";
  bolt.body.rotation.y = Math.PI + heading + 0.85;
  bolt.body.rotation.z = dodgeRoll;
  bolt.body.rotation.x = dodgeT > 0 ? -0.28 : hop > 0.08 ? -0.1 : 0;

  bolt.body.userData.squash = dodgeT > 0 ? 0.86 : hop > 0.08 ? 1.04 : 1;
  bolt.body.userData.bob = hop;
  const sh = bolt.shadow.material as THREE.MeshBasicMaterial;
  sh.opacity = grounded ? 0.7 : 0.22;
}
