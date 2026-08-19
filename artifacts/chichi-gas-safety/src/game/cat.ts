import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { TUNING } from './config';

/**
 * 치치 — the playable tuxedo cat. Wraps the imported rig: normalises scale and
 * orientation, drives the single baked walk clip, and layers procedural
 * secondary motion (tail sway, breathing, paw swipe) on top of it.
 */
export class Cat {
  readonly root = new THREE.Group();
  private readonly pivot = new THREE.Group();
  private readonly visualBounds = new THREE.Box3();
  private readonly mixer: THREE.AnimationMixer;
  private readonly walk: THREE.AnimationAction | null;
  private readonly tailBones: THREE.Object3D[] = [];
  private headBone: THREE.Object3D | null = null;
  private frontLeg: THREE.Object3D | null = null;

  /** Current facing in radians (Y axis). */
  private facing = 0;
  private walkBlend = 0;
  private swipeTime = -1;
  private restPoses = new Map<THREE.Object3D, THREE.Quaternion>();

  constructor(gltf: GLTF) {
    const model = gltf.scene;

    // Some exports (Unreal takes) come in Z-up: stand the cat on the floor.
    const rawBox = new THREE.Box3().setFromObject(model);
    const rawSize = rawBox.getSize(new THREE.Vector3());
    if (rawSize.z > rawSize.y * 1.15) {
      model.rotation.x = -Math.PI / 2;
      model.updateMatrixWorld(true);
    }

    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const scale = TUNING.catSize / Math.max(size.x, size.y, size.z);
    model.scale.multiplyScalar(scale);
    model.updateMatrixWorld(true);

    // Keep the walkable body width unchanged, but raise the visual height to
    // the requested target. Scaling only Y avoids widening the cat collider
    // and blocking the carefully-authored room paths.
    const uniform = new THREE.Box3().setFromObject(model);
    const uniformHeight = uniform.getSize(new THREE.Vector3()).y;
    if (uniformHeight > 1e-6) {
      model.scale.y *= TUNING.catHeight / uniformHeight;
      model.updateMatrixWorld(true);
    }

    // Re-centre the taller model on the floor at the origin.
    const scaled = new THREE.Box3().setFromObject(model);
    const centre = scaled.getCenter(new THREE.Vector3());
    model.position.x -= centre.x;
    model.position.z -= centre.z;
    model.position.y -= scaled.min.y;

    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.SkinnedMesh;
        mesh.castShadow = true;
        mesh.receiveShadow = false;
        mesh.frustumCulled = false;
      }
      const name = child.name.toLowerCase();
      if (name.startsWith('tail')) this.tailBones.push(child);
      if (!this.headBone && name === 'head') this.headBone = child;
      if (!this.frontLeg && /frontleg/.test(name)) this.frontLeg = child;
    });

    for (const bone of [...this.tailBones, this.headBone, this.frontLeg]) {
      if (bone) this.restPoses.set(bone, bone.quaternion.clone());
    }

    this.pivot.add(model);
    this.root.add(this.pivot);

    this.mixer = new THREE.AnimationMixer(model);
    const clip = gltf.animations[0] ?? null;
    if (clip) {
      // The rig ships non-uniform scale tracks that make the cat balloon.
      clip.tracks = clip.tracks.filter((track) => !track.name.endsWith('.scale'));
      this.walk = this.mixer.clipAction(clip);
      this.walk.play();
      this.walk.setEffectiveWeight(1);
      this.walk.timeScale = 1;
    } else {
      this.walk = null;
    }
  }

  /**
   * The imported walk animation moves the paw vertices a little lower than
   * the bind pose. Keep the rendered model on the root's floor plane after
   * animation, bobbing, turning and cinematic paw swipes have all been
   * applied. The gameplay root remains at floor level; only the visual pivot
   * receives this corrective lift.
   */
  private keepPawsAboveFloor(): void {
    this.root.updateMatrixWorld(true);
    this.visualBounds.setFromObject(this.pivot);
    const floor = this.root.position.y + TUNING.catFloorClearance;
    if (this.visualBounds.min.y < floor) {
      this.pivot.position.y += floor - this.visualBounds.min.y;
    }
  }

  get position(): THREE.Vector3 {
    return this.root.position;
  }

  /** Heading of the local-z body axis, used by the rotated collision box. */
  get colliderHeading(): number {
    return this.facing;
  }

  setFacing(angle: number): void {
    this.facing = angle;
    this.pivot.rotation.y = angle;
  }

  faceTowards(x: number, z: number, dt: number, snap = false): void {
    const dx = x - this.root.position.x;
    const dz = z - this.root.position.z;
    if (Math.abs(dx) < 1e-6 && Math.abs(dz) < 1e-6) return;
    const target = Math.atan2(dx, dz);
    if (snap) {
      this.setFacing(target);
      return;
    }
    let delta = target - this.facing;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    this.setFacing(this.facing + delta * Math.min(1, dt * 12));
  }

  /** Trigger the little front-paw tap used in cinematics. */
  swipe(): void {
    this.swipeTime = 0;
  }

  update(dt: number, speed01: number, elapsed: number): void {
    this.walkBlend += (speed01 - this.walkBlend) * Math.min(1, dt * 10);

    if (this.walk) {
      // Idle: hold a near-still pose; moving: play the walk at speed.
      this.walk.timeScale = 0.12 + this.walkBlend * 1.35;
    }
    this.mixer.update(dt);

    // Secondary motion, applied after the mixer writes the baked pose.
    const bob = Math.sin(elapsed * 2.2) * 0.0015 * (1 - this.walkBlend);
    this.pivot.position.y = bob;

    this.tailBones.forEach((bone, index) => {
      const rest = this.restPoses.get(bone);
      if (!rest) return;
      const amount = 0.16 + index * 0.06;
      const sway = Math.sin(elapsed * (1.6 + index * 0.35)) * amount;
      const twist = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0, sway * 0.6, sway),
      );
      bone.quaternion.copy(rest).multiply(twist);
    });

    if (this.headBone) {
      const rest = this.restPoses.get(this.headBone);
      if (rest) {
        const nod = Math.sin(elapsed * 1.1) * 0.05 * (1 - this.walkBlend);
        this.headBone.quaternion
          .copy(rest)
          .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(nod, 0, 0)));
      }
    }

    if (this.swipeTime >= 0) {
      this.swipeTime += dt;
      const t = this.swipeTime / 0.6;
      if (t >= 1) {
        this.swipeTime = -1;
      } else if (this.frontLeg) {
        const rest = this.restPoses.get(this.frontLeg);
        if (rest) {
          const arc = Math.sin(t * Math.PI) * 0.9;
          this.frontLeg.quaternion
            .copy(rest)
            .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-arc, 0, 0)));
        }
      }
      // Whole-body lean into the tap.
      const lean = Math.sin(Math.min(1, t) * Math.PI) * 0.12;
      this.pivot.rotation.x = -lean;
    } else {
      this.pivot.rotation.x *= 1 - Math.min(1, dt * 8);
    }

    this.keepPawsAboveFloor();
  }
}
