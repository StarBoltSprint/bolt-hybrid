import { selftest } from "./biome-25d-speed.ts";
import { parsePlaylist, plateAt } from "./playlist.ts";

const pass = selftest();
for (const msg of pass) console.log("PASS  " + msg);

const pl = parsePlaylist({
  law: "COOK-BIOME-25D",
  sampleDt: 0.1,
  plates: [
    { id: "plate-1", file: "films/asteroid-run-0.mp4", playbackRate: 1, match: "KEEP", rateCurve: [{ t: 0, rate: 1 }, { t: 1, rate: 1 }] },
    { id: "plate-2", file: "films/asteroid-run-1.mp4", playbackRate: 1.2, rateCurve: [{ t: 0, rate: 1 }, { t: 1, rate: 1.3 }] },
  ],
});
if (pl.plates[0].rateCurve.some((p) => p.rate !== 1)) throw new Error("FAIL  KEEP curve forced to 1");
if (Math.abs(plateAt(pl, 1).rateCurve[1].rate - 1.3) > 1e-9) throw new Error("FAIL  plate-2 keeps analyze curve");
console.log("PASS  playlist KEEP + per-plate rateCurve");
console.log("BIOME-25D-SPEED PLAY PASS");
