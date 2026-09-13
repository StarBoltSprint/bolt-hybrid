import { useCallback, useEffect, useRef, useState } from "react";
import { BoltHybridEngine, type HudSnapshot } from "./engine";

const IDLE: HudSnapshot = {
  biome: "ice",
  biomeName: "Ice Hall",
  nextLabel: "Forest",
  momentum: 0,
  worldInfluence: 0,
  cleanliness: 1,
  speed: 0,
  doorArmed: false,
  nearDoor: false,
  nearDoorSide: null,
  paused: false,
  playing: false,
  howl: 0,
  chain: 0,
  fade: 0,
  dodging: false,
};

export default function GameApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<BoltHybridEngine | null>(null);
  const [hud, setHud] = useState<HudSnapshot>(IDLE);
  const [ready, setReady] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new BoltHybridEngine(canvas, setHud);
    engineRef.current = engine;
    engine
      .load()
      .then(() => setReady(true))
      .catch((err: unknown) => {
        setLoadErr(err instanceof Error ? err.message : "Hall failed to load");
        setReady(true);
      });
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const start = useCallback(() => {
    const e = engineRef.current;
    if (!e) return;
    e.setPaused(false);
    e.setPlaying(true);
  }, []);

  const resume = useCallback(() => {
    engineRef.current?.setPaused(false);
  }, []);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-bg text-fg">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" />

      {!ready && <div className="absolute inset-0 z-20 bg-bg" />}

      {loadErr && (
        <p className="absolute top-4 left-1/2 z-30 -translate-x-1/2 px-3 py-2 text-sm text-fg/80">
          {loadErr}
        </p>
      )}

      {ready && !hud.playing && (
        <button
          type="button"
          onClick={start}
          className="absolute inset-0 z-20 flex items-end justify-center bg-transparent pb-[max(28px,env(safe-area-inset-bottom))] font-display text-2xl tracking-tight text-fg/90"
        >
          Start
        </button>
      )}

      {hud.paused && (
        <button
          type="button"
          onClick={resume}
          className="absolute inset-0 z-30 flex items-center justify-center bg-bg/40 font-display text-3xl text-fg/90"
        >
          Resume
        </button>
      )}
    </div>
  );
}
