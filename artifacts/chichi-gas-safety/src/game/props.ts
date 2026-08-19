import * as THREE from 'three';

import { PALETTE } from './config';

/**
 * Every interactive object is built procedurally in a soft, rounded, pastel
 * style so it reads at a glance against the photographic room model.
 * Each prop exposes a 0..1 "tidied" progress used by the cinematics.
 */
export interface PropVisual {
  group: THREE.Group;
  /** 0 = messy / hazardous, 1 = tidied / safe. */
  setProgress: (t: number) => void;
  /** Idle animation (LED blink, gas wisps, gentle sway). */
  update: (time: number, progress: number) => void;
  /** Local height used for markers, popups and cutscene framing. */
  focusHeight: number;
}

const soft = (color: number, extra: Partial<THREE.MeshStandardMaterial> = {}) =>
  Object.assign(
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.82,
      metalness: 0.04,
    }),
    extra,
  );

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => t * t * (3 - 2 * t);

function box(
  w: number,
  h: number,
  d: number,
  material: THREE.Material,
  radiusSegments = 2,
): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d, radiusSegments, radiusSegments);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function cyl(
  rt: number,
  rb: number,
  h: number,
  material: THREE.Material,
  seg = 14,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function ball(r: number, material: THREE.Material, seg = 14): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Rising gas wisps — visible only while the hazard is unresolved. */
function makeWisps(count: number, spread: number, rise: number): {
  points: THREE.Points;
  update: (time: number, progress: number) => void;
} {
  const positions = new Float32Array(count * 3);
  const offsets = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    offsets[i] = Math.random();
    positions[i * 3] = (Math.random() - 0.5) * spread;
    positions[i * 3 + 1] = Math.random() * rise;
    positions[i * 3 + 2] = (Math.random() - 0.5) * spread;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xd6f0ff,
    size: 0.008,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;

  return {
    points,
    update: (time, progress) => {
      material.opacity = 0.55 * (1 - progress);
      points.visible = progress < 0.98;
      if (!points.visible) return;
      const attr = geo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < count; i += 1) {
        const phase = (time * 0.22 + offsets[i]) % 1;
        attr.setY(i, phase * rise);
        attr.setX(i, Math.sin(time * 1.4 + i) * spread * 0.35);
      }
      attr.needsUpdate = true;
    },
  };
}

/* ---------------------------------------------------------------- plant -- */
function buildPlant(): PropVisual {
  const group = new THREE.Group();
  const potMat = soft(0xe4917c);
  const soilMat = soft(0x6b4b3a);
  const leafMat = soft(0x84b17a);

  const pot = new THREE.Group();
  const potBody = cyl(0.019, 0.014, 0.03, potMat);
  potBody.position.y = 0.015;
  const rim = cyl(0.021, 0.021, 0.005, potMat);
  rim.position.y = 0.031;
  const soil = cyl(0.018, 0.018, 0.004, soilMat);
  soil.position.y = 0.032;
  pot.add(potBody, rim, soil);

  const foliage = new THREE.Group();
  foliage.position.y = 0.034;
  for (let i = 0; i < 6; i += 1) {
    const leaf = ball(0.011, leafMat, 10);
    const angle = (i / 6) * Math.PI * 2;
    leaf.position.set(
      Math.cos(angle) * 0.011,
      0.012 + Math.sin(i * 1.7) * 0.006,
      Math.sin(angle) * 0.011,
    );
    leaf.scale.set(1, 0.7, 1.5);
    leaf.rotation.y = angle;
    foliage.add(leaf);
  }
  const stem = cyl(0.002, 0.003, 0.02, leafMat, 6);
  stem.position.y = 0.008;
  foliage.add(stem);
  pot.add(foliage);
  group.add(pot);

  // Spilled soil crumbs that sweep back into the pot when tidied.
  const crumbs: THREE.Mesh[] = [];
  for (let i = 0; i < 7; i += 1) {
    const crumb = ball(0.0035 + Math.random() * 0.002, soilMat, 6);
    const angle = Math.random() * Math.PI * 2;
    const dist = 0.02 + Math.random() * 0.03;
    crumb.userData.spread = new THREE.Vector3(
      Math.cos(angle) * dist,
      0.003,
      Math.sin(angle) * dist,
    );
    crumbs.push(crumb);
    group.add(crumb);
  }

  const setProgress = (raw: number) => {
    const t = ease(THREE.MathUtils.clamp(raw, 0, 1));
    pot.rotation.z = lerp(-Math.PI / 2.1, 0, t);
    pot.position.set(lerp(-0.012, 0, t), lerp(0.019, 0, t), 0);
    foliage.rotation.z = lerp(0.3, 0, t);
    crumbs.forEach((crumb, i) => {
      const spread = crumb.userData.spread as THREE.Vector3;
      crumb.position.set(
        lerp(spread.x, 0.004 * Math.cos(i), t),
        lerp(spread.y, 0.033, t),
        lerp(spread.z, 0.004 * Math.sin(i), t),
      );
      crumb.scale.setScalar(lerp(1, 0.5, t));
    });
  };

  setProgress(0);

  return {
    group,
    setProgress,
    focusHeight: 0.05,
    update: (time, progress) => {
      foliage.rotation.y = Math.sin(time * 0.7) * 0.08;
      foliage.position.y = 0.034 + Math.sin(time * 1.2) * 0.001 * progress;
    },
  };
}

/* ----------------------------------------------------------------- yarn -- */
function buildYarn(): PropVisual {
  const group = new THREE.Group();
  const yarnMat = soft(0xd98fa8);

  const ballMesh = ball(0.016, yarnMat, 16);
  ballMesh.position.y = 0.016;
  group.add(ballMesh);

  const strands: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i += 1) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.012, 0),
      new THREE.Vector3(0.02 * Math.cos(i), 0.006, 0.02 * Math.sin(i * 1.3)),
      new THREE.Vector3(0.04 * Math.cos(i * 2), 0.004, 0.03 * Math.sin(i)),
      new THREE.Vector3(0.055 * Math.cos(i * 1.6), 0.003, 0.05 * Math.sin(i * 2)),
    ]);
    const strand = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 18, 0.0016, 5, false),
      yarnMat,
    );
    strand.castShadow = true;
    strands.push(strand);
    group.add(strand);
  }

  const setProgress = (raw: number) => {
    const t = ease(THREE.MathUtils.clamp(raw, 0, 1));
    ballMesh.scale.setScalar(lerp(0.82, 1.08, t));
    strands.forEach((strand, i) => {
      strand.scale.setScalar(lerp(1, 0.12, t));
      strand.rotation.y = lerp(0, Math.PI * 1.5, t) + i * 0.4;
      (strand.material as THREE.Material).opacity = 1;
    });
  };

  setProgress(0);

  return {
    group,
    setProgress,
    focusHeight: 0.035,
    update: (time, progress) => {
      ballMesh.rotation.y = time * (0.3 + progress * 0.4);
      ballMesh.position.y = 0.016 + Math.abs(Math.sin(time * 1.6)) * 0.002;
    },
  };
}

/* -------------------------------------------------------------- curtain -- */
function buildCurtain(): PropVisual {
  const group = new THREE.Group();
  const clothMat = soft(0xa9c8e8, { side: THREE.DoubleSide });
  const rodMat = soft(0xb0885f, { metalness: 0.3, roughness: 0.5 });

  const rod = cyl(0.0035, 0.0035, 0.16, rodMat, 8);
  rod.rotation.z = Math.PI / 2;
  rod.position.y = 0.14;
  group.add(rod);

  const panels: THREE.Mesh[] = [];
  for (let i = 0; i < 6; i += 1) {
    const panel = box(0.024, 0.11, 0.006, clothMat);
    panel.position.set(-0.062 + i * 0.025, 0.083, 0);
    panels.push(panel);
    group.add(panel);
  }

  const setProgress = (raw: number) => {
    const t = ease(THREE.MathUtils.clamp(raw, 0, 1));
    panels.forEach((panel, i) => {
      const messyTilt = ((i % 3) - 1) * 0.18 + (i === 2 ? 0.24 : 0);
      const messyDrop = i % 2 === 0 ? -0.012 : 0.004;
      panel.rotation.z = lerp(messyTilt, 0, t);
      panel.rotation.x = lerp(i === 4 ? 0.16 : 0.05, 0, t);
      panel.position.y = lerp(0.083 + messyDrop, 0.083, t);
      panel.position.x = lerp(
        -0.062 + i * 0.025 + (i % 2 === 0 ? 0.006 : -0.004),
        -0.062 + i * 0.025,
        t,
      );
      panel.scale.y = lerp(0.88, 1, t);
    });
  };

  setProgress(0);

  return {
    group,
    setProgress,
    focusHeight: 0.14,
    update: (time) => {
      panels.forEach((panel, i) => {
        panel.rotation.y = Math.sin(time * 0.8 + i * 0.5) * 0.03;
      });
    },
  };
}

/* ----------------------------------------------------------------- desk -- */
function buildDesk(): PropVisual {
  const group = new THREE.Group();
  const woodMat = soft(0xc9a37a);
  const paperMat = soft(0xfaf5ec);
  const mugMat = soft(0x7fb0c4);
  const penMat = soft(0x4a5568);

  const top = box(0.11, 0.006, 0.06, woodMat);
  top.position.y = 0.056;
  group.add(top);
  for (const [x, z] of [
    [-0.05, -0.025],
    [0.05, -0.025],
    [-0.05, 0.025],
    [0.05, 0.025],
  ]) {
    const leg = box(0.005, 0.056, 0.005, woodMat);
    leg.position.set(x, 0.028, z);
    group.add(leg);
  }

  const papers: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i += 1) {
    const sheet = box(0.026, 0.001, 0.02, paperMat);
    sheet.userData.messy = {
      x: -0.03 + Math.random() * 0.06,
      z: -0.02 + Math.random() * 0.04,
      rot: (Math.random() - 0.5) * 1.4,
      y: 0.06 + i * 0.0012,
    };
    papers.push(sheet);
    group.add(sheet);
  }

  const cup = cyl(0.007, 0.006, 0.014, mugMat, 12);
  cup.position.set(0.036, 0.066, 0.016);
  group.add(cup);

  const penCup = cyl(0.006, 0.006, 0.014, soft(0x9c8bb5), 10);
  penCup.position.set(-0.04, 0.066, -0.018);
  group.add(penCup);

  const pen = cyl(0.0012, 0.0012, 0.02, penMat, 6);
  group.add(pen);

  const setProgress = (raw: number) => {
    const t = ease(THREE.MathUtils.clamp(raw, 0, 1));
    papers.forEach((sheet, i) => {
      const messy = sheet.userData.messy as {
        x: number;
        z: number;
        rot: number;
        y: number;
      };
      sheet.position.set(
        lerp(messy.x, -0.012, t),
        lerp(messy.y, 0.06 + i * 0.0012, t),
        lerp(messy.z, 0.004, t),
      );
      sheet.rotation.y = lerp(messy.rot, 0, t);
      sheet.rotation.z = lerp((i % 2 ? 1 : -1) * 0.12, 0, t);
    });
    // Pen: rolling on the desk -> standing in the cup.
    pen.position.set(
      lerp(0.01, -0.04, t),
      lerp(0.0605, 0.074, t),
      lerp(-0.022, -0.018, t),
    );
    pen.rotation.set(lerp(Math.PI / 2, 0, t), 0, lerp(0.3, 0.12, t));
    // Mug: teetering at the edge -> pushed safely inward.
    cup.position.set(lerp(0.048, 0.034, t), 0.066, lerp(0.026, 0.012, t));
    cup.rotation.z = lerp(0.16, 0, t);
  };

  setProgress(0);

  return {
    group,
    setProgress,
    focusHeight: 0.085,
    update: (time, progress) => {
      cup.position.y = 0.066 + Math.sin(time * 3) * 0.0006 * (1 - progress);
    },
  };
}

/* ------------------------------------------------------------ gas stove -- */
function buildStove(): PropVisual {
  const group = new THREE.Group();
  const bodyMat = soft(0xdad4cc, { metalness: 0.2, roughness: 0.55 });
  const burnerMat = soft(0x40454d, { metalness: 0.4, roughness: 0.4 });
  const knobOff = soft(0xf0eae2);
  const flameMat = new THREE.MeshBasicMaterial({
    color: 0xff9d6b,
    transparent: true,
    opacity: 0.85,
  });

  const body = box(0.09, 0.012, 0.06, bodyMat);
  body.position.y = 0.006;
  group.add(body);

  const burners: THREE.Mesh[] = [];
  for (const x of [-0.022, 0.022]) {
    const burner = cyl(0.014, 0.012, 0.004, burnerMat, 14);
    burner.position.set(x, 0.014, 0);
    burners.push(burner);
    group.add(burner);
  }

  const knob = cyl(0.006, 0.006, 0.005, knobOff, 10);
  knob.rotation.x = Math.PI / 2;
  knob.position.set(-0.03, 0.008, 0.031);
  group.add(knob);
  const knobMark = box(0.0015, 0.001, 0.005, soft(0xd05f4d));
  knobMark.position.set(0, 0.003, 0);
  knob.add(knobMark);

  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.016, 10), flameMat);
  flame.position.set(-0.022, 0.024, 0);
  group.add(flame);

  const wisps = makeWisps(26, 0.05, 0.08);
  wisps.points.position.set(-0.022, 0.016, 0);
  group.add(wisps.points);

  const setProgress = (raw: number) => {
    const t = ease(THREE.MathUtils.clamp(raw, 0, 1));
    knob.rotation.z = lerp(-1.1, 0, t);
    (knob.material as THREE.MeshStandardMaterial).color.setHex(
      t > 0.5 ? 0xf0eae2 : 0xffd9c9,
    );
    flame.scale.setScalar(lerp(1, 0.001, t));
    flame.visible = t < 0.9;
  };

  setProgress(0);

  return {
    group,
    setProgress,
    focusHeight: 0.06,
    update: (time, progress) => {
      wisps.update(time, progress);
      const flicker = 0.85 + Math.sin(time * 18) * 0.12;
      flameMat.opacity = 0.8 * flicker * (1 - progress);
      flame.scale.y = (1 - progress) * (0.9 + Math.sin(time * 14) * 0.15);
    },
  };
}

/* ------------------------------------------------------------- gas hose -- */
function buildHose(): PropVisual {
  const group = new THREE.Group();
  const hoseMat = soft(0xd9a44f);
  const clampMat = soft(0x8d939c, { metalness: 0.5, roughness: 0.4 });

  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.045, 0.006, 0),
    new THREE.Vector3(-0.02, 0.02, 0.008),
    new THREE.Vector3(0.012, 0.014, -0.004),
    new THREE.Vector3(0.04, 0.008, 0),
  ]);
  const hose = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 30, 0.005, 8, false),
    hoseMat,
  );
  hose.castShadow = true;
  group.add(hose);

  const connector = cyl(0.007, 0.007, 0.012, clampMat, 10);
  connector.rotation.z = Math.PI / 2;
  connector.position.set(0.042, 0.008, 0);
  group.add(connector);

  const wisps = makeWisps(18, 0.03, 0.05);
  wisps.points.position.set(0.04, 0.01, 0);
  group.add(wisps.points);

  const setProgress = (raw: number) => {
    const t = ease(THREE.MathUtils.clamp(raw, 0, 1));
    hose.position.x = lerp(-0.006, 0, t);
    hose.rotation.z = lerp(0.12, 0, t);
    connector.scale.setScalar(lerp(0.94, 1, t));
  };

  setProgress(0);

  return {
    group,
    setProgress,
    focusHeight: 0.04,
    update: (time, progress) => {
      wisps.update(time, progress);
      hose.position.y = Math.sin(time * 5) * 0.0012 * (1 - progress);
    },
  };
}

/* -------------------------------------------------------------- gas can -- */
function buildCan(): PropVisual {
  const group = new THREE.Group();
  const canMat = soft(0xe8e2d6, { metalness: 0.35, roughness: 0.45 });
  const bandMat = soft(0xe0705f);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xffe9b8,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const can = new THREE.Group();
  const body = cyl(0.009, 0.009, 0.036, canMat, 14);
  body.position.y = 0.018;
  const band = cyl(0.0093, 0.0093, 0.008, bandMat, 14);
  band.position.y = 0.022;
  const nozzle = cyl(0.004, 0.005, 0.005, canMat, 10);
  nozzle.position.y = 0.038;
  can.add(body, band, nozzle);
  group.add(can);

  const beam = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.14, 12, 1, true), beamMat);
  beam.position.set(0, 0.07, 0);
  beam.rotation.z = 0.2;
  group.add(beam);

  const heat = new THREE.Mesh(
    new THREE.RingGeometry(0.012, 0.02, 20),
    new THREE.MeshBasicMaterial({
      color: 0xff9e7a,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  heat.rotation.x = -Math.PI / 2;
  heat.position.y = 0.002;
  group.add(heat);

  const setProgress = (raw: number) => {
    const t = ease(THREE.MathUtils.clamp(raw, 0, 1));
    can.position.set(lerp(0, -0.055, t), 0, lerp(0, 0.03, t));
    can.rotation.z = lerp(0.22, 0, t);
    (heat.material as THREE.Material).opacity = 0.35 * (1 - t);
    heat.visible = t < 0.95;
  };

  setProgress(0);

  return {
    group,
    setProgress,
    focusHeight: 0.05,
    update: (time, progress) => {
      heat.scale.setScalar(1 + Math.sin(time * 2.4) * 0.12);
      beamMat.opacity = 0.18 + Math.sin(time * 0.9) * 0.04;
      can.position.y = progress > 0.9 ? 0 : Math.sin(time * 3) * 0.0008;
    },
  };
}

/* ---------------------------------------------------------------- alarm -- */
function buildAlarm(): PropVisual {
  const group = new THREE.Group();
  const caseMat = soft(0xf4efe6);
  const ledMat = new THREE.MeshBasicMaterial({ color: 0xff5d4a });

  const body = box(0.03, 0.022, 0.008, caseMat);
  body.position.y = 0.011;
  group.add(body);

  const grille = box(0.02, 0.004, 0.001, soft(0xd9d2c6));
  grille.position.set(0, 0.008, 0.0045);
  group.add(grille);

  const led = new THREE.Mesh(new THREE.CircleGeometry(0.0028, 12), ledMat);
  led.position.set(0.009, 0.017, 0.0046);
  group.add(led);

  const glow = new THREE.PointLight(0xff5d4a, 0.02, 0.09);
  glow.position.set(0.009, 0.017, 0.012);
  group.add(glow);

  const setProgress = (raw: number) => {
    const t = ease(THREE.MathUtils.clamp(raw, 0, 1));
    ledMat.color.setHex(t > 0.5 ? 0x63c98a : 0xff5d4a);
    glow.color.setHex(t > 0.5 ? 0x63c98a : 0xff5d4a);
  };

  setProgress(0);

  return {
    group,
    setProgress,
    focusHeight: 0.03,
    update: (time, progress) => {
      const blink = progress > 0.5 ? 1 : Math.sin(time * 6) > 0 ? 1 : 0.15;
      ledMat.opacity = blink;
      ledMat.transparent = true;
      glow.intensity = 0.02 * blink;
    },
  };
}

const BUILDERS: Record<string, () => PropVisual> = {
  plant: buildPlant,
  yarn: buildYarn,
  curtain: buildCurtain,
  desk: buildDesk,
  gas_stove: buildStove,
  gas_hose: buildHose,
  gas_can: buildCan,
  alarm: buildAlarm,
};

export function buildProp(id: string): PropVisual {
  const builder = BUILDERS[id];
  if (builder) return builder();
  // Fallback so an unknown id never crashes the scene.
  const group = new THREE.Group();
  const mesh = ball(0.015, soft(0xcccccc));
  mesh.position.y = 0.015;
  group.add(mesh);
  return {
    group,
    setProgress: () => {},
    update: () => {},
    focusHeight: 0.04,
  };
}

/* -------------------------------------------------------------- markers -- */
export function buildMarker(kind: 'tidy' | 'gas' | 'golden'): THREE.Group {
  const color =
    kind === 'golden'
      ? PALETTE.goldMarker
      : kind === 'gas'
        ? PALETTE.gasMarker
        : PALETTE.tidyMarker;
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: kind === 'golden' ? 0.85 : 0.45,
    roughness: 0.4,
    metalness: 0.1,
  });
  const group = new THREE.Group();

  // A floating paw silhouette: one soft pad and four smaller toes. It lies
  // horizontally so it reads clearly from the fixed 3/4 camera.
  const pad = ball(0.014, material, 14);
  pad.scale.set(1.15, 0.28, 1.35);
  pad.position.z = 0.004;
  group.add(pad);

  const toeOffsets = [
    [-0.014, -0.009, 0.004],
    [-0.005, -0.015, 0.004],
    [0.005, -0.015, 0.004],
    [0.014, -0.009, 0.004],
  ] as const;
  for (const [x, z, y] of toeOffsets) {
    const toe = ball(0.0055, material, 12);
    toe.scale.set(0.9, 0.28, 1.1);
    toe.position.set(x, y, z);
    group.add(toe);
  }

  group.scale.setScalar(kind === 'golden' ? 1.35 : 1);
  return group;
}

/* ------------------------------------------------------------- sticker -- */
export function buildSticker(): THREE.Group {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: PALETTE.sticker,
    emissive: PALETTE.sticker,
    emissiveIntensity: 0.5,
    roughness: 0.5,
  });
  const pad = new THREE.Mesh(new THREE.CircleGeometry(0.008, 16), material);
  group.add(pad);
  for (let i = 0; i < 4; i += 1) {
    const toe = new THREE.Mesh(new THREE.CircleGeometry(0.0032, 12), material);
    const angle = -Math.PI * 0.15 - (i / 3) * Math.PI * 0.7;
    toe.position.set(Math.cos(angle) * 0.011, Math.sin(angle) * 0.011 + 0.004, 0);
    group.add(toe);
  }
  group.rotation.x = -Math.PI / 2;
  return group;
}
