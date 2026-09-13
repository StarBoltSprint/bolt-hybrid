import { useEffect, useRef } from "react";
import { bootDom, DISSOLVE_MS } from "./dom-swap";
import {
  breathFor,
  containPlate,
  edgeFor,
  films,
  sprintCues,
  sprintFilms,
  stillFor,
  stills,
  type Pose,
  type Tap,
} from "./pack";

type Lane = "L" | "C" | "R";

const GAIT_N = 16;
const GAIT_W = 208;
const GAIT_H = 595;
const GAIT_URLS = Array.from(
  { length: GAIT_N },
  (_, i) => `/hybrid/run/${String(i + 1).padStart(2, "0")}.png?v=5`,
);

function plateBox(stage: HTMLElement) {
  const r = stage.getBoundingClientRect();
  const w = Math.min(r.width, (r.height * 9) / 16);
  const h = (w * 16) / 9;
  return {
    left: (r.width - w) / 2,
    top: (r.height - h) / 2,
    w,
    h,
  };
}

function plateHit(
  stage: HTMLElement,
  clientX: number,
  clientY: number,
): { tap: Tap | "mid"; nx: number; ny: number } | null {
  const r = stage.getBoundingClientRect();
  const box = plateBox(stage);
  const nx = (clientX - r.left - box.left) / box.w;
  const ny = (clientY - r.top - box.top) / box.h;
  if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return null;
  if (nx < 0.4) return { tap: "A", nx, ny };
  if (nx > 0.6) return { tap: "B", nx, ny };
  return { tap: "mid", nx, ny };
}

function visVideo(a: HTMLVideoElement | null, b: HTMLVideoElement | null) {
  const op = (v: HTMLVideoElement | null) =>
    v ? Number.parseFloat(v.style.opacity || "0") : 0;
  return op(a) >= op(b) ? a : b;
}

function laneOf(v: number): Lane {
  if (v <= -1) return "L";
  if (v >= 1) return "R";
  return "C";
}

export function Hall() {
  const stageRef = useRef<HTMLDivElement>(null);
  const stillRef = useRef<HTMLImageElement>(null);
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  const cueLRef = useRef<HTMLDivElement>(null);
  const cueRRef = useRef<HTMLDivElement>(null);
  const gradeRef = useRef<HTMLDivElement>(null);
  const boltRef = useRef<HTMLCanvasElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const tintRef = useRef({ r: 196, g: 132, b: 84 });
  const sampleRef = useRef<HTMLCanvasElement | null>(null);
  const prevPixRef = useRef<Uint8ClampedArray | null>(null);
  const motionRef = useRef(0);
  const smearRef = useRef(0);
  const gaitImgsRef = useRef<HTMLImageElement[]>([]);
  const gaitIRef = useRef(0);
  const gaitAccRef = useRef(0);
  const gaitTsRef = useRef(0);
  const poseRef = useRef<Pose>("spawn");
  const walkingRef = useRef(false);
  const sprintingRef = useRef(false);
  const sprintIRef = useRef(0);
  const hitRef = useRef(false);
  const laneRef = useRef(0);
  const jumpUntilRef = useRef(0);
  const strafeUntilRef = useRef(0);
  const plateSpeedRef = useRef(0);
  const lastFilmTRef = useRef(-1);
  const lastWallRef = useRef(0);
  const keysRef = useRef(new Set<string>());
  const ptrRef = useRef<{ x: number; y: number } | null>(null);
  const engineRef = useRef<ReturnType<typeof bootDom> | null>(null);
  const rafRef = useRef(0);
  const playSprintRef = useRef<(i: number) => void>(() => {});

  useEffect(() => {
    const engine = bootDom({
      still: stillRef.current,
      videoA: videoARef.current,
      videoB: videoBRef.current,
    });
    engineRef.current = engine;
    sampleRef.current = document.createElement("canvas");
    sampleRef.current.width = 12;
    sampleRef.current.height = 12;

    gaitImgsRef.current = GAIT_URLS.map((src) => {
      const img = new Image();
      img.decoding = "async";
      img.src = src;
      return img;
    });
    gaitImgsRef.current[0]?.addEventListener(
      "load",
      () => drawGait(0),
      { once: true },
    );

    const onDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.code);
      if (!sprintingRef.current) return;
      if (e.code === "KeyA" || e.code === "ArrowLeft") setLane(-1);
      if (e.code === "KeyD" || e.code === "ArrowRight") setLane(1);
      if (e.code === "Space" || e.code === "KeyW" || e.code === "ArrowUp") hop();
    };
    const onUp = (e: KeyboardEvent) => keysRef.current.delete(e.code);
    const clear = () => keysRef.current.clear();
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", clear);

    window.__controlsTest = {
      getYaw: () => -laneRef.current,
      getSpeed: () => (sprintingRef.current ? plateSpeedRef.current : 0),
      setKeys: (codes: string[]) => {
        keysRef.current = new Set(codes);
        if (codes.includes("KeyA") || codes.includes("ArrowLeft")) setLane(-1);
        if (codes.includes("KeyD") || codes.includes("ArrowRight")) setLane(1);
        if (codes.includes("Space") || codes.includes("KeyW")) hop();
      },
    };

    playSprintRef.current(0);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", clear);
      delete window.__controlsTest;
    };
  }, []);

  function samplePlate(v: HTMLVideoElement | null) {
    const s = sampleRef.current;
    if (!s || !v || v.readyState < 2 || v.videoWidth < 2) return;
    const ctx = s.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    const vw = v.videoWidth;
    const vh = v.videoHeight;
    try {
      ctx.drawImage(v, vw * 0.22, vh * 0.52, vw * 0.56, vh * 0.4, 0, 0, 12, 12);
      const img = ctx.getImageData(0, 0, 12, 12);
      const d = img.data;
      let r = 0,
        g = 0,
        b = 0,
        mad = 0;
      const prev = prevPixRef.current;
      for (let i = 0; i < d.length; i += 4) {
        r += d[i];
        g += d[i + 1];
        b += d[i + 2];
        if (prev) {
          mad +=
            Math.abs(d[i] - prev[i]) +
            Math.abs(d[i + 1] - prev[i + 1]) +
            Math.abs(d[i + 2] - prev[i + 2]);
        }
      }
      prevPixRef.current = new Uint8ClampedArray(d);
      const n = d.length / 4;
      const t = tintRef.current;
      t.r += (r / n - t.r) * 0.45;
      t.g += (g / n - t.g) * 0.45;
      t.b += (b / n - t.b) * 0.45;
      if (prev) motionRef.current = Math.min(1, mad / n / 90);
    } catch {
      const pal = [
        { r: 205, g: 138, b: 78 },
        { r: 188, g: 122, b: 72 },
        { r: 88, g: 108, b: 138 },
        { r: 46, g: 64, b: 102 },
      ][sprintIRef.current] ?? { r: 120, g: 100, b: 90 };
      const t = tintRef.current;
      t.r += (pal.r - t.r) * 0.35;
      t.g += (pal.g - t.g) * 0.35;
      t.b += (pal.b - t.b) * 0.35;
      motionRef.current = 0;
    }
  }

  function drawGait(i: number) {
    const c = boltRef.current;
    const img = gaitImgsRef.current[i];
    if (!c || !img || !img.complete || img.naturalWidth < 2) return false;
    const ctx = c.getContext("2d", { alpha: true });
    if (!ctx) return false;
    ctx.clearRect(0, 0, GAIT_W, GAIT_H);
    const speed = plateSpeedRef.current;
    const smear = speed > 0.85 ? Math.min(10, speed * 6) : 0;
    smearRef.current = smear;
    if (smear > 0.5) {
      ctx.globalAlpha = 0.32;
      ctx.drawImage(img, 0, smear, GAIT_W, GAIT_H);
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(img, 0, 0, GAIT_W, GAIT_H);
    const t = tintRef.current;
    const lum = (t.r + t.g + t.b) / 765;
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = `rgba(${t.r | 0},${t.g | 0},${t.b | 0},0.52)`;
    ctx.fillRect(0, 0, GAIT_W, GAIT_H);
    if (lum < 0.42) {
      ctx.fillStyle = `rgba(8,18,40,${0.38 - lum * 0.4})`;
      ctx.fillRect(0, 0, GAIT_W, GAIT_H);
    }
    ctx.globalCompositeOperation = "source-over";
    return true;
  }

  function paintBolt() {
    const el = boltRef.current;
    const sh = shadowRef.current;
    const stage = stageRef.current;
    if (!el || !stage) return;
    const live = sprintingRef.current;
    const box = plateBox(stage);
    const lane = laneRef.current;
    const nx = lane < 0 ? 0.28 : lane > 0 ? 0.72 : 0.5;
    const now = performance.now();
    let hop = 0;
    if (now < jumpUntilRef.current) {
      const p = 1 - (jumpUntilRef.current - now) / 460;
      hop = p < 0.38 ? -14 * (p / 0.38) : -14 * (1 - (p - 0.38) / 0.62);
    }
    const turning = Math.abs(lane) > 0;
    const yaw = lane * -32;
    const bank = lane * 28;
    const skew = lane * 10;
    const squashX = turning ? 0.88 : 1;
    const squashY = turning ? 1.06 : 1;
    const sway = turning ? 0 : Math.sin(now / 430) * 2.6;
    const w = Math.min(164, box.w * 0.21);
    const far = Math.min(1, Math.abs(hop) / 14);
    const t = tintRef.current;
    const lum = (t.r + t.g + t.b) / 765;
    const feetX = box.left + box.w * nx;
    const feetY = box.top + box.h * 0.89;
    el.style.opacity = live ? "1" : "0";
    el.style.width = `${w}px`;
    el.style.left = `${feetX}px`;
    el.style.top = `${feetY}px`;
    el.style.filter = `brightness(${0.52 + lum * 0.58})`;
    el.style.transform =
      `translate3d(-50%, calc(-100% + ${hop}%), 0)` +
      ` rotateY(${yaw}deg) rotateZ(${bank + sway}deg) skewX(${skew}deg)` +
      ` scale(${squashX}, ${squashY})`;
    if (sh) {
      sh.style.mixBlendMode = "multiply";
      sh.style.opacity = live ? "0.3" : "0";
      sh.style.width = `${Math.max(36, w * 0.52)}px`;
      sh.style.height = `${Math.max(8, w * 0.1)}px`;
      sh.style.left = `${feetX}px`;
      sh.style.top = `${feetY}px`;
      sh.style.transform = "translate(-50%, -40%)";
    }
  }

  function tickGait() {
    const now = performance.now();
    if (!sprintingRef.current) {
      plateSpeedRef.current = 0;
      lastWallRef.current = 0;
      lastFilmTRef.current = -1;
      return;
    }
    const a = videoARef.current;
    const b = videoBRef.current;
    const playingOf = (v: HTMLVideoElement | null) =>
      !!v && !v.paused && !v.ended && Number.parseFloat(v.style.opacity || "0") > 0.2;
    const v = playingOf(a) ? a : playingOf(b) ? b : visVideo(a, b);
    const filmT = v?.currentTime ?? 0;
    const wallDt = lastWallRef.current ? (now - lastWallRef.current) / 1000 : 0;
    const filmDt = lastFilmTRef.current >= 0 ? filmT - lastFilmTRef.current : 0;
    lastWallRef.current = now;
    lastFilmTRef.current = filmT;

    let plateSpeed = 0;
    if (v && !v.paused && !v.ended && wallDt > 0.001 && filmDt >= 0) {
      plateSpeed = filmDt / wallDt;
    }
    if (plateSpeed < 0.08) plateSpeed = 0;
    plateSpeedRef.current = plateSpeed;
    samplePlate(v);
    const scroll = plateSpeed * motionRef.current;
    if (scroll > 0.08) {
      gaitAccRef.current += wallDt * (10 * scroll);
      while (gaitAccRef.current >= 1) {
        gaitIRef.current = (gaitIRef.current + 1) % GAIT_N;
        gaitAccRef.current -= 1;
      }
    }
    drawGait(gaitIRef.current);
    paintBolt();
  }

  function setLane(dir: -1 | 1) {
    laneRef.current = Math.max(-1, Math.min(1, laneRef.current + dir));
    strafeUntilRef.current = performance.now() + 240;
    paintBolt();
    scoreIfLane();
  }

  function hop() {
    if (!sprintingRef.current) return;
    jumpUntilRef.current = performance.now() + 460;
    paintBolt();
    window.setTimeout(paintBolt, 480);
  }

  function hideCues() {
    cueLRef.current?.classList.remove("on");
    cueRRef.current?.classList.remove("on");
  }

  function popGrade(kind: "good" | "late" | "miss", at?: { x: number; y: number }) {
    const el = gradeRef.current;
    const stage = stageRef.current;
    if (!el || !stage) return;
    const r = stage.getBoundingClientRect();
    if (at) {
      el.style.left = `${at.x - r.left}px`;
      el.style.top = `${at.y - r.top}px`;
    } else {
      const cue = sprintCues[sprintIRef.current]?.[0];
      el.style.left = cue?.side === "R" ? "72%" : cue?.side === "L" ? "28%" : "50%";
      el.style.top = "52%";
    }
    el.className = "grade-pop show " + kind;
    el.textContent = kind === "good" ? "GOOD" : kind === "late" ? "LATE" : "MISS";
    window.setTimeout(() => el.classList.remove("show"), 860);
  }

  function scoreIfLane() {
    const engine = engineRef.current;
    if (!sprintingRef.current || !engine || hitRef.current) return;
    const cue = sprintCues[sprintIRef.current]?.[0];
    if (!cue) return;
    const t = engine.now();
    if (t < cue.on - 0.05 || t > cue.off + 0.2) return;
    const here = laneOf(laneRef.current);
    if (here === cue.side) {
      hitRef.current = true;
      hideCues();
    }
  }

  function tickCue() {
    const engine = engineRef.current;
    if (!sprintingRef.current || !engine) {
      hideCues();
      return;
    }
    const cue = sprintCues[sprintIRef.current]?.[0];
    const t = engine.now();
    const live = !!cue && t >= cue.on && t <= cue.off && !hitRef.current;
    cueLRef.current?.classList.toggle("on", live && cue.side === "L");
    cueRRef.current?.classList.toggle("on", live && cue.side === "R");
    if (live) scoreIfLane();
    tickGait();
    rafRef.current = requestAnimationFrame(tickCue);
  }

  function startBreath(pose: Pose) {
    const engine = engineRef.current;
    if (!engine) return;
    walkingRef.current = false;
    sprintingRef.current = false;
    hideCues();
    paintBolt();
    poseRef.current = pose;
    void engine.joinEnded({
      src: films[breathFor(pose)],
      still: stillFor(pose),
      loop: true,
    });
  }

  function playSprint(i: number) {
    const engine = engineRef.current;
    if (!engine) return;
    if (i >= sprintFilms.length) {
      playSprint(0);
      return;
    }
    walkingRef.current = true;
    sprintingRef.current = true;
    sprintIRef.current = i;
    hitRef.current = false;
    if (i === 0) {
      laneRef.current = 0;
      gaitIRef.current = 0;
      gaitAccRef.current = 0;
    }
    lastFilmTRef.current = -1;
    lastWallRef.current = 0;
    paintBolt();
    drawGait(gaitIRef.current);
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tickCue);
    const next = sprintFilms[i + 1];
    if (next) engine.preload(next);
    void engine.kick({
      src: sprintFilms[i],
      loop: false,
      fadeMs: i === 0 ? 0 : DISSOLVE_MS,
      onEnded: () => {
        if (!sprintingRef.current) return;
        playSprint(i + 1);
      },
    });
  }
  playSprintRef.current = playSprint;

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const stage = stageRef.current;
    const engine = engineRef.current;
    if (!stage || !engine) return;

    if (sprintingRef.current) {
      const hit = plateHit(stage, e.clientX, e.clientY);
      if (!hit) return;
      ptrRef.current = { x: e.clientX, y: e.clientY };
      if (hit.ny < 0.32) hop();
      else if (hit.tap === "A") setLane(-1);
      else if (hit.tap === "B") setLane(1);
      return;
    }
    if (walkingRef.current) return;

    const tap = containPlate(stage, e.clientX, e.clientY);
    if (!tap) return;

    const pose = poseRef.current;
    const edge = edgeFor(pose, tap);
    if ("stay" in edge) return;
    if ("sprint" in edge) {
      playSprint(0);
      return;
    }

    walkingRef.current = true;
    const arrive = edge.arrive;
    void engine.kick({
      src: films[edge.clip],
      still: stillFor(arrive),
      loop: false,
      fadeMs: DISSOLVE_MS,
      onEnded: () => startBreath(arrive),
    });
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!sprintingRef.current || !ptrRef.current) {
      ptrRef.current = null;
      return;
    }
    const dx = e.clientX - ptrRef.current.x;
    const dy = e.clientY - ptrRef.current.y;
    ptrRef.current = null;
    if (Math.abs(dx) < 28 && Math.abs(dy) < 28) return;
    if (Math.abs(dx) > Math.abs(dy)) setLane(dx < 0 ? -1 : 1);
    else if (dy < 0) hop();
  }

  return (
    <div
      ref={stageRef}
      className="stage"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        ptrRef.current = null;
      }}
      role="application"
      aria-label="Mars biome"
      style={{ touchAction: "none" }}
    >
      <img
        ref={stillRef}
        className="plate"
        src={stills.spawn}
        alt=""
        draggable={false}
        style={{ opacity: 0 }}
      />
      <video
        ref={videoARef}
        className="plate"
        muted
        playsInline
        preload="auto"
        style={{ opacity: 0 }}
      />
      <video
        ref={videoBRef}
        className="plate"
        muted
        playsInline
        preload="auto"
        style={{ opacity: 0 }}
      />
      {sprintFilms.map((src) => (
        <video key={src} className="sprint-preload" src={src} muted playsInline preload="auto" />
      ))}
      <div
        ref={shadowRef}
        className="hybrid-shadow"
        data-blend="multiply"
      />
      <div className="hybrid-rig">
        <canvas
          ref={boltRef}
          className="hybrid-bolt"
          width={GAIT_W}
          height={GAIT_H}
        />
      </div>
      <div ref={cueLRef} className="cue-edge L" />
      <div ref={cueRRef} className="cue-edge R" />
      <div ref={gradeRef} className="grade-pop" />
    </div>
  );
}

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      setKeys?: (codes: string[]) => void;
    };
  }
}
