import type { PropKind } from './types';

/** Base path aware asset URL (the app is served under a path prefix). */
export function asset(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
}

export const TUNING = {
  /** Round length in seconds. */
  roundTime: 120,
  /** Cat movement speed in world units per second. */
  moveSpeed: 0.34,
  goldenMoveSpeed: 0.42,
  /** Half-extent of the playable floor, in world units. */
  bounds: 0.44,
  /** Cat horizontal body size after normalisation. */
  catSize: 0.16,
  /** Target visual height: +0.05 above the previous ~0.16 scale reference. */
  catHeight: 0.21,
  /**
   * Local half-extents of the cat's floor collider. The engine rotates this
   * body box with 치치's facing direction before testing each prop/furniture
   * box, rather than using an undersized point collider.
   */
  catCollider: { halfX: 0.045, halfZ: 0.072 },
  /** Small visible separation so animated paws never dip below the floor. */
  catFloorClearance: 0.002,
  /** Two presses within this window trigger a high-object jump. */
  jumpDoublePressMs: 320,
  /** Length of the complete take-off, apex, and landing motion. */
  jumpDuration: 0.62,
  /** Apex rise for every double-space jump, in world units. */
  freeJumpHeight: 0.46,
  /** Keep the jump apex this far below the room ceiling. */
  jumpCeilingMargin: 0.05,
  /** The authored room stands on y = 0. */
  floorY: 0,
  /** Default gameplay Y offset for the cat above the authored floor. */
  catBaseY: 0.01,

  /** Prompt/interaction reach; movement collision stays independently sized. */
  interactRadius: 0.11,
  comboWindow: 4,
  comboMax: 9,

  goldenDuration: 10,
  goldenMultiplier: 2,
  goldenTargetMultiplier: 2,
  guardianMultiplier: 1.5,

  stickerGoal: 5,
  cutsceneDuration: 8,
  introDuration: 10,
  endingDuration: 16,

  dprCap: 1.5,
  seed: 20260819,
} as const;

export interface CutOption {
  id: string;
  label: string;
  hint: string;
  caption: string;
}

export interface KnockDef {
  id: string;
  /** Short display name used in prompts and cutscene titles. */
  label: string;
  kind: PropKind;
  points: number;
  /** Position in room space: x -0.5..0.5, z -0.45..0.45 (see room-layout.ts). */
  x: number;
  z: number;
  /** Height above the room floor plane; 0 sits on the floor. */
  y: number;
  /** Facing of the prop in radians. */
  rot: number;
  /** Extra interaction radius on top of TUNING.interactRadius. */
  reach: number;
  /** Visual scale of the prop model. */
  scale?: number;
  /** Half-extents of the footprint the cat bumps into, in world units. */
  block?: [number, number];
  /** Height of a double-space jump needed to touch this elevated object. */
  jumpHeight?: number;
  prompt: string;
  caption: string;
  sfx: 'glass' | 'squeak' | 'cloth' | 'paper' | 'metal' | 'hiss' | 'beep';
  /** Optional external cinematic; falls back to the in-engine one. */
  video?: string;
  options?: CutOption[];
}

/**
 * The eight interactive objects. Four tidying beats, four gas-safety beats.
 * Positions sit in the hand-authored room (src/game/room-layout.ts) and are
 * checked by tools/validate-layout.mjs, which proves the cat can reach each
 * one from the spawn point.
 */
export const KNOCK_DEFS: KnockDef[] = [
  {
    id: 'plant',
    label: '쓰러진 화분',
    kind: 'tidy',
    points: 40,
    x: -0.42,
    z: -0.03,
    y: 0,
    rot: 0.4,
    reach: 0.015,
    block: [0.032, 0.026],
    prompt: '화분 바로 세우기',
    caption: '발로 밀어 화분을 세우고, 흙을 토닥토닥 정리한다.',
    sfx: 'glass',
    video: 'cut6_plant.mp4',
  },
  {
    id: 'yarn',
    label: '엉킨 실뭉치',
    kind: 'tidy',
    points: 20,
    // In front of the armchair: the original behind-chair spot is narrower
    // than the full cat body box.
    x: 0.22,
    z: 0.2,
    y: 0,
    rot: 0.3,
    reach: 0.012,
    block: [0.018, 0.018],
    prompt: '실뭉치 감기',
    caption: '굴리고 또 굴려서 동그랗게 감아 놓는다.',
    sfx: 'squeak',
    video: 'cut1_yarn.mp4',
  },
  {
    id: 'curtain',
    label: '흐트러진 커튼',
    kind: 'tidy',
    points: 30,
    x: -0.455,
    z: -0.06,
    y: 0.245,
    rot: Math.PI / 2,
    reach: 0.03,
    scale: 1.8,
    block: [0.014, 0.075],
    jumpHeight: 0.46,
    prompt: '커튼 가지런히 걸기',
    caption: '앞발로 커튼을 당겨 가지런히 걸어 둔다.',
    sfx: 'cloth',
    video: 'cut2_curtain.mp4',
  },
  {
    id: 'desk',
    label: '어질러진 책상',
    kind: 'tidy',
    points: 50,
    x: -0.2,
    z: 0.08,
    y: 0,
    rot: 0,
    reach: 0.06,
    scale: 1.25,
    block: [0.075, 0.05],
    prompt: '책상 정리하기',
    caption: '무엇부터 정리할까?',
    sfx: 'paper',
    options: [
      {
        id: 'papers',
        label: '흩어진 서류 모으기',
        hint: '+50',
        caption: '앞발로 종이를 톡톡 밀어 한 줄로 맞춘다.',
      },
      {
        id: 'pen',
        label: '펜 통에 꽂기',
        hint: '+50',
        caption: '굴러다니던 펜을 입으로 물어 통에 쏙 꽂는다.',
      },
      {
        id: 'mug',
        label: '머그컵 제자리에',
        hint: '+50',
        caption: '아슬아슬한 머그컵을 조심조심 안쪽으로 민다.',
      },
    ],
    video: 'cut3_desk.mp4',
  },
  {
    id: 'gas_stove',
    label: '가스레인지 밸브',
    kind: 'gas',
    points: 60,
    x: 0.16,
    z: -0.35,
    y: 0.227,
    rot: 0,
    // The stove shares a tight counter corner with the loose hose. Keep the
    // cat's collider out of both, but let the paw reach the valve from the
    // nearest clear floor tile.
    reach: 0.1,
    block: [0.06, 0.04],
    jumpHeight: 0.46,
    prompt: '밸브 잠그기',
    caption: '냄새를 맡자마자 몸을 던져 밸브를 잠근다. 쉬익 소리가 멎는다.',
    sfx: 'hiss',
    video: 'cut7_stove.mp4',
  },
  {
    id: 'gas_hose',
    label: '헐거운 가스 호스',
    kind: 'gas',
    points: 50,
    x: 0.16,
    z: -0.245,
    y: 0,
    rot: 0,
    reach: 0.018,
    block: [0.022, 0.014],
    prompt: '호스 눌러 고정하기',
    caption: '빠질락 말락 하는 호스를 온몸으로 눌러 다시 끼운다.',
    sfx: 'metal',
    video: 'cut8_hose.mp4',
  },
  {
    id: 'gas_can',
    label: '햇볕 아래 부탄가스',
    kind: 'gas',
    points: 40,
    x: 0.3,
    z: -0.17,
    y: 0,
    rot: 0.5,
    reach: 0.012,
    scale: 0.62,
    block: [0.018, 0.018],
    prompt: '그늘로 옮기기',
    caption: '뜨끈해진 캔을 창가에서 밀어내 서늘한 그늘에 세워 둔다.',
    sfx: 'metal',
    video: 'cut9_can.mp4',
  },
  {
    id: 'alarm',
    label: '깜빡이는 가스 경보기',
    kind: 'gas',
    points: 40,
    x: 0.058,
    z: -0.2,
    y: 0.38,
    rot: Math.PI / 2,
    reach: 0.03,
    block: [0.022, 0.022],
    jumpHeight: 0.46,
    prompt: '경보기 확인하기',
    caption: '폴짝 뛰어올라 버튼을 누르자 붉은 불이 초록으로 바뀐다.',
    sfx: 'beep',
    video: 'cut10_alarm.mp4',
  },
];

/** Paw-sticker collectibles that charge golden time. */
export const STICKER_SPOTS: { x: number; z: number }[] = [
  { x: -0.42, z: 0.14 },
  { x: -0.22, z: -0.16 },
  { x: 0.15, z: 0.06 },
  { x: 0.3, z: 0.26 },
  { x: 0.42, z: 0.3 },
];

/** Where the cat starts each round: open floor in the middle of the living room. */
export const SPAWN = { x: -0.15, z: -0.15 } as const;

export const PALETTE = {
  warmLight: 0xffe4c4,
  coolFill: 0xbcd7ff,
  goldMarker: 0xffc857,
  tidyMarker: 0xfff3c4,
  gasMarker: 0xff8a7a,
  sticker: 0xffb3c7,
} as const;
