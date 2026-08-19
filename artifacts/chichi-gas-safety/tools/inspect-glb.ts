/** Structural summary of a GLB: nodes, meshes, materials, sizes. */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const file = process.argv[2];
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(file);
const root = doc.getRoot();
console.log('extensions', doc.getRoot().listExtensionsUsed().map((e) => e.extensionName));
console.log('meshes', root.listMeshes().length, 'materials', root.listMaterials().length, 'textures', root.listTextures().length, 'nodes', root.listNodes().length);
let tris = 0;
for (const mesh of root.listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const idx = prim.getIndices();
    const count = idx ? idx.getCount() : prim.getAttribute('POSITION')!.getCount();
    tris += count / 3;
  }
}
console.log('triangles', Math.round(tris));
for (const node of root.listNodes().slice(0, 40)) {
  const mesh = node.getMesh();
  if (!mesh) continue;
  const prim = mesh.listPrimitives()[0];
  const pos = prim.getAttribute('POSITION')!;
  console.log(
    '-', JSON.stringify(node.getName() || mesh.getName()),
    'mat', mesh.listPrimitives().map((p) => p.getMaterial()?.getName()).join(','),
    'min', pos.getMinNormalized([]).map((n) => n.toFixed(2)).join(','),
    'max', pos.getMaxNormalized([]).map((n) => n.toFixed(2)).join(','),
  );
}
