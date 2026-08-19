/**
 * The apartment, authored by hand after the reference illustration.
 *
 * Pure data with no imports, so both the engine (src/game/room.ts) and the
 * offline CPU previewer (tools/preview.mjs) can consume it. One unit is four
 * metres; the floor is y = 0, the camera looks in from +x/+z, so the two built
 * walls are at x = -0.5 (window wall) and z = -0.45 (kitchen wall).
 *
 * Living room: window with curtains, a two-seat sofa under the back wall, a
 * rug with the low table on it, a second sofa facing it, and an armchair on
 * the way to the kitchen. Kitchen: L-shaped run of wood cabinets, tiled
 * backsplash, open shelves of mugs and plates, hood, and the sink.
 */

export type Vec3 = [number, number, number];

export interface RoomPart {
  shape: 'box' | 'cyl' | 'sphere';
  /** Centre of the part. */
  pos: Vec3;
  /** box: width/height/depth · cyl: radius/height/radius · sphere: radius. */
  size: Vec3;
  rot?: Vec3;
  color: number;
  rough?: number;
  /** Corner rounding for boxes, in world units. */
  round?: number;
  /** Decorative parts skip shadow casting to keep the shadow map cheap. */
  flat?: boolean;
}

/** Axis-aligned footprint the cat cannot walk into. */
export interface Rect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

const C = {
  floor: 0xd9a978,
  floorAlt: 0xcf9c69,
  wall: 0xf9e7dc,
  wallSide: 0xf3ddcf,
  tile: 0xfbf4ec,
  grout: 0xe7d6c6,
  skirting: 0xfdf6ef,
  wood: 0xe6b98c,
  woodDark: 0xc9925f,
  panel: 0xf0cba2,
  counter: 0xfaf3e8,
  sofa: 0xbcd393,
  sofaDark: 0xa4bd79,
  cushion: 0xd2e4ae,
  sofa2: 0x8fae86,
  sofa2Dark: 0x7d9b75,
  chair: 0xdcc8a9,
  chairDark: 0xc7ad8b,
  frame: 0xfdf8f1,
  glass: 0xdcefff,
  rug: 0xf4dcd3,
  rugAlt: 0xeac7be,
  leaf: 0x8dbf68,
  metal: 0xd9d9de,
  ceramic: 0xffffff,
  throw1: 0xf3b6ac,
  throw2: 0xf7d9a6,
  throw3: 0xa9cfe4,
  mugA: 0xef9f8d,
  mugB: 0xa9cfe4,
  mugC: 0xf5e2a8,
} as const;

const parts: RoomPart[] = [];

/** Boxes are authored from their bottom face; it is easier to reason about. */
function box(
  x: number,
  yBottom: number,
  z: number,
  w: number,
  h: number,
  d: number,
  color: number,
  opts: { rot?: Vec3; rough?: number; round?: number; flat?: boolean } = {},
): void {
  parts.push({
    shape: 'box',
    pos: [x, yBottom + h / 2, z],
    size: [w, h, d],
    color,
    ...opts,
  });
}

function cyl(
  x: number,
  yBottom: number,
  z: number,
  r: number,
  h: number,
  color: number,
  opts: { rot?: Vec3; rough?: number; flat?: boolean; centred?: boolean } = {},
): void {
  const { centred, ...rest } = opts;
  parts.push({
    shape: 'cyl',
    // Rotated cylinders lie down, so their y is the centre, not the base.
    pos: [x, centred ? yBottom : yBottom + h / 2, z],
    size: [r, h, r],
    color,
    ...rest,
  });
}

function ball(x: number, y: number, z: number, r: number, color: number): void {
  parts.push({ shape: 'sphere', pos: [x, y, z], size: [r, r, r], color });
}

export const WALL_H = 0.52;
const X0 = -0.5;
const X1 = 0.5;
const Z0 = -0.45;
const Z1 = 0.45;
const T = 0.025; // wall thickness

/* ------------------------------------------------------------- shell --- */

// Plank floor: alternating strips running along x.
const planks = 14;
for (let i = 0; i < planks; i += 1) {
  const depth = (Z1 - Z0) / planks;
  box(
    0,
    -0.012,
    Z0 + depth * (i + 0.5),
    X1 - X0,
    0.012,
    depth * 0.97,
    i % 2 ? C.floor : C.floorAlt,
    { rough: 0.8, flat: true },
  );
}

// Back and left walls only: the open sides face the camera.
box(0, 0, Z0 + T / 2, X1 - X0, WALL_H, T, C.wall, { rough: 0.95 });
box(X0 + T / 2, 0, 0, T, WALL_H, Z1 - Z0, C.wallSide, { rough: 0.95 });
// Skirting boards.
box(0, 0, Z0 + T + 0.006, X1 - X0, 0.022, 0.012, C.skirting, { flat: true });
box(X0 + T + 0.006, 0, 0, 0.012, 0.022, Z1 - Z0, C.skirting, { flat: true });

// Partition between living room and kitchen, with a wide doorway at the front.
box(0.035, 0, -0.2725, 0.03, WALL_H, 0.305, C.wall, { rough: 0.95 });

/* -------------------------------------------------------- living room --- */

// Window on the left wall (the curtain prop hangs here).
const winZ = -0.06;
const winY = 0.2;
const winH = 0.3;
const winW = 0.32;
box(X0 + T + 0.002, winY, winZ, 0.004, winH, winW, C.glass, { flat: true });
box(X0 + T + 0.004, winY - 0.018, winZ, 0.022, 0.018, winW + 0.05, C.frame); // sill
box(X0 + T + 0.004, winY + winH, winZ, 0.016, 0.016, winW + 0.05, C.frame);
box(X0 + T + 0.004, winY, winZ - winW / 2, 0.016, winH, 0.016, C.frame);
box(X0 + T + 0.004, winY, winZ + winW / 2, 0.016, winH, 0.016, C.frame);
box(X0 + T + 0.004, winY + winH / 2 - 0.008, winZ, 0.012, 0.012, winW, C.frame, {
  flat: true,
});
// Curtain rod with turned finials, as in the reference.
cyl(X0 + T + 0.032, winY + winH + 0.035, winZ, 0.006, winW + 0.14, C.woodDark, {
  rot: [Math.PI / 2, 0, 0],
  centred: true,
});
for (const dz of [-(winW + 0.14) / 2, (winW + 0.14) / 2]) {
  ball(X0 + T + 0.032, winY + winH + 0.035, winZ + dz, 0.012, C.woodDark);
}

/**
 * A soft two-seat sofa. `dir` is +1 when the seat faces +z (backrest on the
 * -z side) and -1 when it faces the other way.
 */
function sofa(
  cx: number,
  cz: number,
  w: number,
  d: number,
  dir: 1 | -1,
  body: number,
  dark: number,
  cushion: number,
): void {
  const back = cz - (dir * d) / 2;
  box(cx, 0.028, cz, w, 0.055, d, body, { round: 0.022, rough: 0.9 });
  box(cx, 0.028, back + dir * 0.024, w, 0.15, 0.048, dark, { round: 0.022 });
  for (const s of [-1, 1]) {
    box(cx + s * (w / 2 - 0.021), 0.028, cz + dir * 0.012, 0.042, 0.1, d * 0.86, dark, {
      round: 0.018,
    });
  }
  for (const s of [-1, 1]) {
    box(cx + s * w * 0.2, 0.083, cz + dir * 0.014, w * 0.36, 0.032, d * 0.56, cushion, {
      round: 0.016,
    });
  }
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      cyl(cx + sx * (w / 2 - 0.03), 0, cz + sz * (d / 2 - 0.025), 0.008, 0.028, C.woodDark, {
        flat: true,
      });
    }
  }
}

// Light-green sofa against the back wall, facing into the room.
const sofaX = -0.28;
const sofaZ = -0.345;
sofa(sofaX, sofaZ, 0.3, 0.15, 1, C.sofa, C.sofaDark, C.cushion);
// Pastel throw tossed over the right arm.
for (let i = 0; i < 3; i += 1) {
  box(
    sofaX + 0.11,
    0.128 - i * 0.001,
    sofaZ - 0.02 + i * 0.026,
    0.075,
    0.008,
    0.024,
    [C.throw1, C.throw2, C.throw3][i],
    { round: 0.005, flat: true },
  );
}
box(sofaX + 0.128, 0.06, sofaZ + 0.055, 0.035, 0.07, 0.02, C.throw1, {
  round: 0.006,
  flat: true,
});

// Rug in the middle of the living room, with the low table prop on top.
box(-0.2, -0.001, 0.08, 0.36, 0.006, 0.27, C.rug, { round: 0.012, flat: true });
box(-0.2, 0.004, 0.08, 0.3, 0.004, 0.21, C.rugAlt, { round: 0.012, flat: true });

// Second, deeper sofa in the foreground with its back to the camera.
const sofa2X = -0.24;
const sofa2Z = 0.3;
sofa(sofa2X, sofa2Z, 0.28, 0.14, -1, C.sofa2, C.sofa2Dark, C.sofa2);

// Armchair on the way to the kitchen, turned towards the low table (the yarn
// prop sits beside it). Offsets are in the chair's own frame: local -z is the
// direction it faces.
const acX = 0.1;
const acZ = 0.33;
const acAngle = 0.88;
const acRot: Vec3 = [0, acAngle, 0];
const acAt = (lx: number, lz: number): [number, number] => [
  acX + lx * Math.cos(acAngle) + lz * Math.sin(acAngle),
  acZ - lx * Math.sin(acAngle) + lz * Math.cos(acAngle),
];
{
  const [sx, sz] = acAt(0, 0);
  box(sx, 0.028, sz, 0.15, 0.055, 0.15, C.chair, { round: 0.022, rot: acRot });
  box(sx, 0.083, sz, 0.115, 0.03, 0.115, C.cushion, { round: 0.016, rot: acRot });
  const [bx, bz] = acAt(0, 0.062);
  box(bx, 0.028, bz, 0.15, 0.17, 0.028, C.chairDark, { round: 0.014, rot: acRot });
  for (const side of [-1, 1]) {
    const [ax, az] = acAt(side * 0.061, 0.008);
    box(ax, 0.028, az, 0.028, 0.085, 0.13, C.chairDark, { round: 0.013, rot: acRot });
  }
  for (const lx of [-0.05, 0.05]) {
    for (const lz of [-0.05, 0.05]) {
      const [fx, fz] = acAt(lx, lz);
      cyl(fx, 0, fz, 0.007, 0.028, C.woodDark, { flat: true });
    }
  }
}

/* ------------------------------------------------------------ kitchen --- */

const counterTop = 0.225;
const backZ0 = Z0 + T;
const backDepth = 0.15;

// Base run along the back wall.
box(0.28, 0, backZ0 + backDepth / 2, 0.44, counterTop - 0.012, backDepth, C.wood, {
  round: 0.006,
  rough: 0.7,
});
box(0.28, counterTop - 0.012, backZ0 + backDepth / 2, 0.45, 0.014, backDepth + 0.012,
  C.counter, { round: 0.006 });
// Toe kick + doors.
box(0.28, 0, backZ0 + backDepth - 0.012, 0.44, 0.02, 0.012, C.woodDark, { flat: true });
for (const dx of [-0.16, -0.055, 0.055, 0.16]) {
  box(0.28 + dx, 0.03, backZ0 + backDepth - 0.004, 0.095, 0.17, 0.006, C.panel, {
    round: 0.004,
    flat: true,
  });
  box(0.28 + dx, 0.185, backZ0 + backDepth + 0.002, 0.04, 0.006, 0.006, C.metal, {
    flat: true,
  });
}

// Return run with the sink, along the right side.
const rightX = 0.425;
box(rightX, 0, -0.09, 0.15, counterTop - 0.012, 0.37, C.wood, { round: 0.006, rough: 0.7 });
box(rightX, counterTop - 0.012, -0.09, 0.16, 0.014, 0.38, C.counter, { round: 0.006 });
for (const dz of [-0.2, -0.09, 0.02] as const) {
  box(rightX - 0.076, 0.03, dz, 0.006, 0.17, 0.1, C.panel, { round: 0.004, flat: true });
}
// Sink basin and tap.
box(rightX, counterTop - 0.026, -0.02, 0.1, 0.028, 0.14, C.metal, { round: 0.008 });
cyl(rightX + 0.05, counterTop, -0.09, 0.006, 0.05, C.metal, { flat: true });
cyl(rightX + 0.035, counterTop + 0.045, -0.09, 0.004, 0.032, C.metal, {
  rot: [0, 0, Math.PI / 2],
  centred: true,
  flat: true,
});

// Tiled backsplash between counter and wall cabinets.
box(0.28, counterTop, backZ0 + 0.004, 0.44, 0.125, 0.008, C.tile, { flat: true });
for (let i = 1; i < 8; i += 1) {
  box(0.06 + i * 0.055, counterTop, backZ0 + 0.009, 0.003, 0.125, 0.002, C.grout, {
    flat: true,
  });
}
for (let i = 1; i < 3; i += 1) {
  box(0.28, counterTop + i * 0.042, backZ0 + 0.009, 0.44, 0.003, 0.002, C.grout, {
    flat: true,
  });
}

// Upper cabinets flanking two open shelves of mugs and plates.
const upY = 0.36;
box(0.115, upY, backZ0 + 0.045, 0.1, 0.15, 0.09, C.wood, { round: 0.006 });
box(0.115, upY + 0.03, backZ0 + 0.092, 0.09, 0.11, 0.006, C.panel, {
  round: 0.004,
  flat: true,
});
box(0.44, upY, backZ0 + 0.045, 0.1, 0.15, 0.09, C.wood, { round: 0.006 });
box(0.44, upY + 0.03, backZ0 + 0.092, 0.09, 0.11, 0.006, C.panel, {
  round: 0.004,
  flat: true,
});

// Two open shelf bays with crockery, as in the reference.
for (const bayX of [0.235, 0.345]) {
  box(bayX, upY, backZ0 + 0.006, 0.1, 0.15, 0.008, C.tile, { flat: true }); // back
  box(bayX, upY, backZ0 + 0.045, 0.1, 0.008, 0.09, C.woodDark, { round: 0.003 });
  box(bayX, upY + 0.142, backZ0 + 0.045, 0.1, 0.008, 0.09, C.woodDark, { round: 0.003 });
  for (const side of [-1, 1]) {
    box(bayX + side * 0.046, upY, backZ0 + 0.045, 0.008, 0.15, 0.09, C.woodDark, {
      round: 0.003,
    });
  }
  box(bayX, upY + 0.07, backZ0 + 0.045, 0.09, 0.006, 0.086, C.panel, { flat: true });
  // Mugs on the lower shelf.
  [C.mugA, C.mugB, C.mugC].forEach((color, i) => {
    cyl(bayX - 0.028 + i * 0.028, upY + 0.008, backZ0 + 0.045, 0.011, 0.016, color, {
      flat: true,
    });
  });
  // Stacked plates on the upper shelf.
  for (let i = 0; i < 3; i += 1) {
    cyl(bayX - 0.02, upY + 0.076 + i * 0.006, backZ0 + 0.045, 0.017, 0.005, C.ceramic, {
      flat: true,
    });
  }
  cyl(bayX + 0.022, upY + 0.076, backZ0 + 0.045, 0.016, 0.03, C.mugB, { flat: true });
}

// Range hood above the stove.
box(0.16, upY - 0.02, backZ0 + 0.05, 0.14, 0.05, 0.1, C.frame, { round: 0.008 });
box(0.16, upY + 0.03, backZ0 + 0.04, 0.06, 0.13, 0.06, C.frame, { flat: true });

// Utensil jar and a chopping board for life.
cyl(0.35, counterTop + 0.002, backZ0 + 0.05, 0.016, 0.038, C.woodDark, { flat: true });
for (const dx of [-0.004, 0.004]) {
  cyl(0.35 + dx, counterTop + 0.03, backZ0 + 0.05, 0.002, 0.03, C.panel, { flat: true });
}
box(0.075, counterTop + 0.004, backZ0 + 0.06, 0.05, 0.008, 0.07, C.woodDark, {
  round: 0.004,
  rot: [0, 0.2, 0],
  flat: true,
});

export const ROOM = {
  extentX: X1 - X0,
  extentZ: Z1 - Z0,
  wallHeight: WALL_H,
  parts,
  /** Furniture footprints the cat collides with. */
  colliders: [
    { x0: X0, x1: X0 + T, z0: Z0, z1: Z1 }, // left wall
    { x0: X0, x1: X1, z0: Z0, z1: Z0 + T }, // back wall
    { x0: 0.02, x1: 0.05, z0: Z0, z1: -0.12 }, // partition
    { x0: sofaX - 0.16, x1: sofaX + 0.16, z0: sofaZ - 0.085, z1: sofaZ + 0.085 }, // sofa
    { x0: sofa2X - 0.15, x1: sofa2X + 0.15, z0: sofa2Z - 0.08, z1: sofa2Z + 0.08 }, // sofa 2
    // The chair is turned 0.88 rad, so its axis-aligned footprint is wider
    // than the seat itself (0.15/2 * (|cos| + |sin|) ≈ 0.106).
    { x0: acX - 0.108, x1: acX + 0.108, z0: acZ - 0.108, z1: acZ + 0.108 }, // armchair
    { x0: 0.06, x1: 0.5, z0: Z0, z1: backZ0 + backDepth }, // kitchen counter
    { x0: 0.35, x1: 0.5, z0: backZ0 + backDepth, z1: 0.095 }, // sink run
  ] as Rect[],
} as const;
