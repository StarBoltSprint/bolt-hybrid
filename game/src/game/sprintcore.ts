/**
 * SprintCore JS — owns movement. Meters / world. Fixed step 1/60.
 * Three.js does not integrate motion. Blender does not simulate.
 */

export const DT = 1 / 60;

export const WALK_MS = 2.4;
export const SPRINT_MS = 5.2;
export const DODGE_MS = 9.0;
export const DODGE_TIME = 0.22;
export const DODGE_CD = 0.5;
export const JUMP_MS = 4.6;
export const GRAVITY = 22;
export const DOOR_ARM_MOMENTUM = 6;
export const SOFT_CAP = 10;
/** Same pawn as the SprintCore capsule — GSD withers, meters. */
export const PAWN_WITHERS_M = 0.6;
export const PAWN_RADIUS_M = 0.32;

export type ObstacleKind = "arch" | "crystal" | "pillar" | "fork";

/** Invisible 3D volume wrapping an Imagine-painted obstacle. Author in meters. */
export type Obstacle = {
  x: number;
  z: number;
  r: number;
  kind: ObstacleKind;
  beat: number;
};

export type StageMode = "hall" | "biome";

export type HallMeters = {
  widthNear: number;
  widthFar: number;
  depth: number;
  spawnX: number;
  spawnZ: number;
  portalX: number;
  portalZ: number;
  sidePortals: boolean;
};

export type CoreInput = {
  wishX: number;
  wishZ: number;
  sprint: boolean;
  jump: boolean;
  dodge: boolean;
  howl: boolean;
};

export function ribbonX(zNorm: number, side: -1 | 1, hall: HallMeters): number {
  const t = Math.max(0, Math.min(1, zNorm));
  const half = (hall.widthNear / 2) * (0.14 + 0.44 * t) / 0.58;
  return side * half;
}

export class SprintCore {
  x = 0;
  z = 0;
  hop = 0;
  vx = 0;
  vz = 0;
  vy = 0;
  heading = 0;
  grounded = true;
  coyote = 0;
  jumpBuf = 0;
  howlT = 0;
  dodgeT = 0;
  dodgeCd = 0;
  dodgeX = 0;
  dodgeZ = 1;
  momentum = 0;
  worldInfluence = 0;
  cleanliness = 1;
  sprintTime = 0;
  chain = 0;
  doorArmed = false;
  nearDoor = false;
  nearDoorSide: "L" | "R" | null = null;
  simT = 0;
  hall: HallMeters;
  mode: StageMode = "hall";
  obstacles: Obstacle[] = [];
  private hitCool: number[] = [];

  constructor(hall: HallMeters) {
    this.hall = hall;
    this.reset(hall);
  }

  reset(hall?: HallMeters) {
    if (hall) this.hall = hall;
    const h = this.hall;
    this.x = h.spawnX;
    this.z = h.spawnZ;
    this.hop = 0;
    this.vx = 0;
    this.vz = 0;
    this.vy = 0;
    this.heading = 0;
    this.grounded = true;
    this.coyote = 0;
    this.jumpBuf = 0;
    this.howlT = 0;
    this.dodgeT = 0;
    this.dodgeCd = 0;
    this.momentum = 0;
    this.worldInfluence = 0;
    this.sprintTime = 0;
    this.chain = 0;
    this.doorArmed = false;
    this.nearDoor = false;
    this.nearDoorSide = null;
    this.hitCool = this.obstacles.map(() => 0);
  }

  setStage(mode: StageMode, hall: HallMeters, obstacles: Obstacle[]) {
    this.mode = mode;
    this.hall = hall;
    this.obstacles = mode === "biome" ? obstacles.map((o) => ({ ...o })) : [];
    this.hitCool = this.obstacles.map(() => 0);
  }

  get speed(): number {
    return Math.hypot(this.vx, this.vz);
  }

  get zNorm(): number {
    return this.z / Math.max(0.001, this.hall.depth);
  }

  step(dt: number, input: CoreInput) {
    this.simT += dt;
    const h = this.hall;
    const dodging = this.dodgeT > 0;
    const wish = Math.hypot(input.wishX, input.wishZ);

    if (input.dodge && this.mode === "biome") this.tryDodge(input.wishX, input.wishZ);

    const maxSpd = dodging ? DODGE_MS : input.sprint && this.grounded ? SPRINT_MS : WALK_MS;
    const accel = this.grounded ? (input.sprint ? 28 : 16) : 6;
    if (!dodging && wish > 0.05) {
      this.vx += input.wishX * accel * dt;
      this.vz += input.wishZ * accel * dt;
      const strafeOnly = Math.abs(input.wishZ) < 0.22 && Math.abs(input.wishX) > 0.18;
      if (!strafeOnly && Math.abs(input.wishZ) >= 0.18) {
        const targetYaw = Math.atan2(-input.wishX, input.wishZ);
        let dyaw = targetYaw - this.heading;
        dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
        this.heading += dyaw * Math.min(1, dt / 0.17);
      }
    }
    const damp = dodging ? 0.4 : this.grounded ? (wish > 0.05 ? 2.4 : 8) : 1.2;
    this.vx -= this.vx * damp * dt;
    this.vz -= this.vz * damp * dt;
    const spd = Math.hypot(this.vx, this.vz);
    if (spd > maxSpd) {
      this.vx *= maxSpd / spd;
      this.vz *= maxSpd / spd;
    }

    if (this.dodgeT > 0) this.dodgeT = Math.max(0, this.dodgeT - dt);
    if (this.dodgeCd > 0) this.dodgeCd = Math.max(0, this.dodgeCd - dt);

    if (input.jump) this.jumpBuf = 0.12;
    else this.jumpBuf = Math.max(0, this.jumpBuf - dt);
    if (this.grounded) this.coyote = 0.12;
    else this.coyote = Math.max(0, this.coyote - dt);
    if (this.jumpBuf > 0 && this.coyote > 0) {
      this.vy = JUMP_MS;
      this.grounded = false;
      this.coyote = 0;
      this.jumpBuf = 0;
    }
    this.vy -= GRAVITY * dt;
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    this.hop += this.vy * dt;
    if (this.hop <= 0) {
      this.hop = 0;
      this.vy = 0;
      this.grounded = true;
    } else this.grounded = false;

    const t = this.zNorm;
    const half = (h.widthNear * (1 - t) + h.widthFar * t) * 0.5;
    this.x = Math.max(-half, Math.min(half, this.x));
    this.z = Math.max(0, Math.min(h.depth, this.z));
    if (this.mode === "biome") this.resolveObstacles();

    this.tickMomentum(dt, input.sprint);

    if (h.sidePortals) {
      this.nearDoorSide = this.x < -half * 0.64 ? "L" : this.x > half * 0.64 ? "R" : null;
    } else {
      const far = this.z > h.portalZ;
      this.nearDoorSide = far && this.x < -h.portalX * 0.5 ? "L" : far && this.x > h.portalX * 0.5 ? "R" : null;
    }
    this.nearDoor = this.nearDoorSide !== null;

    if (input.howl) this.howlT = 1;
    if (this.howlT > 0) this.howlT = Math.max(0, this.howlT - dt);
  }

  private resolveObstacles() {
    if (this.hop > 0.55) return;
    for (let i = 0; i < this.obstacles.length; i++) {
      const o = this.obstacles[i]!;
      if ((this.hitCool[i] ?? 0) > this.simT) continue;
      const dx = this.x - o.x;
      const dz = this.z - o.z;
      const d = Math.hypot(dx, dz);
      if (d < o.r && d > 1e-4) {
        this.hitCool[i] = this.simT + 0.7;
        this.momentum = Math.max(0, this.momentum * 0.42 - 1.1);
        this.chain *= 0.35;
        this.cleanliness = Math.max(0.2, this.cleanliness * 0.72);
        const side = dx === 0 ? (this.x >= 0 ? 1 : -1) : Math.sign(dx);
        this.vx += side * 2.6;
        this.x += side * 0.22;
      }
    }
  }

  tryDodge(ax = 0, az = 0) {
    if (this.mode !== "biome") return false;
    if (this.dodgeCd > 0 || this.dodgeT > 0) return false;
    let dx = ax;
    let dz = az;
    if (Math.hypot(dx, dz) < 0.08) {
      dx = -Math.sin(this.heading);
      dz = Math.cos(this.heading);
    }
    const m = Math.hypot(dx, dz) || 1;
    dx /= m;
    dz /= m;
    this.dodgeX = dx;
    this.dodgeZ = dz;
    this.dodgeT = DODGE_TIME;
    this.dodgeCd = DODGE_CD;
    this.vx = dx * DODGE_MS;
    this.vz = dz * DODGE_MS;
    if (Math.abs(dz) >= 0.22) this.heading = Math.atan2(-dx, dz);
    if (this.cleanliness > 0.5) {
      this.momentum = Math.min(SOFT_CAP + 2, this.momentum + 0.55);
      this.chain = Math.min(6, this.chain + 0.4);
    }
    return true;
  }

  private tickMomentum(dt: number, sprinting: boolean) {
    const h = this.hall;
    const t = this.zNorm;
    const rL = ribbonX(t, -1, h);
    const rR = ribbonX(t, 1, h);
    const dist = Math.min(Math.abs(this.x - rL), Math.abs(this.x - rR), Math.abs(this.x));
    this.cleanliness = 1 - Math.max(0, Math.min(1, (dist - 0.7) / 1.4));
    if (h.sidePortals && Math.abs(this.x) > h.portalX * 0.7) this.cleanliness = Math.max(this.cleanliness, 0.9);
    if (this.z > h.portalZ && Math.abs(Math.abs(this.x) - h.portalX) < 1.2) {
      this.cleanliness = Math.max(this.cleanliness, 0.88);
    }
    const onPath = this.cleanliness > 0.55;
    const spd = this.speed;
    const cleanSprint = sprinting && this.grounded && spd > 1.2 && onPath;

    if (cleanSprint) {
      this.sprintTime += dt;
      const duration = Math.min(this.sprintTime / 3.4, 1);
      const speedF = Math.max(0, Math.min(1.15, spd / SPRINT_MS));
      const raw = speedF * this.cleanliness * (0.5 + 0.5 * duration);
      const chainAssist = 1 + Math.min(this.chain, 5) * 0.08;
      let gain = raw * chainAssist * 2.35 * dt;
      if (this.momentum > SOFT_CAP) gain *= 0.16;
      this.momentum += gain;
      this.chain = Math.min(6, this.chain + dt * 0.55);
    } else {
      this.sprintTime = Math.max(0, this.sprintTime - dt * 1.7);
      const decay = sprinting ? 0.22 : 0.62;
      this.momentum = Math.max(0, this.momentum - decay * dt);
      this.chain = Math.max(0, this.chain - dt * 0.5);
    }
    this.worldInfluence = smoothstep(this.momentum, 0.4, 8.2);
    this.doorArmed = this.momentum >= DOOR_ARM_MOMENTUM && this.cleanliness > 0.45;
  }

  enterKeep() {
    this.vx = 0;
    this.vz = 0;
    this.vy = 0;
    this.hop = 0;
    this.heading = 0;
    this.momentum *= 0.68;
    this.doorArmed = this.momentum >= DOOR_ARM_MOMENTUM;
    this.sprintTime *= 0.4;
    this.dodgeT = 0;
    this.x = this.hall.spawnX;
    this.z = this.hall.spawnZ;
  }
}

function smoothstep(x: number, a: number, b: number) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
