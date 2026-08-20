import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { audio } from './audio';
import { Cat } from './cat';
import {
  asset,
  SPAWN,
  KNOCK_DEFS,
  PALETTE,
  STICKER_SPOTS,
  TUNING,
  type CutOption,
  type KnockDef,
} from './config';
import { buildMarker, buildProp, buildSticker, type PropVisual } from './props';
import { ROOM } from './room-layout';
import type { Rect } from './room-layout';
import { buildRoom, disposeRoom } from './room';
import { mulberry32, weightedPick } from './rng';
import {
  getState,
  persistBestScore,
  persistSettings,
  registerActions,
  setState,
} from './store';
import { STR } from './strings';
import type { Phase, ScorePop } from './types';

interface PropRuntime {
  def: KnockDef;
  visual: PropVisual;
  root: THREE.Group;
  worldPos: THREE.Vector3;
  /** Floor-level spot the cat can actually stand on to reach this prop. */
  anchor: THREE.Vector3;
  marker: THREE.Object3D;
  solved: boolean;
  progress: number;
  target: number;
}

interface Shot {
  time: number;
  pos: THREE.Vector3;
  look: THREE.Vector3;
}

interface Cutscene {
  kind: 'intro' | 'object' | 'ending';
  id: string;
  title: string;
  captions: string[];
  video?: string;
  duration: number;
  t: number;
  shots: Shot[];
  prop?: PropRuntime;
  option?: CutOption;
  catFrom?: THREE.Vector3;
  catTo?: THREE.Vector3;
  didAction: boolean;
}

interface Jump {
  prop: PropRuntime | null;
  elapsed: number;
  touched: boolean;
}

/**
 * Everything solid the cat bumps into: the room's furniture footprints plus
 * every prop that declares one, so a knocked-over plant or the low table stops
 * the cat instead of letting it walk through.
 */
const COLLIDERS: Rect[] = [
  ...ROOM.colliders,
  ...KNOCK_DEFS.filter((def) => def.block).map((def) => ({
    x0: def.x - def.block![0],
    x1: def.x + def.block![0],
    z0: def.z - def.block![1],
    z1: def.z + def.block![1],
  })),
];

const CAT_LOCAL_HALF_X = TUNING.catCollider.halfX;
const CAT_LOCAL_HALF_Z = TUNING.catCollider.halfZ;

/**
 * SAT overlap test between the cat's rotated body box and an axis-aligned
 * furniture/prop box. A centre-point or tiny-radius test lets the long cat
 * mesh visibly clip through sofas and tables; this uses the whole body.
 */
function overlapsCat(rect: Rect, x: number, z: number, heading: number): boolean {
  const rectX = (rect.x0 + rect.x1) * 0.5;
  const rectZ = (rect.z0 + rect.z1) * 0.5;
  const rectHalfX = (rect.x1 - rect.x0) * 0.5;
  const rectHalfZ = (rect.z1 - rect.z0) * 0.5;
  const dx = x - rectX;
  const dz = z - rectZ;

  // Pivot Y rotation turns model-local x and z onto these floor-plane axes.
  const ux = Math.cos(heading);
  const uz = -Math.sin(heading);
  const vx = Math.sin(heading);
  const vz = Math.cos(heading);

  // Test the world x/z axes and both cat-box axes (separating axis theorem).
  if (
    Math.abs(dx) >
      rectHalfX + CAT_LOCAL_HALF_X * Math.abs(ux) + CAT_LOCAL_HALF_Z * Math.abs(vx)
  ) {
    return false;
  }
  if (
    Math.abs(dz) >
      rectHalfZ + CAT_LOCAL_HALF_X * Math.abs(uz) + CAT_LOCAL_HALF_Z * Math.abs(vz)
  ) {
    return false;
  }
  if (
    Math.abs(dx * ux + dz * uz) >
      CAT_LOCAL_HALF_X + rectHalfX * Math.abs(ux) + rectHalfZ * Math.abs(uz)
  ) {
    return false;
  }
  return (
    Math.abs(dx * vx + dz * vz) <=
    CAT_LOCAL_HALF_Z + rectHalfX * Math.abs(vx) + rectHalfZ * Math.abs(vz)
  );
}

function catWorldHalfExtents(heading: number): { x: number; z: number } {
  return {
    x:
      CAT_LOCAL_HALF_X * Math.abs(Math.cos(heading)) +
      CAT_LOCAL_HALF_Z * Math.abs(Math.sin(heading)),
    z:
      CAT_LOCAL_HALF_X * Math.abs(Math.sin(heading)) +
      CAT_LOCAL_HALF_Z * Math.abs(Math.cos(heading)),
  };
}

const easeInOut = (t: number) => t * t * (3 - 2 * t);
const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

export class Game {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(36, 1, 0.01, 40);
  private readonly clock = new THREE.Clock();

  private cat: Cat | null = null;
  private roomGroup: THREE.Group | null = null;
  private readonly props: PropRuntime[] = [];
  private readonly stickers: { mesh: THREE.Group; taken: boolean }[] = [];

  private extentX = 1;
  private extentZ = 1;
  /** Walkable floor plane of the room model (it stands on a plinth). */
  private readonly floorY = TUNING.floorY;
  private readonly catBaseY = TUNING.floorY + TUNING.catBaseY;
  private roomHeight = 0.6;

  private readonly camPos = new THREE.Vector3();
  private readonly camLook = new THREE.Vector3();
  private readonly baseCamPos = new THREE.Vector3();
  private readonly baseCamLook = new THREE.Vector3();
  private fitRadius = 0.8;

  private phase: Phase = 'loading';
  private elapsed = 0;
  private timeLeft: number = TUNING.roundTime;
  private score = 0;
  private combo = 1;
  private bestCombo = 1;
  private comboTimer = 0;
  private events = 0;
  private readonly badges = new Set<string>();
  private guardian = false;
  private stickersTaken = 0;
  private goldenLeft = 0;
  private goldenTargetId: string | null = null;
  private cutscene: Cutscene | null = null;
  private jump: Jump | null = null;
  private lastSpacePressAt = -Infinity;
  private pendingChoice: PropRuntime | null = null;
  private finTimer = 0;
  private syncAccum = 0;
  private popId = 0;
  private pops: (ScorePop & { life: number })[] = [];
  private toastLife = 0;
  private rand = mulberry32(TUNING.seed);

  private readonly keys = new Set<string>();
  private joystickId: number | null = null;
  private readonly joyStart = new THREE.Vector2();
  private readonly joyVec = new THREE.Vector2();
  private readonly moveDir = new THREE.Vector2();

  private disposed = false;
  private frameHandle = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, TUNING.dprCap));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.localClippingEnabled = true;
    this.scene.background = new THREE.Color(0x1b1420);
    this.scene.fog = new THREE.Fog(0x241a26, 2.2, 5.5);
  }

  /* ------------------------------------------------------------- boot -- */

  async init(): Promise<void> {
    const manager = new THREE.LoadingManager();
    manager.onProgress = (_url, loaded, total) => {
      setState({ loadProgress: total > 0 ? clamp(loaded / total, 0, 0.95) : 0.2 });
    };
    const loader = new GLTFLoader(manager);

    try {
      const catGltf = await loader.loadAsync(asset('models/cat.glb'));
      if (this.disposed) return;

      this.setupRoom();
      this.cat = new Cat(catGltf);
      this.scene.add(this.cat.root);
      this.setupLights();
      this.layoutProps();
      this.layoutStickers();
      this.resetRound(true);
      this.resize();

      setState({ loadProgress: 1 });
      this.setPhase('title');
      audio.setMood('menu');
    } catch (error) {
      console.error('[chichi] asset load failed', error);
      setState({ loadError: STR.loadError });
      return;
    }

    this.bindInput();
    this.bindActions();
    this.clock.start();
    this.loop();
  }

  private setupRoom(): void {
    const group = buildRoom();
    this.extentX = ROOM.extentX;
    this.extentZ = ROOM.extentZ;
    this.roomHeight = ROOM.wallHeight;
    this.roomGroup = group;
    this.scene.add(group);
  }

  private setupLights(): void {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;

    const ambient = new THREE.HemisphereLight(0xffe9d2, 0x50414d, 0.55);
    this.scene.add(ambient);

    const key = new THREE.DirectionalLight(PALETTE.warmLight, 2.1);
    key.position.set(0.55, 0.9, 0.5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0012;
    key.shadow.normalBias = 0.006;
    const shadowSize = Math.max(this.extentX, this.extentZ) * 0.75;
    const cam = key.shadow.camera;
    cam.left = -shadowSize;
    cam.right = shadowSize;
    cam.top = shadowSize;
    cam.bottom = -shadowSize;
    cam.near = 0.05;
    cam.far = 4;
    cam.updateProjectionMatrix();
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(PALETTE.coolFill, 0.5);
    fill.position.set(-0.7, 0.5, -0.6);
    this.scene.add(fill);

    const bounce = new THREE.PointLight(0xffd7b0, 0.35, 1.6);
    bounce.position.set(0, this.roomHeight * 0.35, 0);
    this.scene.add(bounce);
  }

  private layoutProps(): void {
    for (const def of KNOCK_DEFS) {
      const visual = buildProp(def.id);
      if (def.scale) visual.group.scale.setScalar(def.scale);
      const root = new THREE.Group();
      root.add(visual.group);
      root.position.set(
        def.x,
        this.floorY + def.y,
        def.z,
      );
      root.rotation.y = def.rot;
      this.scene.add(root);

      const marker = buildMarker(def.kind);
      marker.position.set(0, visual.focusHeight * (def.scale ?? 1) + 0.03, 0);
      root.add(marker);

      this.props.push({
        def,
        visual,
        root,
        worldPos: root.position.clone(),
        anchor: this.nearestStandable(
          def.x,
          def.z,
        ),
        marker,
        solved: false,
        progress: 0,
        target: 0,
      });
    }
  }

  private layoutStickers(): void {
    for (const spot of STICKER_SPOTS) {
      const mesh = buildSticker();
      mesh.position.set(
        spot.x,
        this.floorY + 0.03,
        spot.z,
      );
      this.scene.add(mesh);
      this.stickers.push({ mesh, taken: false });
    }
  }

  /* ------------------------------------------------------------ input -- */

  private bindInput(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('resize', this.onResize);
    window.addEventListener('orientationchange', this.onResize);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);

    const isTouch =
      'ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0;
    setState({ isTouch });
  }

  private onKeyDown = (event: KeyboardEvent) => {
    audio.resume();
    this.keys.add(event.code);
    if (event.code === 'Space') {
      event.preventDefault();
      console.info('[chichi] SPACE pressed', {
        repeat: event.repeat,
        phase: this.phase,
        target: this.nearestProp()?.def.id ?? null,
      });
      if (!event.repeat) this.handleSpacePress();
      return;
    }
    if (event.code === 'KeyE') {
      this.tryInteract();
    }
    if (event.code === 'Escape' && this.cutscene) this.skipCutscene();
    if (event.code === 'Enter' && this.phase === 'title') this.startGame();
  };

  private onKeyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.code);
  };

  private onResize = () => {
    this.resize();
  };

  private onPointerDown = (event: PointerEvent) => {
    audio.resume();
    if (this.phase !== 'playing') return;
    if (event.pointerType === 'touch') {
      if (event.clientX < window.innerWidth * 0.55 && this.joystickId === null) {
        this.joystickId = event.pointerId;
        this.joyStart.set(event.clientX, event.clientY);
        this.joyVec.set(0, 0);
        setState({
          joystick: {
            active: true,
            cx: event.clientX,
            cy: event.clientY,
            dx: 0,
            dy: 0,
          },
        });
      }
      return;
    }
    this.tryInteract();
  };

  private onPointerMove = (event: PointerEvent) => {
    if (this.joystickId !== event.pointerId) return;
    const dx = event.clientX - this.joyStart.x;
    const dy = event.clientY - this.joyStart.y;
    const radius = 48;
    const dead = 10;
    const len = Math.hypot(dx, dy);
    const clamped = Math.min(len, radius);
    const nx = len > 0 ? (dx / len) * clamped : 0;
    const ny = len > 0 ? (dy / len) * clamped : 0;
    this.joyVec.set(
      len > dead ? nx / radius : 0,
      len > dead ? ny / radius : 0,
    );
    setState({
      joystick: {
        active: true,
        cx: this.joyStart.x,
        cy: this.joyStart.y,
        dx: nx,
        dy: ny,
      },
    });
  };

  private onPointerUp = (event: PointerEvent) => {
    if (this.joystickId !== event.pointerId) return;
    this.joystickId = null;
    this.joyVec.set(0, 0);
    setState({ joystick: { active: false, cx: 0, cy: 0, dx: 0, dy: 0 } });
  };

  private bindActions(): void {
    registerActions({
      start: () => {
        audio.resume();
        this.startGame();
      },
      skip: () => this.skipCutscene(),
      choose: (optionId: string) => this.resolveChoice(optionId),
      toEnding: () => this.startEnding(),
      restart: () => {
        this.resetRound(true);
        this.setPhase('title');
        audio.setMood('menu');
        audio.duck(1, 0.6);
      },
      toTitle: () => {
        this.resetRound(true);
        this.setPhase('title');
        audio.setMood('menu');
        audio.duck(1, 0.6);
      },
      interact: () => this.tryInteract(),
      toggleBgm: () => {
        const settings = { ...getState().settings, bgm: !getState().settings.bgm };
        audio.setBgmEnabled(settings.bgm);
        persistSettings(settings);
        setState({ settings });
      },
      toggleSfx: () => {
        const settings = { ...getState().settings, sfx: !getState().settings.sfx };
        audio.setSfxEnabled(settings.sfx);
        persistSettings(settings);
        setState({ settings });
      },
      uiSound: (tone = 'tap') => {
        audio.resume();
        audio.play(tone === 'back' ? 'back' : tone === 'meow' ? 'meow' : 'chime');
      },
    });
  }

  /* ------------------------------------------------------------ round -- */

  private resetRound(hard: boolean): void {
    this.timeLeft = TUNING.roundTime;
    this.score = 0;
    this.combo = 1;
    this.bestCombo = 1;
    this.comboTimer = 0;
    this.events = 0;
    this.badges.clear();
    this.guardian = false;
    this.stickersTaken = 0;
    this.goldenLeft = 0;
    this.pops = [];
    this.toastLife = 0;
    this.cutscene = null;
    this.jump = null;
    this.lastSpacePressAt = -Infinity;
    this.pendingChoice = null;
    this.rand = mulberry32(TUNING.seed + (hard ? 0 : Math.floor(Math.random() * 999)));

    for (const prop of this.props) {
      prop.solved = false;
      prop.progress = 0;
      prop.target = 0;
      prop.visual.setProgress(0);
      prop.marker.visible = true;
    }
    for (const sticker of this.stickers) {
      sticker.taken = false;
      sticker.mesh.visible = true;
    }
    this.cat?.position.set(
      SPAWN.x,
      this.catBaseY,
      SPAWN.z,
    );
    this.cat?.setFacing(Math.PI * 0.5);
    this.pickGoldenTarget();

    setState({
      timeLeft: TUNING.roundTime,
      score: 0,
      combo: 1,
      comboFuel: 0,
      badges: 0,
      stickers: 0,
      stickerGoal: TUNING.stickerGoal,
      goldenTime: false,
      goldenLeft: 0,
      guardianBonus: false,
      prompt: null,
      warning: 0,
      scorePops: [],
      toast: null,
      cutscene: null,
      choice: null,
      result: null,
    });
  }

  private startGame(): void {
    if (this.phase !== 'title') return;
    this.resetRound(false);
    audio.startMusic();
    audio.setBgmEnabled(getState().settings.bgm);
    audio.setSfxEnabled(getState().settings.sfx);
    audio.setMood('menu');
    audio.duck(0.45, 0.8);
    this.startIntro();
  }

  private setPhase(phase: Phase): void {
    this.phase = phase;
    setState({ phase });
  }

  private pickGoldenTarget(): void {
    const candidates = this.props.filter((prop) => !prop.solved);
    if (candidates.length === 0) {
      this.goldenTargetId = null;
      return;
    }
    const late = this.timeLeft < TUNING.roundTime * 0.5;
    const chosen = weightedPick(this.rand, candidates, (prop) =>
      prop.def.id === 'gas_stove' && late ? 3 : 1,
    );
    this.goldenTargetId = chosen.def.id;
  }

  /* -------------------------------------------------------- cinematics -- */

  private startIntro(): void {
    const shots = this.introShots();
    this.cutscene = {
      kind: 'intro',
      id: 'intro',
      title: STR.title,
      captions: [...STR.introCaption],
      video: 'intro.mp4',
      duration: TUNING.introDuration,
      t: 0,
      shots,
      didAction: false,
    };
    this.setPhase('intro');
    this.publishCutscene();
    audio.play('whoosh', 0.7);
  }

  private introShots(): Shot[] {
    const kitchen = new THREE.Vector3(
      0.22 * this.extentX,
      this.floorY + 0.06,
      0.24 * this.extentZ,
    );
    const centre = new THREE.Vector3(0, this.floorY + 0.08, 0);
    const dir = new THREE.Vector3(1, 0.85, 1).normalize();
    return [
      {
        time: 0,
        pos: new THREE.Vector3(-0.55, 0.28, 0.9).multiplyScalar(this.fitRadius * 1.1),
        look: new THREE.Vector3(
          -0.15 * this.extentX,
          this.floorY + 0.1,
          -0.15 * this.extentZ,
        ),
      },
      {
        time: 0.45,
        pos: dir.clone().multiplyScalar(this.fitRadius * 1.5).setY(this.fitRadius * 0.8),
        look: centre,
      },
      {
        time: 1,
        pos: kitchen
          .clone()
          .add(new THREE.Vector3(0.22, 0.2, 0.24))
          .multiplyScalar(1),
        look: kitchen,
      },
    ];
  }

  private startObjectCutscene(prop: PropRuntime, option?: CutOption): void {
    const focus = prop.worldPos
      .clone()
      .add(new THREE.Vector3(0, prop.visual.focusHeight * 0.7, 0));
    const dir = this.baseCamPos.clone().sub(focus).setY(0).normalize();
    const near = focus
      .clone()
      .add(dir.clone().multiplyScalar(0.16))
      .add(new THREE.Vector3(0, 0.1, 0));
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    const desired = prop.worldPos
      .clone()
      .add(dir.clone().multiplyScalar(0.075))
      .add(side.clone().multiplyScalar(0.02));
    // Never teleport the cat into furniture: snap the cinematic stop onto the
    // walkability grid, falling back to the prop's approach anchor.
    const catSpot = this.canStand(desired.x, desired.z)
      ? new THREE.Vector3(desired.x, this.catBaseY, desired.z)
      : prop.anchor.clone();

    this.cutscene = {
      kind: 'object',
      id: prop.def.id,
      title: prop.def.label,
      captions: [option?.caption ?? prop.def.caption],
      duration: TUNING.cutsceneDuration,
      t: 0,
      prop,
      option,
      catFrom: this.cat ? this.cat.position.clone() : undefined,
      catTo: catSpot,
      didAction: false,
      shots: [
        {
          time: 0,
          pos: this.camPos.clone(),
          look: this.camLook.clone(),
        },
        {
          time: 0.3,
          pos: near.clone().add(side.clone().multiplyScalar(0.09)),
          look: focus.clone(),
        },
        {
          time: 0.72,
          pos: near.clone().add(side.clone().multiplyScalar(-0.06)).setY(near.y * 0.75),
          look: focus.clone(),
        },
        {
          time: 1,
          pos: near
            .clone()
            .add(dir.clone().multiplyScalar(0.12))
            .add(new THREE.Vector3(0, 0.04, 0)),
          look: catSpot.clone().add(new THREE.Vector3(0, 0.05, 0)),
        },
      ],
    };
    this.setPhase('cutscene');
    this.publishCutscene();
    audio.duck(0.35, 0.4);
  }

  private startEnding(): void {
    const solvedProps = this.props.filter((prop) => prop.progress > 0.5);
    const focus = (index: number) =>
      solvedProps[index % Math.max(1, solvedProps.length)]?.worldPos.clone() ??
      new THREE.Vector3(0, this.floorY + 0.05, 0);

    const shots: Shot[] = [
      {
        time: 0,
        pos: new THREE.Vector3(-0.5, 0.35, 0.8).multiplyScalar(this.fitRadius),
        look: new THREE.Vector3(0, this.floorY + 0.08, 0),
      },
      {
        time: 0.35,
        pos: focus(0).add(new THREE.Vector3(0.18, 0.16, 0.18)),
        look: focus(0),
      },
      {
        time: 0.68,
        pos: focus(1).add(new THREE.Vector3(-0.16, 0.14, 0.2)),
        look: focus(1),
      },
      {
        time: 1,
        pos: new THREE.Vector3(
          SPAWN.x + 0.16,
          this.floorY + 0.12,
          SPAWN.z + 0.3,
        ),
        look: new THREE.Vector3(
          SPAWN.x,
          this.floorY + 0.05,
          SPAWN.z,
        ),
      },
    ];

    this.cutscene = {
      kind: 'ending',
      id: 'ending',
      title: STR.title,
      captions: [...STR.endingCaption],
      video: 'ending.mp4',
      duration: TUNING.endingDuration,
      t: 0,
      shots,
      catFrom: this.cat?.position.clone(),
      catTo: new THREE.Vector3(
        SPAWN.x,
        this.catBaseY,
        SPAWN.z,
      ),
      didAction: false,
    };
    this.setPhase('ending');
    this.publishCutscene();
    audio.setMood('menu');
    audio.duck(0.8, 1.2);
  }

  private publishCutscene(): void {
    const cut = this.cutscene;
    if (!cut) {
      setState({ cutscene: null });
      return;
    }
    const progress = clamp(cut.t / cut.duration, 0, 1);
    const index = Math.min(
      cut.captions.length - 1,
      Math.floor(progress * cut.captions.length),
    );
    setState({
      cutscene: {
        id: cut.id,
        title: cut.title,
        caption: cut.captions[index],
        canSkip: true,
        progress,
        video: cut.video ?? cut.prop?.def.video,
      },
    });
  }

  private skipCutscene(): void {
    const cut = this.cutscene;
    if (!cut) return;
    cut.t = cut.duration;
    audio.play('back', 0.5);
  }

  private finishCutscene(cut: Cutscene): void {
    this.cutscene = null;
    setState({ cutscene: null });

    if (cut.kind === 'intro') {
      audio.setMood('game');
      audio.duck(1, 0.6);
      this.setPhase('playing');
      return;
    }

    if (cut.kind === 'ending') {
      this.setPhase('fin');
      this.finTimer = 0;
      return;
    }

    const prop = cut.prop;
    if (prop) {
      prop.solved = true;
      prop.target = 1;
      prop.marker.visible = false;
      this.awardPoints(prop);
    }
    audio.duck(1, 0.5);
    audio.setMood('game');
    this.pickGoldenTarget();
    this.setPhase('playing');
  }

  private updateCutscene(dt: number): void {
    const cut = this.cutscene;
    if (!cut) return;

    cut.t = Math.min(cut.duration, cut.t + dt);
    const t = cut.t / cut.duration;

    this.sampleShots(cut.shots, easeInOut(clamp(t, 0, 1)));

    if (cut.kind === 'object' && cut.prop) {
      const prop = cut.prop;
      if (cut.catFrom && cut.catTo && this.cat) {
        const walk = clamp(t / 0.28, 0, 1);
        this.cat.position.lerpVectors(cut.catFrom, cut.catTo, easeInOut(walk));
        this.cat.faceTowards(prop.worldPos.x, prop.worldPos.z, dt);
        this.cat.update(dt, walk < 1 ? 0.9 : 0, this.elapsed);
      }
      if (!cut.didAction && t >= 0.42) {
        cut.didAction = true;
        this.cat?.swipe();
        audio.play(prop.def.sfx, 0.9);
      }
      prop.target = clamp((t - 0.45) / 0.28, 0, 1);
    } else if (this.cat) {
      if (cut.catFrom && cut.catTo) {
        this.cat.position.lerpVectors(cut.catFrom, cut.catTo, easeInOut(clamp(t * 1.4, 0, 1)));
      }
      this.cat.update(dt, cut.kind === 'ending' ? 0 : 0.15, this.elapsed);
      if (cut.kind === 'ending' && !cut.didAction && t > 0.75) {
        cut.didAction = true;
        audio.play('purr', 0.8);
      }
    }

    this.publishCutscene();
    if (cut.t >= cut.duration) this.finishCutscene(cut);
  }

  private sampleShots(shots: Shot[], t: number): void {
    let a = shots[0];
    let b = shots[shots.length - 1];
    for (let i = 0; i < shots.length - 1; i += 1) {
      if (t >= shots[i].time && t <= shots[i + 1].time) {
        a = shots[i];
        b = shots[i + 1];
        break;
      }
    }
    const span = Math.max(1e-4, b.time - a.time);
    const local = easeInOut(clamp((t - a.time) / span, 0, 1));
    this.camPos.lerpVectors(a.pos, b.pos, local);
    this.camLook.lerpVectors(a.look, b.look, local);
  }

  /* ---------------------------------------------------------- gameplay -- */

  private handleSpacePress(): void {
    if (this.phase !== 'playing') {
      this.tryInteract();
      return;
    }
    const prop = this.nearestProp();
    const now = performance.now();
    if (now - this.lastSpacePressAt <= TUNING.jumpDoublePressMs) {
      this.lastSpacePressAt = -Infinity;
      const jumpTarget = prop?.def.jumpHeight ? prop : null;
      console.info('[chichi] SPACE double-press -> jump', {
        target: jumpTarget?.def.id ?? null,
        height: this.jumpHeight(),
      });
      this.startJump(jumpTarget);
      return;
    }

    this.lastSpacePressAt = now;
    if (prop?.def.jumpHeight) {
      this.setToast('스페이스바를 한 번 더 누르면 점프해요!');
    } else {
      // Preserve the existing one-press interaction for floor-level props.
      this.tryInteract();
    }
  }

  private startJump(prop: PropRuntime | null): void {
    const cat = this.cat;
    if (!cat || this.jump || this.phase !== 'playing') return;
    if (prop) cat.faceTowards(prop.worldPos.x, prop.worldPos.z, 0, true);
    this.jump = { prop, elapsed: 0, touched: false };
    console.info('[chichi] jump started', {
      target: prop?.def.id ?? null,
      height: this.jumpHeight(),
      duration: TUNING.jumpDuration,
    });
    audio.play('whoosh', 0.55);
  }

  private activateProp(prop: PropRuntime): void {
    if (prop.def.options && prop.def.options.length > 0) {
      this.pendingChoice = prop;
      this.setPhase('choice');
      setState({
        choice: {
          title: prop.def.caption,
          options: prop.def.options.map((option) => ({
            id: option.id,
            label: option.label,
            hint: option.hint,
          })),
        },
      });
      audio.play('chime', 0.7);
      audio.duck(0.5, 0.3);
      return;
    }
    this.startObjectCutscene(prop);
  }

  private tryInteract(): void {
    if (this.phase === 'title') {
      this.startGame();
      return;
    }
    if (this.phase !== 'playing') return;
    const prop = this.nearestProp();
    if (!prop) return;
    if (prop.def.jumpHeight) {
      this.setToast('스페이스바를 두 번 눌러 점프해요!');
      return;
    }
    this.activateProp(prop);
  }

  private resolveChoice(optionId: string): void {
    const prop = this.pendingChoice;
    this.pendingChoice = null;
    setState({ choice: null });
    if (!prop) {
      this.setPhase('playing');
      return;
    }
    const option = prop.def.options?.find((entry) => entry.id === optionId);
    this.startObjectCutscene(prop, option);
  }

  private nearestProp(): PropRuntime | null {
    if (!this.cat) return null;
    let best: PropRuntime | null = null;
    let bestDist = Infinity;
    for (const prop of this.props) {
      if (prop.solved) continue;
      const dist = Math.hypot(
        prop.worldPos.x - this.cat.position.x,
        prop.worldPos.z - this.cat.position.z,
      );
      const reach = TUNING.interactRadius + prop.def.reach;
      if (dist < reach && dist < bestDist) {
        best = prop;
        bestDist = dist;
      }
    }
    return best;
  }

  private awardPoints(prop: PropRuntime): void {
    const isGolden = this.goldenTargetId === prop.def.id;
    const comboActive = this.comboTimer > 0;
    this.combo = comboActive ? Math.min(TUNING.comboMax, this.combo + 1) : 1;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.comboTimer = TUNING.comboWindow;
    this.events += 1;

    let gained = prop.def.points * this.combo;
    if (isGolden) gained *= TUNING.goldenTargetMultiplier;
    if (this.goldenLeft > 0) gained *= TUNING.goldenMultiplier;
    if (this.guardian) gained *= TUNING.guardianMultiplier;
    gained = Math.round(gained);
    this.score += gained;

    let toast: string | null = null;
    if (prop.def.kind === 'gas' && !this.badges.has(prop.def.id)) {
      this.badges.add(prop.def.id);
      toast = STR.badgeGained;
      audio.play('badge', 0.9);
      if (this.badges.size >= 4 && !this.guardian) {
        this.guardian = true;
        toast = STR.guardianStart;
        audio.play('golden', 0.9);
      }
    } else {
      audio.play('chime', 0.8);
    }

    this.spawnPop(
      prop,
      `+${gained}`,
      isGolden || this.goldenLeft > 0
        ? 'golden'
        : prop.def.kind === 'gas'
          ? 'safety'
          : 'normal',
    );
    if (toast) this.setToast(toast);
  }

  private spawnPop(prop: PropRuntime, text: string, tone: ScorePop['tone']): void {
    const world = prop.worldPos
      .clone()
      .add(new THREE.Vector3(0, prop.visual.focusHeight + 0.04, 0));
    const projected = world.project(this.camera);
    this.popId += 1;
    this.pops.push({
      id: this.popId,
      x: clamp((projected.x * 0.5 + 0.5) * 100, 6, 94),
      y: clamp((-projected.y * 0.5 + 0.5) * 100, 8, 88),
      text,
      tone,
      life: 1.4,
    });
  }

  private setToast(message: string): void {
    this.toastLife = 2.2;
    setState({ toast: message });
  }

  private updatePlaying(dt: number): void {
    const cat = this.cat;
    if (!cat) return;

    this.timeLeft = Math.max(0, this.timeLeft - dt);

    if (this.jump) {
      this.updateJump(dt);
      if (this.phase !== 'playing') return;
    } else {
      // Movement in camera space so "up" always means "away from the camera".
      this.moveDir.set(0, 0);
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) this.moveDir.y -= 1;
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) this.moveDir.y += 1;
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) this.moveDir.x -= 1;
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) this.moveDir.x += 1;
      this.moveDir.x += this.joyVec.x;
      this.moveDir.y += this.joyVec.y;
      if (this.moveDir.lengthSq() > 1) this.moveDir.normalize();

      const forward = this.baseCamLook
        .clone()
        .sub(this.baseCamPos)
        .setY(0)
        .normalize();
      const right = new THREE.Vector3(-forward.z, 0, forward.x);
      const speed = this.goldenLeft > 0 ? TUNING.goldenMoveSpeed : TUNING.moveSpeed;
      const move = forward
        .multiplyScalar(-this.moveDir.y)
        .add(right.multiplyScalar(this.moveDir.x));
      const moving = move.lengthSq() > 1e-5;

      if (moving) {
        move.normalize().multiplyScalar(speed * dt);
        cat.faceTowards(cat.position.x + move.x, cat.position.z + move.z, dt);
        const next = cat.position.clone().add(move);
        this.resolveCollisions(next, cat.position, cat.colliderHeading);
        cat.position.copy(next);
      }
      cat.update(dt, moving ? this.moveDir.length() : 0, this.elapsed);
      audio.footstep(dt, moving);
    }

    // Combo decay.
    if (this.comboTimer > 0) {
      this.comboTimer = Math.max(0, this.comboTimer - dt);
      if (this.comboTimer === 0) this.combo = 1;
    }

    // Golden time.
    if (this.goldenLeft > 0) {
      this.goldenLeft = Math.max(0, this.goldenLeft - dt);
      if (this.goldenLeft === 0) {
        this.stickersTaken = 0;
        for (const sticker of this.stickers) {
          sticker.taken = false;
          sticker.mesh.visible = true;
        }
      }
    }

    // Sticker pickups.
    for (const sticker of this.stickers) {
      if (sticker.taken) continue;
      const dist = sticker.mesh.position.distanceTo(cat.position);
      if (dist < 0.05) {
        sticker.taken = true;
        sticker.mesh.visible = false;
        this.stickersTaken += 1;
        audio.play('sticker', 0.8);
        if (this.stickersTaken >= TUNING.stickerGoal) {
          this.goldenLeft = TUNING.goldenDuration;
          this.setToast(STR.goldenStart);
          audio.play('golden', 1);
        }
      }
    }

    if (this.timeLeft <= 0) this.endRound();
  }

  private updateJump(dt: number): void {
    const jump = this.jump;
    const cat = this.cat;
    if (!jump || !cat) return;

    jump.elapsed = Math.min(TUNING.jumpDuration, jump.elapsed + dt);
    const t = jump.elapsed / TUNING.jumpDuration;
    const height = this.jumpHeight();
    // Explicit Y-axis arc: root Y rises from the floor to the configured
    // apex, then returns to the floor before any interaction starts.
    cat.position.y = this.catBaseY + Math.sin(Math.PI * t) * height;
    cat.update(dt, 0.75, this.elapsed);

    // At the apex, make the little paw contact visible. The score/cutscene
    // still waits for the landing so the jump cannot leave the cat mid-air.
    if (!jump.touched && t >= 0.5) {
      jump.touched = true;
      cat.swipe();
      console.info('[chichi] jump apex', {
        y: cat.position.y,
        target: jump.prop?.def.id ?? null,
      });
    }
    if (t < 1) return;

    cat.position.y = this.catBaseY;
    this.jump = null;
    if (jump.prop) this.activateProp(jump.prop);
  }

  /** Jump apex follows the room ceiling even if the room layout changes. */
  private jumpHeight(): number {
    const apexY = this.roomHeight - TUNING.jumpCeilingMargin;
    return Math.max(TUNING.catFloorClearance, apexY - this.catBaseY);
  }

  /**
   * Closest world position the cat can stand on. Wall-mounted and elevated
   * props (curtain, alarm, stove) rely on this so they always have a floor
   * spot to be approached from.
   */
  private nearestStandable(x: number, z: number): THREE.Vector3 {
    if (this.canStand(x, z)) return new THREE.Vector3(x, this.catBaseY, z);
    const step = 0.012;
    for (let ring = 1; ring <= 40; ring += 1) {
      let best: THREE.Vector3 | null = null;
      let bestDist = Infinity;
      for (let i = -ring; i <= ring; i += 1) {
        const candidates: [number, number][] = [
          [x + i * step, z - ring * step],
          [x + i * step, z + ring * step],
          [x - ring * step, z + i * step],
          [x + ring * step, z + i * step],
        ];
        for (const [cx, cz] of candidates) {
          if (!this.canStand(cx, cz)) continue;
          const dist = Math.hypot(cx - x, cz - z);
          if (dist < bestDist) {
            bestDist = dist;
            best = new THREE.Vector3(cx, this.catBaseY, cz);
          }
        }
      }
      if (best) return best;
    }
    return new THREE.Vector3(x, this.catBaseY, z);
  }

  /** Inside the room and clear of furniture/prop collider boxes. */
  private isWalkable(x: number, z: number, heading = this.cat?.colliderHeading ?? 0): boolean {
    const half = catWorldHalfExtents(heading);
    if (
      Math.abs(x) > this.extentX * 0.5 - half.x ||
      Math.abs(z) > this.extentZ * 0.5 - half.z
    ) {
      return false;
    }
    for (const rect of COLLIDERS) {
      if (overlapsCat(rect, x, z, heading)) return false;
    }
    return true;
  }

  /** Walkable with the cat's box collider taken into account. */
  private canStand(x: number, z: number, heading = this.cat?.colliderHeading ?? 0): boolean {
    const half = catWorldHalfExtents(heading);
    if (Math.abs(x) > this.extentX * 0.5 - half.x) return false;
    if (Math.abs(z) > this.extentZ * 0.5 - half.z) return false;
    for (const rect of COLLIDERS) {
      if (overlapsCat(rect, x, z, heading)) return false;
    }
    return true;
  }

  private resolveCollisions(next: THREE.Vector3, from: THREE.Vector3, heading: number): void {
    const half = catWorldHalfExtents(heading);
    const limitX = this.extentX * 0.5 - half.x;
    const limitZ = this.extentZ * 0.5 - half.z;
    next.x = clamp(next.x, -limitX, limitX);
    next.z = clamp(next.z, -limitZ, limitZ);

    if (this.canStand(next.x, next.z, heading)) return;
    if (this.canStand(next.x, from.z, heading)) {
      next.z = from.z;
      return;
    }
    if (this.canStand(from.x, next.z, heading)) {
      next.x = from.x;
      return;
    }
    // The cat is standing somewhere it should not be (an edge case after a
    // cinematic). Allow any move that gets it back onto walkable floor.
    if (!this.canStand(from.x, from.z, heading) && this.isWalkable(next.x, next.z, heading)) {
      return;
    }
    next.copy(from);
  }

  private endRound(): void {
    const best = Math.max(getState().bestScore, this.score);
    const isNewBest = this.score > getState().bestScore && this.score > 0;
    if (isNewBest) persistBestScore(this.score);

    const rank =
      this.badges.size >= 4
        ? STR.ranks.guardian
        : this.badges.size >= 2
          ? STR.ranks.brave
          : this.events >= 4
            ? STR.ranks.tidy
            : STR.ranks.curious;

    setState({
      bestScore: best,
      result: {
        score: this.score,
        bestScore: best,
        isNewBest,
        events: this.events,
        badges: this.badges.size,
        bestCombo: this.bestCombo,
        rank: rank.name,
        comment: rank.comment,
      },
      prompt: null,
      warning: 0,
    });
    this.setPhase('result');
    audio.setMood('menu');
    audio.duck(0.7, 1);
    audio.play('golden', 0.7);
  }

  /* -------------------------------------------------------------- loop -- */

  private updateWorld(dt: number): void {
    for (const prop of this.props) {
      // Solved props stay in their completed state until a new round starts.
      prop.progress += (prop.target - prop.progress) * Math.min(1, dt * 4);
      prop.visual.setProgress(prop.progress);
      prop.visual.update(this.elapsed, prop.progress);

      if (prop.marker.visible) {
        const isGolden = this.goldenTargetId === prop.def.id;
        prop.marker.rotation.y = this.elapsed * 1.4;
        prop.marker.position.y =
          prop.visual.focusHeight +
          0.035 +
          Math.sin(this.elapsed * 2.4 + prop.worldPos.x * 8) * 0.006;
        prop.marker.scale.setScalar(isGolden ? 1.5 : 1);
        const color = isGolden
          ? PALETTE.goldMarker
          : prop.def.kind === 'gas'
            ? PALETTE.gasMarker
            : PALETTE.tidyMarker;
        const intensity = isGolden
          ? 0.9 + Math.sin(this.elapsed * 6) * 0.35
          : 0.45;
        prop.marker.traverse((child) => {
          if (!(child instanceof THREE.Mesh)) return;
          const material = child.material;
          const materials = Array.isArray(material) ? material : [material];
          for (const candidate of materials) {
            if (!('emissive' in candidate)) continue;
            const standard = candidate as THREE.MeshStandardMaterial;
            standard.emissiveIntensity = intensity;
            standard.color.setHex(color);
            standard.emissive.copy(standard.color);
          }
        });
      }
    }

    for (const sticker of this.stickers) {
      if (!sticker.mesh.visible) continue;
      sticker.mesh.position.y =
        this.floorY + 0.028 + Math.sin(this.elapsed * 2.6) * 0.006;
      sticker.mesh.rotation.z = this.elapsed * 0.9;
    }

    for (const pop of this.pops) pop.life -= dt;
    if (this.pops.some((pop) => pop.life <= 0)) {
      this.pops = this.pops.filter((pop) => pop.life > 0);
    }

    if (this.toastLife > 0) {
      this.toastLife -= dt;
      if (this.toastLife <= 0) setState({ toast: null });
    }
  }

  private updateCamera(dt: number): void {
    if (this.phase === 'playing' || this.phase === 'choice' || this.phase === 'title') {
      const cat = this.cat;
      // Fixed 3/4 framing with a whisper of parallax toward the cat.
      const offset = cat
        ? new THREE.Vector3(cat.position.x * 0.12, 0, cat.position.z * 0.12)
        : new THREE.Vector3();
      const targetPos = this.baseCamPos.clone().add(offset);
      const targetLook = this.baseCamLook.clone().add(offset.multiplyScalar(1.6));
      const k = Math.min(1, dt * 3);
      this.camPos.lerp(targetPos, k);
      this.camLook.lerp(targetLook, k);
    }
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
  }

  private syncStore(dt: number): void {
    this.syncAccum += dt;
    const cat = this.cat;
    const nearest = this.phase === 'playing' ? this.nearestProp() : null;

    let warning = 0;
    if (cat && this.phase === 'playing') {
      for (const prop of this.props) {
        if (prop.def.kind !== 'gas' || prop.solved) continue;
        const dist = Math.hypot(
          prop.worldPos.x - cat.position.x,
          prop.worldPos.z - cat.position.z,
        );
        warning = Math.max(warning, clamp((0.2 - dist) / 0.14, 0, 1));
      }
    }

    const promptState = getState().prompt;
    const promptChanged = (promptState?.id ?? null) !== (nearest?.def.id ?? null);

    if (this.syncAccum < 0.1 && !promptChanged) return;
    this.syncAccum = 0;

    setState({
      timeLeft: Math.ceil(this.timeLeft),
      score: this.score,
      combo: this.combo,
      comboFuel: clamp(this.comboTimer / TUNING.comboWindow, 0, 1),
      badges: this.badges.size,
      stickers: this.stickersTaken,
      goldenTime: this.goldenLeft > 0,
      goldenLeft: Math.ceil(this.goldenLeft),
      guardianBonus: this.guardian,
      warning,
      prompt: nearest
        ? {
            id: nearest.def.id,
            label: nearest.def.prompt,
            kind: nearest.def.kind,
            points: nearest.def.points,
            requiresJump: Boolean(nearest.def.jumpHeight),
          }
        : null,
      scorePops: this.pops.map((pop) => ({
        id: pop.id,
        x: pop.x,
        y: pop.y,
        text: pop.text,
        tone: pop.tone,
      })),
    });
  }

  private loop = (): void => {
    if (this.disposed) return;
    this.frameHandle = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    this.elapsed += dt;

    switch (this.phase) {
      case 'playing':
        this.updatePlaying(dt);
        break;
      case 'intro':
      case 'cutscene':
      case 'ending':
        this.updateCutscene(dt);
        break;
      case 'title':
        this.cat?.update(dt, 0, this.elapsed);
        break;
      case 'fin':
        this.finTimer += dt;
        this.cat?.update(dt, 0, this.elapsed);
        break;
      default:
        this.cat?.update(dt, 0, this.elapsed);
        break;
    }

    this.updateWorld(dt);
    this.updateCamera(dt);
    this.syncStore(dt);
    this.renderer.render(this.scene, this.camera);
  };

  /* ------------------------------------------------------------ layout -- */

  private resize(): void {
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;
    const aspect = width / height;

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, TUNING.dprCap));
    this.renderer.setSize(width, height, false);

    this.camera.aspect = aspect;
    this.camera.fov = aspect < 0.8 ? 44 : aspect < 1.3 ? 39 : 34;
    this.camera.updateProjectionMatrix();

    // Auto-fit the whole room in frame from the fixed 3/4 angle.
    const radius = Math.hypot(this.extentX, this.extentZ) * 0.5;
    const fovV = THREE.MathUtils.degToRad(this.camera.fov);
    const fovH = 2 * Math.atan(Math.tan(fovV / 2) * aspect);
    const distance =
      (Math.max(radius / Math.sin(fovV / 2), radius / Math.sin(fovH / 2)) * 0.86) +
      0.2;
    this.fitRadius = distance;

    // Elevated 3/4 angle: verified against the room mesh offline, it clears
    // the kitchen counters that would otherwise hide half the floor.
    const dir = new THREE.Vector3(0.55, 1.05, 0.62).normalize();
    this.baseCamPos.copy(dir.multiplyScalar(distance));
    this.baseCamLook.set(0, this.floorY + this.roomHeight * 0.1, 0);

    if (this.phase === 'title' || this.phase === 'loading') {
      this.camPos.copy(this.baseCamPos);
      this.camLook.copy(this.baseCamLook);
    }
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameHandle);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('orientationchange', this.onResize);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    audio.stopMusic();
    // The room shares cached geometries and materials between its meshes, so
    // it disposes itself and clears those caches; everything else is swept
    // generically below.
    const room = this.roomGroup;
    if (room) {
      room.removeFromParent();
      this.roomGroup = null;
    }
    disposeRoom(room);
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
      else material?.dispose();
    });
    this.renderer.dispose();
  }
}
