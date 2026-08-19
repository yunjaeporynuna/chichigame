import * as THREE from 'three';

import { ROOM, type RoomPart } from './room-layout';

/**
 * Turns the authored room data into meshes. Boxes are optionally rounded,
 * which is most of what makes the room read as soft and toy-like rather than
 * as a pile of cubes.
 *
 * Geometries and materials are shared within a single build and owned by the
 * group it returns, so disposing one room never touches another's resources.
 */

function roundedBoxGeometry(
  w: number,
  h: number,
  d: number,
  r: number,
): THREE.BufferGeometry {
  const rad = Math.min(r, w / 2 - 0.0005, h / 2 - 0.0005, d / 2 - 0.0005);
  if (rad <= 0.0005) return new THREE.BoxGeometry(w, h, d);

  const shape = new THREE.Shape();
  shape.moveTo(-w / 2 + rad, -h / 2);
  shape.lineTo(w / 2 - rad, -h / 2);
  shape.absarc(w / 2 - rad, -h / 2 + rad, rad, -Math.PI / 2, 0, false);
  shape.lineTo(w / 2, h / 2 - rad);
  shape.absarc(w / 2 - rad, h / 2 - rad, rad, 0, Math.PI / 2, false);
  shape.lineTo(-w / 2 + rad, h / 2);
  shape.absarc(-w / 2 + rad, h / 2 - rad, rad, Math.PI / 2, Math.PI, false);
  shape.lineTo(-w / 2, -h / 2 + rad);
  shape.absarc(-w / 2 + rad, -h / 2 + rad, rad, Math.PI, Math.PI * 1.5, false);

  const bevel = Math.min(rad * 0.6, d / 2 - 0.0005);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: d - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 3,
  });
  geo.translate(0, 0, -d / 2 + bevel);
  geo.computeVertexNormals();
  return geo;
}

function geometryFor(
  part: RoomPart,
  cache: Map<string, THREE.BufferGeometry>,
): THREE.BufferGeometry {
  const [a, b, c] = part.size;
  const key = `${part.shape}:${a}:${b}:${c}:${part.round ?? 0}`;
  let geo = cache.get(key);
  if (!geo) {
    if (part.shape === 'box') {
      geo = part.round
        ? roundedBoxGeometry(a, b, c, part.round)
        : new THREE.BoxGeometry(a, b, c);
    } else if (part.shape === 'cyl') {
      geo = new THREE.CylinderGeometry(a, c, b, 16);
    } else {
      geo = new THREE.SphereGeometry(a, 18, 12);
    }
    cache.set(key, geo);
  }
  return geo;
}

export function buildRoom(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'room';

  const geometries = new Map<string, THREE.BufferGeometry>();
  const materials = new Map<string, THREE.MeshStandardMaterial>();

  for (const part of ROOM.parts) {
    const rough = part.rough ?? 0.85;
    const matKey = `${part.color}:${rough}`;
    let mat = materials.get(matKey);
    if (!mat) {
      mat = new THREE.MeshStandardMaterial({
        color: part.color,
        roughness: rough,
        metalness: 0.02,
        envMapIntensity: 0.7,
      });
      materials.set(matKey, mat);
    }

    const mesh = new THREE.Mesh(geometryFor(part, geometries), mat);
    mesh.position.set(part.pos[0], part.pos[1], part.pos[2]);
    if (part.rot) mesh.rotation.set(part.rot[0], part.rot[1], part.rot[2]);
    mesh.castShadow = !part.flat;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // Soft apron under the room so the floor never ends in the void.
  const apronGeo = new THREE.CircleGeometry(
    Math.max(ROOM.extentX, ROOM.extentZ) * 0.85,
    40,
  );
  const apronMat = new THREE.MeshStandardMaterial({ color: 0xe6cdb4, roughness: 0.95 });
  const apron = new THREE.Mesh(apronGeo, apronMat);
  apron.rotation.x = -Math.PI / 2;
  apron.position.y = -0.02;
  apron.receiveShadow = true;
  group.add(apron);

  geometries.set('apron', apronGeo);
  materials.set('apron', apronMat);
  group.userData.dispose = () => {
    for (const geo of geometries.values()) geo.dispose();
    for (const mat of materials.values()) mat.dispose();
    geometries.clear();
    materials.clear();
  };

  return group;
}

/** Releases the GPU resources owned by a group returned from buildRoom(). */
export function disposeRoom(group: THREE.Group | null | undefined): void {
  const dispose = group?.userData?.dispose;
  if (typeof dispose === 'function') dispose();
}
