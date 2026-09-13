import * as THREE from "three";
import { createBoltMesh, poseBoltMesh, type BoltMesh } from "./bolt";
import {
  BIOMES,
  PLATE,
  decorUrl,
  hallMeters,
  nextBiome,
  prevBiome,
  type BiomeId,
  type DecorSlot,
} from "./biomes";
import { DOOR_ARM_MOMENTUM, DT, PAWN_WITHERS_M, SprintCore } from "./sprintcore";

const FIXED = DT;
const DECOR_SLOTS: DecorSlot[] = ["plate", "near-l", "near-r"];
const MOTE_COUNT = 48;

export type HudSnapshot = {
  biome: BiomeId;
  biomeName: string;
  nextLabel: string;
  momentum: number;
  worldInfluence: number;
  cleanliness: number;
  speed: number;
  doorArmed: boolean;
  nearDoor: boolean;
  nearDoorSide: "L" | "R" | null;
  paused: boolean;
  playing: boolean;
  howl: number;
  chain: number;
  fade: number;
  dodging: boolean;
};

export type ControlsProbe = {
  getYaw: () => number;
  getSpeed: () => number;
  setSteer?: (v: number) => void;
  setKeys?: (codes: string[]) => void;
};

export type BoltApi = {
  getHud: () => HudSnapshot;
  resetRun: () => void;
  debug: () => Record<string, unknown>;
  advance: (seconds: number) => void;
  enterBiome: (id: BiomeId) => void;
};

declare global {
  interface Window {
    __controlsTest?: ControlsProbe;
    __boltHybrid?: BoltApi;
    __boltReady?: boolean;
    __boltFrames?: number;
    __boltMeshInfo?: Record<string, unknown>;
  }
}

type DecorPack = Record<DecorSlot, THREE.Texture>;

function loadTexture(url: string): Promise<THREE.Texture> {
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin("anonymous");
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.needsUpdate = true;
        resolve(tex);
      },
      undefined,
      () => reject(new Error(`decor missing: ${url}`)),
    );
  });
}

export class BoltHybridEngine {
  canvas: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  timer = new THREE.Timer();

  playing = false;
  paused = false;
  biome: BiomeId = "ice";
  core = new SprintCore(hallMeters(PLATE));
  fadeT = 0;

  keys = new Set<string>();
  injectedKeys: string[] | null = null;
  injectedSteer: number | null = null;
  moveAxis = { x: 0, y: 0 };
  lookDx = 0;
  lookDy = 0;
  parallax = new THREE.Vector2();

  private acc = 0;
  private disposed = false;
  private bolt: BoltMesh | null = null;
  private phase = { t: 0 };
  private packs = new Map<BiomeId, DecorPack>();
  private breaths = new Map<BiomeId, { el: HTMLVideoElement; tex: THREE.VideoTexture }>();
  private live = true;
  private plateMat: THREE.ShaderMaterial;
  private relicMat: THREE.ShaderMaterial;
  private relics: THREE.Mesh[] = [];
  private wireMeshes: THREE.Mesh[] = [];
  private showWires = false;
  private lastStrafe = { code: "", t: 0 };
  private simT = 0;
  private dragT = 0;
  private howlMesh: THREE.Mesh;
  private howlMat: THREE.MeshBasicMaterial;
  private auraMesh: THREE.Mesh;
  private auraMat: THREE.MeshBasicMaterial;
  private auraLight: THREE.PointLight;
  private fadeMat: THREE.MeshBasicMaterial;
  private pGeo: THREE.BufferGeometry;
  private pMat: THREE.PointsMaterial;
  private pOrigins: Float32Array;
  private plateRect = { x: -1, y: -1, w: 2, h: 2 };
  private plateMesh: THREE.Mesh;
  private boom = new THREE.Vector2();
  private stickAxis = { x: 0, y: 0 };
  private swipeAxis = { x: 0 };
  private stickPtr: number | null = null;
  private sprintPtr: number | null = null;
  private swipePtr: number | null = null;
  private stickOrigin = { x: 0, y: 0 };
  private swipeOrigin = { x: 0, y: 0 };
  private stickGhost: THREE.Mesh;
  private stickNub: THREE.Mesh;
  private stickMat: THREE.MeshBasicMaterial;
  private onHud: (h: HudSnapshot) => void;
  private hudClock = 0;
  private just = new Set<string>();
  private prevHeld = new Set<string>();
  private loopFn = () => this.frame();
  private ro: ResizeObserver | null = null;
  private pointerId: number | null = null;
  private dragOrigin = { x: 0, y: 0 };
  private dragging = false;
  private didDrag = false;
  private pointer = { x: 0.5, y: 0.5 };
  private touchSprint = false;
  private unkeys: () => void = () => {};
  private unptr: () => void = () => {};
  private probe: ControlsProbe | null = null;
  private hudApi: BoltApi | null = null;

  constructor(canvas: HTMLCanvasElement, onHud: (h: HudSnapshot) => void) {
    this.canvas = canvas;
    this.onHud = onHud;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.setClearColor(0x07080c, 1);

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
    this.camera.position.z = 1;

    this.plateMat = this.makePlateMat();
    this.plateMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.plateMat);
    this.plateMesh.frustumCulled = false;
    this.plateMesh.renderOrder = 0;
    this.scene.add(this.plateMesh);

    this.scene.add(new THREE.AmbientLight(0xe8e4dc, 1.05));
    const key = new THREE.DirectionalLight(0xfff6ea, 1.25);
    key.position.set(0.5, 0.85, 1.3);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x9be7f0, 0.28);
    fill.position.set(-0.7, 0.4, 0.8);
    this.scene.add(fill);
    const rim = new THREE.PointLight(0x7ee7ff, 0.55, 4, 2);
    rim.position.set(0, 0.4, 0.8);
    this.scene.add(rim);
    this.auraLight = rim;

    this.relicMat = new THREE.ShaderMaterial({
      uniforms: {
        tLive: { value: null },
        uTime: { value: 0 },
        uInfluence: { value: 0 },
        uCrop: { value: new THREE.Vector4(0.1, 0.4, 0.2, 0.3) },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D tLive;
        uniform float uTime, uInfluence;
        uniform vec4 uCrop;
        void main() {
          vec2 uv = uCrop.xy + vUv * uCrop.zw;
          vec3 col = texture2D(tLive, uv).rgb;
          float edge = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x)
                     * smoothstep(0.0, 0.1, vUv.y) * smoothstep(1.0, 0.86, vUv.y);
          float pulse = 0.55 + 0.45 * sin(uTime * 2.2 + vUv.y * 6.0);
          float a = (0.18 + uInfluence * 0.45) * edge * pulse;
          gl_FragColor = vec4(col, a);
        }
      `,
    });
    const relicSpots = [
      { u: 0.16, v: 0.74, w: 0.08, h: 0.18, crop: new THREE.Vector4(0.04, 0.52, 0.24, 0.36) },
      { u: 0.84, v: 0.74, w: 0.08, h: 0.18, crop: new THREE.Vector4(0.72, 0.52, 0.24, 0.36) },
      { u: 0.1, v: 0.5, w: 0.055, h: 0.13, crop: new THREE.Vector4(0.0, 0.28, 0.22, 0.32) },
      { u: 0.9, v: 0.5, w: 0.055, h: 0.13, crop: new THREE.Vector4(0.78, 0.28, 0.22, 0.32) },
    ];
    for (const s of relicSpots) {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.relicMat.clone());
      mesh.userData.spot = s;
      mesh.frustumCulled = false;
      mesh.renderOrder = 3;
      this.scene.add(mesh);
      this.relics.push(mesh);
    }

    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x7ee7ff,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      depthTest: false,
      wireframe: true,
    });
    for (let i = 0; i < 8; i++) {
      const mesh = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 28), wireMat);
      mesh.frustumCulled = false;
      mesh.renderOrder = 5;
      mesh.visible = false;
      this.scene.add(mesh);
      this.wireMeshes.push(mesh);
    }

    this.pOrigins = new Float32Array(MOTE_COUNT * 3);
    const pPos = new Float32Array(MOTE_COUNT * 3);
    for (let i = 0; i < MOTE_COUNT; i++) {
      this.pOrigins[i * 3] = 0.12 + Math.random() * 0.76;
      this.pOrigins[i * 3 + 1] = 0.08 + Math.random() * 0.7;
      this.pOrigins[i * 3 + 2] = Math.random();
    }
    this.pGeo = new THREE.BufferGeometry();
    this.pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    this.pMat = new THREE.PointsMaterial({
      color: BIOMES.ice.particle,
      size: 3.5,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(this.pGeo, this.pMat);
    points.renderOrder = 6;
    points.frustumCulled = false;
    this.scene.add(points);

    this.howlMat = new THREE.MeshBasicMaterial({
      color: 0x9be7f0,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    this.howlMesh = new THREE.Mesh(new THREE.RingGeometry(0.04, 0.055, 40), this.howlMat);
    this.howlMesh.visible = false;
    this.howlMesh.renderOrder = 9;
    this.howlMesh.frustumCulled = false;
    this.scene.add(this.howlMesh);

    const auraCanvas = document.createElement("canvas");
    auraCanvas.width = 128;
    auraCanvas.height = 128;
    const actx = auraCanvas.getContext("2d");
    if (actx) {
      const g = actx.createRadialGradient(64, 64, 6, 64, 64, 62);
      g.addColorStop(0, "rgba(180,255,255,0.95)");
      g.addColorStop(0.28, "rgba(90,230,255,0.45)");
      g.addColorStop(0.62, "rgba(70,200,255,0.12)");
      g.addColorStop(1, "rgba(70,200,255,0)");
      actx.fillStyle = g;
      actx.fillRect(0, 0, 128, 128);
    }
    this.auraMat = new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(auraCanvas),
      color: 0xb8fbff,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    this.auraMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.auraMat);
    this.auraMesh.renderOrder = 7.5;
    this.auraMesh.frustumCulled = false;
    this.auraMesh.visible = false;
    this.scene.add(this.auraMesh);

    this.stickMat = new THREE.MeshBasicMaterial({
      color: 0x9be7f0,
      transparent: true,
      opacity: 0.1,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    this.stickGhost = new THREE.Mesh(new THREE.RingGeometry(0.085, 0.098, 36), this.stickMat);
    this.stickGhost.renderOrder = 21;
    this.stickGhost.frustumCulled = false;
    this.stickGhost.visible = false;
    this.scene.add(this.stickGhost);
    this.stickNub = new THREE.Mesh(new THREE.RingGeometry(0.018, 0.03, 24), this.stickMat);
    this.stickNub.renderOrder = 21;
    this.stickNub.frustumCulled = false;
    this.stickNub.visible = false;
    this.scene.add(this.stickNub);

    this.fadeMat = new THREE.MeshBasicMaterial({
      color: 0x07080c,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const fade = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.fadeMat);
    fade.position.z = 0.4;
    fade.renderOrder = 20;
    fade.frustumCulled = false;
    this.scene.add(fade);

    this.bindInput();
    this.resize();
    this.showWires = new URLSearchParams(window.location.search).has("wire");
    this.applyStage(this.biome);
    window.addEventListener("resize", this.onResize);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
  }

  private makePlateMat() {
    return new THREE.ShaderMaterial({
      uniforms: {
        tPlate: { value: null },
        tNearL: { value: null },
        tNearR: { value: null },
        uX: { value: 0 },
        uZ: { value: 0.08 },
        uTime: { value: 0 },
        uInfluence: { value: 0 },
        uDoorArmed: { value: 0 },
        uNearL: { value: 0 },
        uNearR: { value: 0 },
        uParallax: { value: new THREE.Vector2() },
        uRes: { value: new THREE.Vector2(1, 1) },
        uImgAspect: { value: PLATE.aspect },
        uMist: { value: new THREE.Vector3(0.82, 0.9, 1) },
        uLive: { value: 1 },
        uPortalL: { value: new THREE.Vector4(PLATE.portalL.u, PLATE.portalL.v, PLATE.portalL.ru, PLATE.portalL.rv) },
        uPortalR: { value: new THREE.Vector4(PLATE.portalR.u, PLATE.portalR.v, PLATE.portalR.ru, PLATE.portalR.rv) },
      },
      depthWrite: false,
      depthTest: false,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D tPlate;
        uniform sampler2D tNearL;
        uniform sampler2D tNearR;
        uniform float uX, uZ, uTime, uInfluence, uDoorArmed, uNearL, uNearR, uImgAspect, uLive;
        uniform vec2 uParallax, uRes;
        uniform vec3 uMist;
        uniform vec4 uPortalL, uPortalR;
        void main() {
          float viewA = uRes.x / max(uRes.y, 1.0);
          vec2 plateSize = viewA > uImgAspect
            ? vec2(uImgAspect / viewA, 1.0)
            : vec2(1.0, viewA / uImgAspect);
          vec2 plateMin = 0.5 - 0.5 * plateSize;
          vec2 plateUv = (vUv - plateMin) / plateSize + uParallax;

          vec2 coverUv;
          if (viewA > uImgAspect) {
            float vis = uImgAspect / viewA;
            coverUv = vec2(vUv.x, vUv.y * vis);
          } else {
            float vis = viewA / uImgAspect;
            coverUv = vec2(0.5 - 0.5 * vis + vUv.x * vis, vUv.y);
          }
          vec3 back = texture2D(tPlate, clamp(coverUv, 0.0, 1.0)).rgb * 0.18;

          if (plateUv.x < 0.0 || plateUv.x > 1.0 || plateUv.y < 0.0 || plateUv.y > 1.0) {
            gl_FragColor = vec4(back, 1.0);
            return;
          }

          vec3 spawn = texture2D(tPlate, plateUv).rgb;
          vec3 nL = texture2D(tNearL, plateUv).rgb;
          vec3 nR = texture2D(tNearR, plateUv).rgb;
          float toward = smoothstep(0.18, 0.9, uZ) * (1.0 - uLive);
          float left = smoothstep(0.04, 0.58, -uX);
          float right = smoothstep(0.04, 0.58, uX);
          vec3 col = mix(spawn, nL, toward * left * 0.8);
          col = mix(col, nR, toward * right * 0.8);

          float cyan = max(0.0, (col.b + col.g) * 0.5 - col.r - 0.1);
          float gold = max(0.0, (col.r + col.g) * 0.5 - col.b - 0.1);
          float ribbon = smoothstep(0.035, 0.2, cyan + gold);
          col += col * ribbon * uInfluence * 0.7;

          float flank = smoothstep(0.22, 0.0, min(plateUv.x, 1.0 - plateUv.x));
          col += col * flank * (cyan + gold) * uInfluence * 0.55;

          float depth = smoothstep(0.22, 0.72, plateUv.y);
          col = mix(col, col * uMist, depth * (0.05 + uInfluence * 0.16));

          vec2 pL = uPortalL.xy;
          vec2 pR = uPortalR.xy;
          vec2 rL = uPortalL.zw;
          vec2 rR = uPortalR.zw;
          float dL = length((plateUv - pL) / rL);
          float dR = length((plateUv - pR) / rR);
          float pulse = 0.5 + 0.5 * sin(uTime * 4.2);
          col += vec3(0.3, 0.9, 1.0) * smoothstep(1.12, 0.62, dL) * (0.05 + uDoorArmed * 0.18 * pulse + uNearL * 0.14);
          col += vec3(1.0, 0.74, 0.22) * smoothstep(1.12, 0.62, dR) * (0.05 + uDoorArmed * 0.18 * pulse + uNearR * 0.14);

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
  }

  async load() {
    const boltP = createBoltMesh();
    await Promise.all([this.ensureBreath("ice"), this.ensurePack("ice")]);
    if (this.disposed) return;
    this.bolt = await boltP;
    if (this.disposed) return;
    this.scene.add(this.bolt.root);
    this.applyBiome("ice", true);
    this.applyStage("ice");
    this.layoutBolt();
    this.pushHud();
    window.__boltReady = true;
    this.wireProbe();
    this.timer.reset();
    this.renderer.setAnimationLoop(this.loopFn);
    void this.ensurePack("forest");
    void this.ensurePack("ember");
    void this.ensurePack("void");
    void this.ensureBreath("forest");
    void this.ensureBreath("ember");
    void this.ensureBreath("void");
  }

  private currentBreath() {
    return this.breaths.get(this.biome) ?? null;
  }

  private async ensureBreath(id: BiomeId) {
    const hit = this.breaths.get(id);
    if (hit) return hit;
    const url = BIOMES[id].breathUrl;
    if (!url) return null;
    const video = document.createElement("video");
    video.src = url;
    video.loop = true;
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.crossOrigin = "anonymous";
    video.setAttribute("playsinline", "true");
    video.setAttribute("muted", "true");
    video.setAttribute("loop", "true");
    video.style.cssText = "position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none;z-index:-1";
    document.body.appendChild(video);
    await new Promise<void>((resolve, reject) => {
      const ok = () => {
        video.removeEventListener("canplay", ok);
        resolve();
      };
      video.addEventListener("canplay", ok);
      video.addEventListener("error", () => reject(new Error(`breath décor missing: ${url}`)), { once: true });
      video.load();
    });
    if (this.disposed) return null;
    try {
      if (id === this.biome) await video.play();
    } catch {
      /* autoplay may wait for Start */
    }
    const tex = new THREE.VideoTexture(video);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    const slot = { el: video, tex };
    this.breaths.set(id, slot);
    return slot;
  }

  private async ensurePack(id: BiomeId): Promise<DecorPack> {
    const hit = this.packs.get(id);
    if (hit) return hit;
    const entries = await Promise.all(
      DECOR_SLOTS.map(async (slot) => {
        try {
          return [slot, await loadTexture(decorUrl(id, slot))] as const;
        } catch {
          if (slot === "plate") throw new Error(`decor missing: ${id}/plate`);
          return [slot, await loadTexture(decorUrl(id, "plate"))] as const;
        }
      }),
    );
    const pack = Object.fromEntries(entries) as DecorPack;
    this.packs.set(id, pack);
    return pack;
  }

  private grammar() {
    return BIOMES[this.biome].grammar;
  }

  private applyBiome(id: BiomeId, snap = false) {
    this.biome = id;
    const def = BIOMES[id];
    const slot = this.breaths.get(id);
    this.live = def.live && !!slot;
    const pack = this.packs.get(id);
    const g = this.grammar();
    for (const [bid, b] of this.breaths) {
      if (bid === id) {
        b.el.currentTime = 0;
        void b.el.play().catch(() => {});
      } else {
        b.el.pause();
      }
    }
    if (this.live && slot) {
      this.plateMat.uniforms.tPlate!.value = slot.tex;
      this.plateMat.uniforms.tNearL!.value = slot.tex;
      this.plateMat.uniforms.tNearR!.value = slot.tex;
      for (const r of this.relics) {
        const m = r.material as THREE.ShaderMaterial;
        m.uniforms.tLive!.value = slot.tex;
      }
    } else if (pack) {
      this.plateMat.uniforms.tPlate!.value = pack.plate;
      this.plateMat.uniforms.tNearL!.value = pack["near-l"];
      this.plateMat.uniforms.tNearR!.value = pack["near-r"];
      for (const r of this.relics) {
        const m = r.material as THREE.ShaderMaterial;
        m.uniforms.tLive!.value = pack.plate;
      }
    }
    this.plateMat.uniforms.uLive!.value = this.live ? 1 : 0;
    this.plateMat.uniforms.uImgAspect!.value = g.aspect;
    this.plateMat.uniforms.uMist!.value.set(def.mist[0], def.mist[1], def.mist[2]);
    (this.plateMat.uniforms.uPortalL!.value as THREE.Vector4).set(g.portalL.u, g.portalL.v, g.portalL.ru, g.portalL.rv);
    (this.plateMat.uniforms.uPortalR!.value as THREE.Vector4).set(g.portalR.u, g.portalR.v, g.portalR.ru, g.portalR.rv);
    this.pMat.color.setHex(def.particle);
    this.howlMat.color.setHex(0x9be7f0);
    this.fadeT = snap ? 0 : 1;
    this.resize();
  }

  private bindInput() {
    const down = (e: KeyboardEvent) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (["KeyW", "KeyA", "KeyS", "KeyD", "Space", "ShiftLeft", "ShiftRight", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => this.keys.delete(e.code);
    const clear = () => this.keys.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.keys.clear();
        this.currentBreath()?.el.pause();
      } else {
        void this.currentBreath()?.el.play().catch(() => {});
      }
    });
    this.unkeys = () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
    };

    const pd = (e: PointerEvent) => {
      const uv = this.clientToUv(e.clientX, e.clientY);
      this.pointer = uv;
      if (!this.playing || this.paused) {
        this.pointerId = e.pointerId;
        this.dragging = true;
        this.didDrag = false;
        this.dragT = this.simT;
        this.dragOrigin = { x: e.clientX, y: e.clientY };
        this.canvas.setPointerCapture(e.pointerId);
        return;
      }
      const kind = this.touchZone(uv);
      if (kind === "stick" && this.stickPtr === null) {
        this.stickPtr = e.pointerId;
        this.stickOrigin = { x: e.clientX, y: e.clientY };
        this.stickAxis.x = 0;
        this.stickAxis.y = 0;
        this.canvas.setPointerCapture(e.pointerId);
        return;
      }
      if (kind === "sprint" && this.sprintPtr === null) {
        this.sprintPtr = e.pointerId;
        this.touchSprint = true;
        this.canvas.setPointerCapture(e.pointerId);
        return;
      }
      if (this.swipePtr === null) {
        this.swipePtr = e.pointerId;
        this.didDrag = false;
        this.dragT = this.simT;
        this.swipeOrigin = { x: e.clientX, y: e.clientY };
        this.dragOrigin = this.swipeOrigin;
        this.swipeAxis.x = 0;
        this.canvas.setPointerCapture(e.pointerId);
      }
    };
    const pm = (e: PointerEvent) => {
      this.pointer = this.clientToUv(e.clientX, e.clientY);
      if (!this.playing || this.paused) return;
      if (e.pointerId === this.stickPtr) {
        const dx = e.clientX - this.stickOrigin.x;
        const dy = this.stickOrigin.y - e.clientY;
        const nx = THREE.MathUtils.clamp(dx / 78, -1, 1);
        const ny = THREE.MathUtils.clamp(dy / 78, -1, 1);
        const m = Math.hypot(nx, ny);
        if (m > 1) {
          this.stickAxis.x = nx / m;
          this.stickAxis.y = ny / m;
        } else {
          this.stickAxis.x = nx;
          this.stickAxis.y = ny;
        }
        return;
      }
      if (e.pointerId === this.sprintPtr) return;
      if (e.pointerId === this.swipePtr) {
        const dx = e.clientX - this.swipeOrigin.x;
        const dy = e.clientY - this.swipeOrigin.y;
        if (Math.hypot(dx, dy) > 8) this.didDrag = true;
        this.swipeAxis.x = THREE.MathUtils.clamp(dx / 72, -1, 1);
      }
    };
    const pu = (e: PointerEvent) => {
      try {
        this.canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
      if (e.pointerId === this.stickPtr) {
        this.stickPtr = null;
        this.stickAxis.x = 0;
        this.stickAxis.y = 0;
        if (this.sprintPtr === null) this.touchSprint = false;
        return;
      }
      if (e.pointerId === this.sprintPtr) {
        this.sprintPtr = null;
        this.touchSprint = false;
        return;
      }
      if (e.pointerId !== this.swipePtr) return;
      const tap = !this.didDrag;
      const ox = this.swipeOrigin.x;
      const oy = this.swipeOrigin.y;
      this.swipePtr = null;
      this.swipeAxis.x = 0;
      this.dragging = false;
      if (tap && this.playing && !this.paused) {
        const uv = this.clientToPlate(e.clientX, e.clientY);
        if (uv) this.tapPortal(uv.u, uv.v);
      } else if (this.didDrag && this.playing && !this.paused) {
        const dx = e.clientX - ox;
        const dy = oy - e.clientY;
        const flick = Math.hypot(dx, dy) > 56 && this.simT - this.dragT < 0.22;
        if (flick) this.tryDodge(dx / 90, dy / 90);
      }
    };
    this.canvas.addEventListener("pointerdown", pd);
    this.canvas.addEventListener("pointermove", pm);
    this.canvas.addEventListener("pointerup", pu);
    this.canvas.addEventListener("pointercancel", pu);
    this.unptr = () => {
      this.canvas.removeEventListener("pointerdown", pd);
      this.canvas.removeEventListener("pointermove", pm);
      this.canvas.removeEventListener("pointerup", pu);
      this.canvas.removeEventListener("pointercancel", pu);
    };
  }

  private clientToUv(cx: number, cy: number) {
    const r = this.canvas.getBoundingClientRect();
    return { x: (cx - r.left) / Math.max(1, r.width), y: 1 - (cy - r.top) / Math.max(1, r.height) };
  }

  private touchZone(uv: { x: number; y: number }): "stick" | "sprint" | "swipe" {
    if (uv.x < 0.44 && uv.y < 0.42) return "stick";
    if (uv.x > 0.56 && uv.y < 0.42) return "sprint";
    return "swipe";
  }

  private clientToPlate(cx: number, cy: number) {
    const uv = this.clientToUv(cx, cy);
    const viewA = (this.canvas.clientWidth || 1) / Math.max(1, this.canvas.clientHeight || 1);
    const imgA = this.grammar().aspect;
    const plateSize = viewA > imgA ? { w: imgA / viewA, h: 1 } : { w: 1, h: viewA / imgA };
    const minX = 0.5 - plateSize.w / 2;
    const minY = 0.5 - plateSize.h / 2;
    const u = (uv.x - minX) / plateSize.w;
    const v = (uv.y - minY) / plateSize.h;
    if (u < 0 || u > 1 || v < 0 || v > 1) return null;
    return { u, v };
  }

  private tapPortal(u: number, v: number) {
    const g = this.grammar();
    const inL = this.inEllipse(u, v, g.portalL);
    const inR = this.inEllipse(u, v, g.portalR);
    if (inL) this.tryEnter("L");
    else if (inR) this.tryEnter("R");
  }

  private inEllipse(u: number, v: number, p: { u: number; v: number; ru: number; rv: number }) {
    const dx = (u - p.u) / p.ru;
    const dy = (v - p.v) / p.rv;
    return dx * dx + dy * dy <= 1.15;
  }

  tryLock() {
    /* locked-off camera — no pointer lock */
  }

  unlock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  setPlaying(v: boolean) {
    this.playing = v;
    if (v) {
      this.applyStage(this.biome);
      this.core.reset(hallMeters(this.grammar()));
      this.stickAxis.x = 0;
      this.stickAxis.y = 0;
      this.swipeAxis.x = 0;
      this.touchSprint = false;
      this.stickPtr = null;
      this.sprintPtr = null;
      this.swipePtr = null;
      if (this.bolt) this.bolt.root.visible = true;
      void this.currentBreath()?.el.play().catch(() => {});
    } else if (this.bolt) {
      this.bolt.root.visible = false;
    }
  }

  setPaused(v: boolean) {
    this.paused = v;
  }

  setMoveAxis(x: number, y: number) {
    this.moveAxis.x = THREE.MathUtils.clamp(x, -1, 1);
    this.moveAxis.y = THREE.MathUtils.clamp(y, -1, 1);
  }

  tap(code: string) {
    this.keys.add(code);
    window.setTimeout(() => this.keys.delete(code), 90);
  }

  setLookDelta(dx: number, dy: number) {
    this.lookDx += dx;
    this.lookDy += dy;
  }

  private held(code: string) {
    if (this.injectedKeys) return this.injectedKeys.includes(code);
    return this.keys.has(code);
  }

  private wireProbe() {
    if (this.disposed) return;
    const probe: ControlsProbe = {
      getYaw: () => this.core.heading,
      getSpeed: () => this.core.speed,
      setSteer: (v) => {
        this.injectedSteer = v;
      },
      setKeys: (codes) => {
        this.injectedKeys = codes.length ? codes : null;
        if (codes.length) {
          this.playing = true;
          this.paused = false;
          if (this.bolt) this.bolt.root.visible = true;
        }
      },
    };
    this.probe = probe;
    this.hudApi = {
      getHud: () => this.snapshot(),
      resetRun: () => {
        this.applyStage(this.biome);
        this.core.reset(hallMeters(this.grammar()));
        this.playing = true;
        this.paused = false;
        if (this.bolt) this.bolt.root.visible = true;
      },
      debug: () => ({
        sprinting: this.held("ShiftLeft") || this.held("ShiftRight") || this.touchSprint,
        sprintTime: this.core.sprintTime,
        grounded: this.core.grounded,
        pos: [this.core.x, this.core.hop, this.core.z],
        injected: this.injectedKeys,
        playing: this.playing,
        paused: this.paused,
        disposed: this.disposed,
        frames: window.__boltFrames ?? 0,
        dodgeT: this.core.dodgeT,
        yaw: this.core.heading,
        biome: this.biome,
        mode: this.core.mode,
        obstacles: this.core.obstacles.length,
        nearDoorSide: this.core.nearDoorSide,
        meters: true,
        mesh: window.__boltMeshInfo ?? null,
        boltScale: this.bolt
          ? [this.bolt.body.scale.x, this.bolt.body.scale.y, this.bolt.root.position.y]
          : null,
        plate: this.plateRect,
      }),
      enterBiome: (id: BiomeId) => {
        this.playing = true;
        this.paused = false;
        this.enterNow(id);
        if (this.bolt) this.bolt.root.visible = true;
      },
      advance: (seconds: number) => {
        const steps = Math.min(720, Math.floor(Math.max(0, seconds) / FIXED));
        for (let i = 0; i < steps; i++) this.fixed(FIXED);
        this.visuals(FIXED);
        this.pushHud();
      },
    };
    window.__controlsTest = probe;
    window.__boltHybrid = this.hudApi;
  }

  private snapshot(): HudSnapshot {
    const c = this.core;
    return {
      biome: this.biome,
      biomeName: BIOMES[this.biome].name,
      nextLabel: BIOMES[this.biome].nextLabel,
      momentum: c.momentum,
      worldInfluence: c.worldInfluence,
      cleanliness: c.cleanliness,
      speed: c.speed,
      doorArmed: c.doorArmed,
      nearDoor: c.nearDoor,
      nearDoorSide: c.nearDoorSide,
      paused: this.paused,
      playing: this.playing,
      howl: c.howlT,
      chain: c.chain,
      fade: this.fadeT,
      dodging: c.dodgeT > 0,
    };
  }

  private pushHud() {
    this.onHud(this.snapshot());
  }

  private onResize = () => this.resize();

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    const viewA = w / Math.max(1, h);
    const imgA = this.grammar().aspect;
    const pw = viewA > imgA ? (imgA / viewA) * 2 : 2;
    const ph = viewA > imgA ? 2 : (viewA / imgA) * 2;
    this.plateRect = { x: -pw / 2, y: -ph / 2, w: pw, h: ph };
    this.plateMat.uniforms.uRes!.value.set(w, h);
  }

  private frame = () => {
    if (this.disposed) return;
    window.__boltFrames = (window.__boltFrames ?? 0) + 1;
    try {
      this.timer.update();
      const dt = Math.min(this.timer.getDelta(), 0.1);
      if (!this.paused) {
        this.acc += dt;
        let steps = 0;
        while (this.acc >= FIXED && steps < 8) {
          this.fixed(FIXED);
          this.acc -= FIXED;
          steps++;
        }
      }
      this.visuals(dt);
      this.renderer.render(this.scene, this.camera);
      this.hudClock += dt;
      if (this.hudClock > 0.05) {
        this.hudClock = 0;
        this.pushHud();
      }
    } catch (err) {
      console.error("[bolt] frame", err);
      throw err;
    }
  };

  private collectAxes() {
    let x = this.moveAxis.x + this.stickAxis.x + this.swipeAxis.x;
    let y = this.moveAxis.y + this.stickAxis.y;
    if (this.held("KeyA") || this.held("ArrowLeft")) x -= 1;
    if (this.held("KeyD") || this.held("ArrowRight")) x += 1;
    if (this.held("KeyW") || this.held("ArrowUp")) y += 1;
    if (this.held("KeyS") || this.held("ArrowDown")) y -= 1;
    if (this.injectedSteer !== null) x -= this.injectedSteer;
    const m = Math.hypot(x, y);
    if (m > 1) {
      x /= m;
      y /= m;
    }
    return { x, y };
  }

  private edges() {
    const held = new Set<string>();
    for (const c of ["Space", "KeyE", "KeyH", "KeyP", "KeyR", "KeyQ", "KeyC", "KeyL", "ControlLeft", "ControlRight", "KeyA", "KeyD", "ArrowLeft", "ArrowRight"]) {
      if (this.held(c)) held.add(c);
    }
    this.just.clear();
    for (const c of held) {
      if (!this.prevHeld.has(c)) this.just.add(c);
    }
    this.prevHeld = held;
  }

  private fixed(dt: number) {
    this.edges();
    this.simT += dt;
    if (this.just.has("KeyP") && this.playing) this.paused = !this.paused;
    if (this.just.has("KeyL")) this.showWires = !this.showWires;
    if (this.paused || !this.playing) return;

    if (this.just.has("KeyQ") || this.just.has("KeyC") || this.just.has("ControlLeft") || this.just.has("ControlRight")) {
      this.tryDodge();
    }
    for (const code of ["KeyA", "KeyD", "ArrowLeft", "ArrowRight"] as const) {
      if (this.just.has(code)) {
        if (this.lastStrafe.code === code && this.simT - this.lastStrafe.t < 0.24) this.tryDodge();
        this.lastStrafe = { code, t: this.simT };
      }
    }

    const sprinting = this.held("ShiftLeft") || this.held("ShiftRight") || this.touchSprint;
    const axes = this.collectAxes();
    this.core.step(dt, {
      wishX: axes.x,
      wishZ: axes.y,
      sprint: sprinting,
      jump: this.just.has("Space"),
      dodge: false,
      howl: this.just.has("KeyH"),
    });
    if (this.just.has("KeyE")) this.tryEnter(this.core.nearDoorSide);
    if (this.fadeT > 0) this.fadeT = Math.max(0, this.fadeT - dt * 1.7);
  }

  private tryDodge(ax?: number, ay?: number) {
    if (!this.playing || this.paused) return;
    const axes = this.collectAxes();
    this.core.tryDodge(ax ?? axes.x, ay ?? axes.y);
  }

  tryEnter(side: "L" | "R" | null = this.core.nearDoorSide) {
    if (!this.core.doorArmed || this.core.momentum < DOOR_ARM_MOMENTUM) return;
    const use = side ?? this.core.nearDoorSide;
    if (!use) return;
    const next = use === "R" ? nextBiome(this.biome) : prevBiome(this.biome);
    const pack = this.packs.get(next);
    const ready = !BIOMES[next].live || this.breaths.has(next);
    if (!pack || !ready) {
      void Promise.all([this.ensurePack(next), this.ensureBreath(next)]).then(() => this.enterNow(next));
      return;
    }
    this.enterNow(next);
  }

  private applyStage(id: BiomeId) {
    const def = BIOMES[id];
    this.core.setStage(def.mode, hallMeters(def.grammar), def.obstacles);
  }

  private enterNow(id: BiomeId) {
    this.applyBiome(id);
    this.applyStage(id);
    this.core.enterKeep();
  }

  private project() {
    const g = this.grammar();
    const h = this.core.hall;
    const z = THREE.MathUtils.clamp(this.core.zNorm, 0, 1);
    const xN = this.core.x / Math.max(0.001, h.widthNear * 0.5);
    const u = 0.5 + xN * g.xSpanNear * THREE.MathUtils.lerp(0.34, 0.4, z);
    const v = THREE.MathUtils.lerp(g.spawnFeetV, g.farFeetV, z) + this.core.hop * 0.08;
    const scale = THREE.MathUtils.lerp(g.spawnScale, g.farScale, z);
    return { u, v, scale };
  }

  private layoutBolt() {
    const bolt = this.bolt;
    if (!bolt) return;
    const { u, v, scale } = this.project();
    const x = this.plateRect.x + u * this.plateRect.w;
    const minY = this.plateRect.y + this.plateRect.h * 0.03;
    const y = Math.max(minY, this.plateRect.y + v * this.plateRect.h);
    bolt.root.position.set(x, y, 0.12);
    const squash = Number(bolt.body.userData.squash ?? 1);
    const hop = Number(bolt.body.userData.bob ?? 0);
    const withers = scale * this.plateRect.h;
    const s = withers / PAWN_WITHERS_M;
    const sx = s / Math.max(0.2, Math.sqrt(squash));
    bolt.body.position.set(0, hop * s, 0);
    bolt.body.scale.set(sx, s * squash, sx);
    const sh = withers * 1.35;
    bolt.shadow.position.set(0, 0.001, 0);
    bolt.shadow.scale.set(sh * 1.15, Math.max(0.02, sh * 0.42), 1);
    const inf = this.core.worldInfluence;
    const pulse = 0.94 + Math.sin(this.timer.getElapsed() * 2.4) * 0.06;
    const aura = withers * (0.95 + inf * 0.35) * pulse;
    this.auraMesh.position.set(x, y + withers * 0.28, 0.11);
    this.auraMesh.scale.set(aura, aura * 0.62, 1);
    this.auraMat.opacity = this.playing ? 0.16 + inf * 0.22 + this.core.howlT * 0.3 : 0;
    this.auraMesh.visible = this.playing;
    this.auraLight.position.set(x, y + withers * 0.4, 0.4);
    this.auraLight.intensity = this.playing ? 0.22 + inf * 0.55 : 0;
    window.__boltMeshInfo = {
      ...(window.__boltMeshInfo ?? {}),
      withersM: PAWN_WITHERS_M,
      withersPx: +withers.toFixed(3),
    };
    bolt.root.visible = this.playing;
  }

  private layoutStickGhost() {
    const on = this.playing && !this.paused && this.stickPtr !== null;
    this.stickGhost.visible = on;
    this.stickNub.visible = on;
    if (!on) return;
    const cam = this.camera;
    const r = this.canvas.getBoundingClientRect();
    const ox = (this.stickOrigin.x - r.left) / Math.max(1, r.width);
    const oy = 1 - (this.stickOrigin.y - r.top) / Math.max(1, r.height);
    const x = THREE.MathUtils.lerp(cam.left, cam.right, ox);
    const y = THREE.MathUtils.lerp(cam.bottom, cam.top, oy);
    const span = Math.min(cam.right - cam.left, cam.top - cam.bottom);
    this.stickGhost.position.set(x, y, 0.6);
    this.stickGhost.scale.setScalar(span * 0.55);
    this.stickNub.position.set(x + this.stickAxis.x * span * 0.07, y + this.stickAxis.y * span * 0.07, 0.61);
    this.stickNub.scale.setScalar(span * 0.55);
    this.stickMat.opacity = 0.09;
  }

  private layoutWires() {
    const hall = this.core.hall;
    const g = this.grammar();
    const on = this.playing && this.showWires && this.core.mode === "biome";
    for (let i = 0; i < this.wireMeshes.length; i++) {
      const mesh = this.wireMeshes[i]!;
      const o = this.core.obstacles[i];
      if (!on || !o) {
        mesh.visible = false;
        continue;
      }
      const z = THREE.MathUtils.clamp(o.z / Math.max(0.001, hall.depth), 0, 1);
      const xN = o.x / Math.max(0.001, hall.widthNear * 0.5);
      const u = 0.5 + xN * g.xSpanNear * THREE.MathUtils.lerp(0.34, 0.4, z);
      const v = THREE.MathUtils.lerp(g.spawnFeetV, g.farFeetV, z);
      const persp = THREE.MathUtils.lerp(1, 0.55, z);
      const m2p = this.plateRect.h * 0.12;
      const x = this.plateRect.x + u * this.plateRect.w;
      const y = this.plateRect.y + v * this.plateRect.h;
      mesh.position.set(x, y + o.r * m2p * persp * 0.35, 0.08);
      mesh.scale.set(o.r * m2p * persp * 1.6, o.r * m2p * persp * 0.9, 1);
      mesh.visible = true;
    }
  }

  private visuals(dt: number) {
    const t = this.timer.getElapsed();
    const c = this.core;
    const spd = c.speed;
    const sprinting = this.held("ShiftLeft") || this.held("ShiftRight") || this.touchSprint;
    if (this.bolt) {
      poseBoltMesh(
        this.bolt,
        dt,
        this.paused ? 0 : spd,
        sprinting && this.playing && !this.paused,
        c.grounded,
        c.hop,
        c.heading,
        c.dodgeT,
        Math.sign(c.dodgeX) || 1,
        c.howlT,
        this.phase,
      );
      this.layoutBolt();
    }

    const px = THREE.MathUtils.clamp(c.x / Math.max(1, c.hall.widthNear) * 0.22, -0.09, 0.09);
    const py = THREE.MathUtils.clamp((c.zNorm - 0.18) * 0.05, -0.035, 0.04);
    const kBoom = 1 - Math.exp(-dt / 0.22);
    this.boom.x += (px - this.boom.x) * kBoom;
    this.boom.y += (py - this.boom.y) * kBoom;
    this.camera.position.x = this.boom.x;
    this.camera.position.y = this.boom.y * 0.45;
    this.camera.position.z = 1;
    this.camera.rotation.set(0, 0, 0);
    this.plateMesh.position.set(-this.boom.x * 0.35, -this.boom.y * 0.2, 0);

    const kPar = 1 - Math.exp(-6 * dt);
    this.parallax.x += (this.boom.x * 0.4 - this.parallax.x) * kPar;
    this.parallax.y += (this.boom.y * 0.3 - this.parallax.y) * kPar;
    this.layoutStickGhost();
    this.layoutWires();

    const u = this.plateMat.uniforms;
    u.uX!.value = c.x / Math.max(0.001, c.hall.widthNear * 0.5);
    u.uZ!.value = c.zNorm;
    u.uTime!.value = t;
    u.uInfluence!.value = c.worldInfluence;
    u.uDoorArmed!.value = c.doorArmed ? 1 : 0;
    u.uNearL!.value = c.nearDoorSide === "L" ? 1 : 0;
    u.uNearR!.value = c.nearDoorSide === "R" ? 1 : 0;
    (u.uParallax!.value as THREE.Vector2).copy(this.parallax);

    const inf = c.worldInfluence;
    for (const r of this.relics) {
      const s = r.userData.spot as { u: number; v: number; w: number; h: number; crop: THREE.Vector4 };
      const grow = 1 + inf * 0.35;
      r.position.set(
        this.plateRect.x + s.u * this.plateRect.w,
        this.plateRect.y + s.v * this.plateRect.h,
        0.04,
      );
      r.scale.set(s.w * this.plateRect.w * grow, s.h * this.plateRect.h * grow, 1);
      r.rotation.z = Math.sin(t * 0.7 + s.u * 8) * 0.06;
      const rm = r.material as THREE.ShaderMaterial;
      rm.uniforms.uTime!.value = t;
      rm.uniforms.uInfluence!.value = inf;
      rm.uniforms.uCrop!.value.copy(s.crop);
    }

    this.pMat.opacity = 0.1 + inf * 0.45;
    this.pMat.size = 2.4 + inf * 3.2;
    const pos = this.pGeo.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < MOTE_COUNT; i++) {
      const ou = this.pOrigins[i * 3]!;
      const ov = this.pOrigins[i * 3 + 1]!;
      const seed = this.pOrigins[i * 3 + 2]!;
      const pu = ou + Math.sin(t * 0.35 + seed * 12) * (0.01 + inf * 0.02);
      const pv = (ov + t * (0.015 + inf * 0.04) + seed) % 0.85;
      pos.setXYZ(i, this.plateRect.x + pu * this.plateRect.w, this.plateRect.y + pv * this.plateRect.h, 0.05);
    }
    pos.needsUpdate = true;

    if (this.bolt) {
      const k = c.howlT > 0 ? 1 - c.howlT : 0;
      this.howlMesh.position.copy(this.bolt.root.position);
      this.howlMesh.position.z = 0.13;
      this.howlMesh.scale.setScalar(0.35 + (c.howlT > 0 ? k * 10 : c.worldInfluence * 1.4));
      this.howlMat.opacity = c.howlT > 0 ? c.howlT * 0.7 : 0.08 + c.worldInfluence * 0.18;
      this.howlMesh.visible = this.playing;
    } else {
      this.howlMesh.visible = false;
    }

    this.fadeMat.opacity = this.fadeT;
  }

  dispose() {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.timer.dispose();
    this.unlock();
    window.removeEventListener("resize", this.onResize);
    this.ro?.disconnect();
    this.unkeys();
    this.unptr();
    for (const b of this.breaths.values()) {
      b.el.pause();
      b.el.removeAttribute("src");
      b.el.load();
      b.el.remove();
      b.tex.dispose();
    }
    this.breaths.clear();
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) m.dispose();
      }
    });
    for (const pack of this.packs.values()) {
      for (const tex of Object.values(pack)) tex.dispose();
    }
    this.renderer.dispose();
    if (window.__controlsTest === this.probe) delete window.__controlsTest;
    if (window.__boltHybrid === this.hudApi) delete window.__boltHybrid;
  }
}
