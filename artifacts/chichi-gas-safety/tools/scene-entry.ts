/**
 * Dumps the real game scene as world-space triangles so the offline
 * previewer can rasterise it without WebGL.
 *
 * Run through tsx (see tools/preview.mjs); three.js itself works fine in
 * Node as long as nothing touches WebGLRenderer.
 *
 *   npx tsx tools/scene-entry.ts > /tmp/scene.json
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { KNOCK_DEFS, SPAWN, STICKER_SPOTS, TUNING } from '../src/game/config';
import { Cat } from '../src/game/cat';
import { buildMarker, buildProp, buildSticker } from '../src/game/props';
import { buildRoom } from '../src/game/room';

const report: [string, THREE.Object3D][] = [];
const scene = new THREE.Scene();
scene.add(buildRoom());

for (const def of KNOCK_DEFS) {
  const visual = buildProp(def.id);
  if (def.scale) visual.group.scale.setScalar(def.scale);
  const root = new THREE.Group();
  root.add(visual.group);
  root.position.set(def.x, def.y, def.z);
  root.rotation.y = def.rot;
  const marker = buildMarker(def.kind);
  marker.position.set(0, visual.focusHeight * (def.scale ?? 1) + 0.03, 0);
  root.add(marker);
  scene.add(root);
  report.push([def.id, visual.group]); // measured without the floating marker
}

for (const spot of STICKER_SPOTS) {
  const sticker = buildSticker();
  sticker.position.set(spot.x, 0.03, spot.z);
  scene.add(sticker);
}

// three's GLTFLoader needs browser APIs to decode textures, so strip them
// first: only the geometry matters for a placement check.
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const catDoc = await io.read('public/models/cat.glb');
for (const texture of catDoc.getRoot().listTextures()) texture.dispose();
const catBin = await io.writeBinary(catDoc);
const gltf = await new Promise<any>((resolve, reject) => {
  new GLTFLoader().parse(
    catBin.buffer.slice(
      catBin.byteOffset,
      catBin.byteOffset + catBin.byteLength,
    ) as ArrayBuffer,
    '',
    resolve,
    reject,
  );
});
const cat = new Cat(gltf);
cat.position.set(SPAWN.x, TUNING.floorY + TUNING.catBaseY, SPAWN.z);
cat.setFacing(Math.PI * 0.5);
cat.update(0.016, 0, 0);
scene.add(cat.root);
report.push(['cat', cat.root]);

/* ------------------------------------------------- triangle extraction -- */

scene.updateMatrixWorld(true);

// 1 unit = 4 m, so sizes are reported in cm to keep them intuitive.
const cm = (n: number) => `${Math.round(n * 400)}cm`;
process.stderr.write('\nname          size (w x h x d)          floor y\n');
for (const [name, object] of report) {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) {
    process.stderr.write(`${name.padEnd(13)} EMPTY (nothing rendered)\n`);
    continue;
  }
  const size = box.getSize(new THREE.Vector3());
  process.stderr.write(
    `${name.padEnd(13)} ${`${cm(size.x)} x ${cm(size.y)} x ${cm(size.z)}`.padEnd(25)} ${box.min.y.toFixed(3)}\n`,
  );
}
process.stderr.write('\n');
const positions: number[] = [];
const colors: number[] = [];
const a = new THREE.Vector3();
const b = new THREE.Vector3();
const c = new THREE.Vector3();

scene.traverse((object) => {
  const mesh = object as THREE.Mesh;
  if (!(mesh as THREE.Mesh).isMesh) return;
  const geo = mesh.geometry;
  const pos = geo.getAttribute('position');
  if (!pos) return;
  const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  const colour = (material as THREE.MeshStandardMaterial).color?.getHex() ?? 0xcccccc;
  const index = geo.getIndex();
  const count = index ? index.count : pos.count;

  for (let i = 0; i < count; i += 3) {
    const i0 = index ? index.getX(i) : i;
    const i1 = index ? index.getX(i + 1) : i + 1;
    const i2 = index ? index.getX(i + 2) : i + 2;
    a.fromBufferAttribute(pos, i0).applyMatrix4(mesh.matrixWorld);
    b.fromBufferAttribute(pos, i1).applyMatrix4(mesh.matrixWorld);
    c.fromBufferAttribute(pos, i2).applyMatrix4(mesh.matrixWorld);
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    colors.push(colour);
  }
});

process.stdout.write(JSON.stringify({ positions, colors }));
