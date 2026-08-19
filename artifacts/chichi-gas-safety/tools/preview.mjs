/**
 * Offline previewer for the whole game scene.
 *
 * The sandboxed browsers available during development cannot create a WebGL
 * context, so this builds the real scene in Node (three.js runs fine without
 * a renderer), reproduces the engine's camera maths and software-rasterises
 * the result to a PNG. It is the only way to see what the game looks like
 * from here.
 *
 *   node tools/preview.mjs --out /tmp/scene.png
 *   node tools/preview.mjs --w 402 --h 700          # portrait auto-fit
 *   node tools/preview.mjs --dir '[0.55,1.05,0.62]' # try a camera angle
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

import { ROOM } from '../src/game/room-layout.ts';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, arg, i, all) => {
    if (arg.startsWith('--')) acc.push([arg.slice(2), all[i + 1]]);
    return acc;
  }, []),
);

const OUT = args.out ?? '/tmp/scene.png';
const WIDTH = Number(args.w ?? 960);
const HEIGHT = Number(args.h ?? 600);
const MARKS = JSON.parse(args.marks ?? '[]');

const dump = execFileSync('npx', ['tsx', 'tools/scene-entry.ts'], {
  maxBuffer: 1024 * 1024 * 512,
  encoding: 'utf8',
});
const scene = JSON.parse(dump);
const triCount = scene.colors.length;

const vec = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  cross: (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  norm: (a) => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  },
};

/* --------------------------------- camera (mirrors Game.resize) -------- */

const aspect = WIDTH / HEIGHT;
const fovDeg = aspect < 0.8 ? 44 : aspect < 1.3 ? 39 : 34;
const fovV = (fovDeg * Math.PI) / 180;
const fovH = 2 * Math.atan(Math.tan(fovV / 2) * aspect);
const radius = Math.hypot(ROOM.extentX, ROOM.extentZ) * 0.5;
const distance =
  Math.max(radius / Math.sin(fovV / 2), radius / Math.sin(fovH / 2)) * 0.86 + 0.2;

const dir = vec.norm(JSON.parse(args.dir ?? '[0.55, 1.05, 0.62]'));
const eye = [dir[0] * distance, dir[1] * distance, dir[2] * distance];
const look = [0, ROOM.wallHeight * 0.1, 0];

const zAxis = vec.norm(vec.sub(eye, look));
const xAxis = vec.norm(vec.cross([0, 1, 0], zAxis));
const yAxis = vec.cross(zAxis, xAxis);
const focal = 1 / Math.tan(fovV / 2);

function project(p) {
  const d = vec.sub(p, eye);
  const v = [vec.dot(d, xAxis), vec.dot(d, yAxis), vec.dot(d, zAxis)];
  const z = -v[2];
  if (z <= 0.001) return null;
  return [
    ((v[0] * focal) / aspect / z / 2 + 0.5) * WIDTH,
    (1 - ((v[1] * focal) / z / 2 + 0.5)) * HEIGHT,
    z,
  ];
}

/* -------------------------------------------------------- rasterise ---- */

const depth = new Float32Array(WIDTH * HEIGHT).fill(Infinity);
const color = new Uint8Array(WIDTH * HEIGHT * 3);
for (let i = 0; i < WIDTH * HEIGHT; i += 1) {
  color[i * 3] = 26;
  color[i * 3 + 1] = 24;
  color[i * 3 + 2] = 32;
}
const lightDir = vec.norm([0.55, 0.9, 0.5]);

function raster(p0, p1, p2, hex) {
  const p = [project(p0), project(p1), project(p2)];
  if (p.some((v) => v === null)) return;
  const n = vec.norm(vec.cross(vec.sub(p1, p0), vec.sub(p2, p0)));
  const lambert = 0.42 + Math.abs(vec.dot(n, lightDir)) * 0.72;
  const r = ((hex >> 16) & 255) * lambert;
  const g = ((hex >> 8) & 255) * lambert;
  const b = (hex & 255) * lambert;

  const minX = Math.max(0, Math.floor(Math.min(p[0][0], p[1][0], p[2][0])));
  const maxX = Math.min(WIDTH - 1, Math.ceil(Math.max(p[0][0], p[1][0], p[2][0])));
  const minY = Math.max(0, Math.floor(Math.min(p[0][1], p[1][1], p[2][1])));
  const maxY = Math.min(HEIGHT - 1, Math.ceil(Math.max(p[0][1], p[1][1], p[2][1])));
  const area =
    (p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) - (p[2][0] - p[0][0]) * (p[1][1] - p[0][1]);
  if (Math.abs(area) < 1e-9) return;

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const px = x + 0.5;
      const py = y + 0.5;
      const w0 = ((p[1][0] - px) * (p[2][1] - py) - (p[2][0] - px) * (p[1][1] - py)) / area;
      const w1 = ((p[2][0] - px) * (p[0][1] - py) - (p[0][0] - px) * (p[2][1] - py)) / area;
      const w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const z = w0 * p[0][2] + w1 * p[1][2] + w2 * p[2][2];
      const idx = y * WIDTH + x;
      if (z >= depth[idx]) continue;
      depth[idx] = z;
      color[idx * 3] = Math.min(255, r);
      color[idx * 3 + 1] = Math.min(255, g);
      color[idx * 3 + 2] = Math.min(255, b);
    }
  }
}

const P = scene.positions;
for (let t = 0; t < triCount; t += 1) {
  const o = t * 9;
  raster(
    [P[o], P[o + 1], P[o + 2]],
    [P[o + 3], P[o + 4], P[o + 5]],
    [P[o + 6], P[o + 7], P[o + 8]],
    scene.colors[t],
  );
}

/* ------------- markers: a little box standing at each placement -------- */

const MARK_COLORS = [0xff3b30, 0x34c759, 0x0a84ff, 0xffd60a, 0xff2d95];
MARKS.forEach((mark, i) => {
  const s = mark.s ?? 0.012;
  const h = mark.h ?? 0.12;
  const y0 = mark.y ?? 0;
  const [x, z] = [mark.x, mark.z];
  const v = [
    [x - s, y0, z - s], [x + s, y0, z - s], [x + s, y0, z + s], [x - s, y0, z + s],
    [x - s, y0 + h, z - s], [x + s, y0 + h, z - s],
    [x + s, y0 + h, z + s], [x - s, y0 + h, z + s],
  ];
  const faces = [
    [0, 4, 5], [0, 5, 1], [1, 5, 6], [1, 6, 2],
    [2, 6, 7], [2, 7, 3], [3, 7, 4], [3, 4, 0], [4, 6, 5], [4, 7, 6],
  ];
  for (const f of faces) {
    raster(v[f[0]], v[f[1]], v[f[2]], MARK_COLORS[i % MARK_COLORS.length]);
  }
});

console.log(`triangles ${triCount} · ${WIDTH}x${HEIGHT} · marks ${MARKS.length}`);

/* ----------------------------------------------------------- output ---- */

const table = (() => {
  const t = [];
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

const raw = Buffer.alloc((WIDTH * 3 + 1) * HEIGHT);
for (let y = 0; y < HEIGHT; y += 1) {
  raw[y * (WIDTH * 3 + 1)] = 0;
  Buffer.from(color.buffer, y * WIDTH * 3, WIDTH * 3).copy(raw, y * (WIDTH * 3 + 1) + 1);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(WIDTH, 0);
ihdr.writeUInt32BE(HEIGHT, 4);
ihdr[8] = 8;
ihdr[9] = 2;
writeFileSync(
  OUT,
  Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]),
);
console.log('wrote', OUT);
