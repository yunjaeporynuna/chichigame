/**
 * Static reachability check for the room layout.
 *
 * WebGL is unavailable in the dev sandbox, so this replays the engine's
 * collision rules (furniture/prop boxes + the cat's body box) on the CPU
 * and proves that, from the spawn point, the cat can reach every objective
 * and every collectible. Run it after moving furniture or props.
 *
 *   node tools/validate-layout.mjs
 */
import { readFileSync } from 'node:fs';

import { ROOM } from '../src/game/room-layout.ts';

const configSrc = readFileSync('src/game/config.ts', 'utf8');
const num = (name) => Number(configSrc.match(new RegExp(`${name}: ([\\d.]+)`))[1]);
const interactRadius = num('interactRadius');
const catHalfX = Number(configSrc.match(/catCollider: \{ halfX: ([\d.]+),/)[1]);
const catHalfZ = Number(
  configSrc.match(/catCollider: \{ halfX: [\d.]+, halfZ: ([\d.]+) \}/)[1],
);

// Split the KNOCK_DEFS array into entries; cut options are nested deeper and
// never start a new "id:" at four-space indent.
const defsSrc = configSrc.match(/KNOCK_DEFS[\s\S]*?\n\];/)[0];
const props = defsSrc
  .split(/\n    id: '/)
  .slice(1)
  .map((chunk) => {
    const id = chunk.slice(0, chunk.indexOf("'"));
    const field = (name) => {
      const m = chunk.match(new RegExp(`\\n    ${name}: (-?[\\d.]+),`));
      return m ? Number(m[1]) : undefined;
    };
    const blockMatch = chunk.match(/\n    block: \[([\d.]+), ([\d.]+)\],/);
    return {
      id,
      x: field('x'),
      z: field('z'),
      reach: field('reach'),
      block: blockMatch ? [Number(blockMatch[1]), Number(blockMatch[2])] : null,
    };
  });
const stickers = [
  ...configSrc
    .match(/STICKER_SPOTS[\s\S]*?\];/)[0]
    .matchAll(/x: (-?[\d.]+), z: (-?[\d.]+)/g),
].map((m) => ({ x: Number(m[1]), z: Number(m[2]) }));
const spawnMatch = configSrc.match(/SPAWN = \{ x: (-?[\d.]+), z: (-?[\d.]+) \}/);
const spawn = { x: Number(spawnMatch[1]), z: Number(spawnMatch[2]) };

// Props with a footprint are solid too: the cat has to stop at them, but must
// still get close enough to interact.
const colliders = [
  ...ROOM.colliders,
  ...props
    .filter((prop) => prop.block)
    .map((prop) => ({
      x0: prop.x - prop.block[0],
      x1: prop.x + prop.block[0],
      z0: prop.z - prop.block[1],
      z1: prop.z + prop.block[1],
    })),
];

if (props.length !== 8) {
  console.error(`FAIL parsed ${props.length} objectives, expected 8`);
  process.exit(1);
}

let failures = 0;

// Every interactive object must own a solid floor footprint. Wall-mounted and
// counter-top props have an overlapping room collider, while the rest must
// have a directly-authored block. This prevents a later prop edit from
// accidentally making a visible object walk-through.
console.log('collider boxes:');
for (const prop of props) {
  const own = prop.block
    ? {
        x0: prop.x - prop.block[0],
        x1: prop.x + prop.block[0],
        z0: prop.z - prop.block[1],
        z1: prop.z + prop.block[1],
      }
    : null;
  const covered = own
    ? colliders.some(
        (rect) =>
          Math.abs(rect.x0 - own.x0) < 1e-9 &&
          Math.abs(rect.x1 - own.x1) < 1e-9 &&
          Math.abs(rect.z0 - own.z0) < 1e-9 &&
          Math.abs(rect.z1 - own.z1) < 1e-9,
      )
    : ROOM.colliders.some(
        (rect) =>
          prop.x > rect.x0 &&
          prop.x < rect.x1 &&
          prop.z > rect.z0 &&
          prop.z < rect.z1,
      );
  if (!covered) {
    console.error(`FAIL ${prop.id}: no object collider covers its position`);
    failures += 1;
  } else {
    console.log(`  ok ${prop.id.padEnd(12)} ${own ? 'prop box' : 'room box'}`);
  }
}

const canStand = (x, z) => {
  if (Math.abs(x) > ROOM.extentX * 0.5 - catHalfX) return false;
  if (Math.abs(z) > ROOM.extentZ * 0.5 - catHalfZ) return false;
  return !colliders.some(
    (rect) =>
      x > rect.x0 - catHalfX &&
      x < rect.x1 + catHalfX &&
      z > rect.z0 - catHalfZ &&
      z < rect.z1 + catHalfZ,
  );
};

/* ---- flood fill the floor the cat can actually get to ------------------ */

const STEP = 0.01;
const NX = Math.round(ROOM.extentX / STEP);
const NZ = Math.round(ROOM.extentZ / STEP);
const world = (ix, iz) => [
  -ROOM.extentX / 2 + (ix + 0.5) * STEP,
  -ROOM.extentZ / 2 + (iz + 0.5) * STEP,
];
const index = (x, z) => [
  Math.floor((x + ROOM.extentX / 2) / STEP),
  Math.floor((z + ROOM.extentZ / 2) / STEP),
];

const open = new Uint8Array(NX * NZ);
for (let iz = 0; iz < NZ; iz += 1)
  for (let ix = 0; ix < NX; ix += 1) {
    const [wx, wz] = world(ix, iz);
    open[iz * NX + ix] = canStand(wx, wz) ? 1 : 0;
  }

const reached = new Uint8Array(NX * NZ);
const [sx, sz] = index(spawn.x, spawn.z);
if (!open[sz * NX + sx]) {
  console.error(`FAIL spawn (${spawn.x}, ${spawn.z}) is blocked`);
  failures += 1;
} else {
  const queue = [[sx, sz]];
  reached[sz * NX + sx] = 1;
  while (queue.length) {
    const [ix, iz] = queue.pop();
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = ix + dx;
      const nz = iz + dz;
      if (nx < 0 || nz < 0 || nx >= NX || nz >= NZ) continue;
      const at = nz * NX + nx;
      if (reached[at] || !open[at]) continue;
      reached[at] = 1;
      queue.push([nx, nz]);
    }
  }
}

const openCount = open.reduce((s, v) => s + v, 0);
const reachedCount = reached.reduce((s, v) => s + v, 0);
console.log(
  `floor cells ${openCount} · reachable from spawn ${reachedCount} (${Math.round((reachedCount / openCount) * 100)}%)`,
);
if (reachedCount < openCount * 0.9) {
  console.error('FAIL more than 10% of the floor is cut off from the spawn point');
  failures += 1;
}

function checkTarget(label, x, z, radius) {
  let best = null;
  let closest = Infinity;
  for (let iz = 0; iz < NZ; iz += 1)
    for (let ix = 0; ix < NX; ix += 1) {
      if (!reached[iz * NX + ix]) continue;
      const [cx, cz] = world(ix, iz);
      const dist = Math.hypot(cx - x, cz - z);
      closest = Math.min(closest, dist);
      if (dist <= radius && (best === null || dist < best)) best = dist;
    }
  if (best === null) {
    console.error(
      `FAIL ${label}: nearest clear floor ${closest.toFixed(3)} exceeds ${radius.toFixed(3)}`,
    );
    failures += 1;
  } else {
    console.log(
      `  ok ${label.padEnd(12)} approach ${best.toFixed(3)} / ${radius.toFixed(3)}`,
    );
  }
}

console.log('\nobjectives:');
for (const prop of props) checkTarget(prop.id, prop.x, prop.z, interactRadius + prop.reach);
console.log('\ncollectibles:');
stickers.forEach((spot, i) => checkTarget(`sticker ${i + 1}`, spot.x, spot.z, 0.05));

if (failures) {
  console.error(`\n${failures} problem(s) found.`);
  process.exit(1);
}
console.log('\nlayout OK: the cat can reach every objective and collectible.');
