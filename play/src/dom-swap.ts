export const DISSOLVE_MS = 280;

function setOp(el: HTMLElement | null, op: number, ms = 0) {
  if (!el) return;
  el.style.transition = ms ? `opacity ${ms}ms linear` : "none";
  el.style.opacity = String(op);
}

function armEnded(el: HTMLVideoElement | null, gen: number, getGen: () => number, fn?: () => void) {
  if (!el) return;
  el.onended = () => {
    if (gen !== getGen()) return;
    fn?.();
  };
}

export function bootDom({
  still,
  videoA,
  videoB,
}: {
  still: HTMLImageElement | null;
  videoA: HTMLVideoElement | null;
  videoB: HTMLVideoElement | null;
}) {
  let vis = videoA;
  let hid = videoB;
  let gen = 0;
  const getGen = () => gen;

  function failSafe() {
    if (still) {
      still.style.transition = "none";
      still.style.opacity = "1";
    }
    for (const v of [videoA, videoB]) {
      if (!v) continue;
      setOp(v, 0, 0);
      try {
        v.pause();
      } catch {
        /* */
      }
    }
    return { ok: false as const, fail: true as const, gen };
  }

  async function paintStill(src?: string) {
    if (!still || !src) return;
    const abs = still.src;
    if (abs !== src && !abs.endsWith(src.replace(/^\//, "")) && !abs.includes(src)) {
      still.src = src;
    }
    still.style.transition = "none";
    still.style.opacity = "1";
    if (still.decode) {
      try {
        await still.decode();
      } catch {
        /* already complete */
      }
    }
  }

  async function kick({
    src,
    still: stillSrc,
    loop = false,
    fadeMs = 0,
    onEnded,
  }: {
    src: string;
    still?: string;
    loop?: boolean;
    fadeMs?: number;
    onEnded?: () => void;
  }) {
    const myGen = ++gen;
    if (stillSrc) await paintStill(stillSrc);

    if (!hid) return failSafe();

    hid.muted = true;
    hid.defaultMuted = true;
    hid.playsInline = true;
    hid.setAttribute("playsinline", "true");
    hid.setAttribute("webkit-playsinline", "true");
    hid.loop = !!loop;
    hid.playbackRate = 1;
    hid.src = src;
    try {
      hid.currentTime = 0;
    } catch {
      /* */
    }

    try {
      await hid.play();
    } catch {
      if (myGen !== gen) return { ok: false as const, stale: true as const, gen: myGen };
      return failSafe();
    }
    if (myGen !== gen) return { ok: false as const, stale: true as const, gen: myGen };
    if (hid.paused !== false) return failSafe();

    setOp(hid, 1, fadeMs);
    setOp(vis, 0, fadeMs);
    try {
      vis?.pause();
    } catch {
      /* */
    }
    const out = vis;
    vis = hid;
    hid = out;
    armEnded(vis, myGen, getGen, onEnded);
    return { ok: true as const, gen: myGen };
  }

  async function joinEnded({
    src,
    still: stillSrc,
    loop = false,
    onEnded,
  }: {
    src: string;
    still?: string;
    loop?: boolean;
    onEnded?: () => void;
  }) {
    if (!src) return failSafe();
    await paintStill(stillSrc);
    setOp(vis, 0, 0);
    try {
      vis?.pause();
    } catch {
      /* */
    }
    return kick({ src, still: stillSrc, loop, fadeMs: 0, onEnded });
  }

  function preload(src: string) {
    if (!hid || !src) return;
    if (hid.getAttribute("data-pre") === src) return;
    hid.setAttribute("data-pre", src);
    hid.muted = true;
    hid.defaultMuted = true;
    hid.playsInline = true;
    hid.preload = "auto";
    hid.src = src;
    try {
      hid.load();
    } catch {
      /* */
    }
  }

  return { kick, joinEnded, failSafe, paintStill, preload, gen: getGen, now: () => vis?.currentTime ?? 0 };
}
