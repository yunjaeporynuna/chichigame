/** Diagnostic: where does the cat model's geometry go wrong in Node? */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read('public/models/cat.glb');
for (const mesh of doc.getRoot().listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION')!;
    console.log(
      'prim',
      mesh.getName(),
      'type',
      pos.getComponentType(),
      'normalized',
      pos.getNormalized(),
      'min',
      pos.getMinNormalized([]),
      'max',
      pos.getMaxNormalized([]),
    );
  }
}
for (const node of doc.getRoot().listNodes()) {
  if (node.getMesh()) console.log('node', node.getName(), 'scale', node.getScale(), 'trs', node.getTranslation());
}

for (const texture of doc.getRoot().listTextures()) texture.dispose();
const bin = await io.writeBinary(doc);
const gltf = await new Promise<any>((resolve, reject) => {
  new GLTFLoader().parse(bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength) as ArrayBuffer, '', resolve, reject);
});
gltf.scene.updateMatrixWorld(true);
const box = new THREE.Box3().setFromObject(gltf.scene);
console.log('three bbox min', box.min.toArray(), 'max', box.max.toArray());
gltf.scene.traverse((o: any) => {
  if (o.isMesh || o.isSkinnedMesh) {
    const p = o.geometry.getAttribute('position');
    console.log('mesh', o.name, o.isSkinnedMesh ? 'skinned' : 'static', 'count', p.count, 'first', p.getX(0), p.getY(0), p.getZ(0), 'itemSize/type', p.array.constructor.name, 'normalized', p.normalized, 'worldScale', o.getWorldScale(new THREE.Vector3()).toArray());
  }
});
