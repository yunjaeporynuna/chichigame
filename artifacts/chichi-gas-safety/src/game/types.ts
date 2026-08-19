/**
 * Shared contract between the Three.js game engine (src/game/*) and the
 * React overlay UI (src/ui/*).
 *
 * The engine owns all state. The UI reads it through `useGameState()` and
 * triggers behaviour through `actions`.
 */

export type Phase =
  | 'loading' // assets streaming in
  | 'title' // main menu
  | 'intro' // opening cinematic
  | 'playing' // 60s free-roam round
  | 'cutscene' // ~8s object cinematic
  | 'choice' // 3-way choice popup (desk)
  | 'result' // score screen
  | 'ending' // closing cinematic
  | 'fin'; // black screen with FIN

export type PropKind = 'tidy' | 'gas';

export interface ScorePop {
  id: number;
  /** Screen position in percent of viewport (0-100). */
  x: number;
  y: number;
  text: string;
  tone: 'normal' | 'golden' | 'safety';
}

export interface CutsceneInfo {
  id: string;
  /** Short scene label, e.g. "쓰러진 화분". */
  title: string;
  /** One line of narration shown under the letterbox. */
  caption: string;
  canSkip: boolean;
  /** 0..1 playback progress. */
  progress: number;
  /** File name of the pre-rendered cinematic, when one exists for this scene. */
  video?: string;
}

export interface ChoiceOption {
  id: string;
  label: string;
  hint: string;
}

export interface ChoiceInfo {
  title: string;
  options: ChoiceOption[];
}

export interface RoundResult {
  score: number;
  bestScore: number;
  isNewBest: boolean;
  /** Number of cinematics triggered this round. */
  events: number;
  /** Gas-safety objects solved, 0..4. */
  badges: number;
  bestCombo: number;
  /** e.g. "안전 지킴이". */
  rank: string;
  comment: string;
}

export interface JoystickState {
  active: boolean;
  /** Viewport pixel coordinates of the stick base. */
  cx: number;
  cy: number;
  /** Stick offset from the base in pixels, already clamped to the radius. */
  dx: number;
  dy: number;
}

export interface InteractPrompt {
  id: string;
  label: string;
  kind: PropKind;
  points: number;
  /** Elevated props are solved by a quick double-space jump. */
  requiresJump?: boolean;
}

export interface GameState {
  phase: Phase;
  /** 0..1 asset loading progress. */
  loadProgress: number;
  loadError: string | null;

  /** Seconds left in the round (already rounded for display). */
  timeLeft: number;
  score: number;
  /** Combo multiplier, 1..9. */
  combo: number;
  /** 0..1 of the remaining combo window, drives a decaying ring/bar. */
  comboFuel: number;

  /** Gas-safety objects solved this round, 0..4. */
  badges: number;
  /** Paw stickers picked up, 0..5, fills the golden-time gauge. */
  stickers: number;
  stickerGoal: number;

  goldenTime: boolean;
  /** Seconds left of golden time. */
  goldenLeft: number;
  /** True once all four gas-safety events are solved (x1.5 bonus). */
  guardianBonus: boolean;

  /** Nearest interactable in range, or null. */
  prompt: InteractPrompt | null;
  /** 0..1 proximity warning glow for gas objects (red screen edges). */
  warning: number;

  scorePops: ScorePop[];
  /** Transient toast, e.g. "안전 배지 획득". */
  toast: string | null;

  cutscene: CutsceneInfo | null;
  choice: ChoiceInfo | null;
  result: RoundResult | null;

  joystick: JoystickState;
  isTouch: boolean;

  bestScore: number;
  settings: { bgm: boolean; sfx: boolean };
}

export interface GameActions {
  /** Title screen -> intro cinematic -> round. */
  start: () => void;
  /** Skip the current cinematic (intro, object cut, ending). */
  skip: () => void;
  /** Pick one of the three desk options. */
  choose: (optionId: string) => void;
  /** Result screen -> ending cinematic. */
  toEnding: () => void;
  /** Play again from the title screen. */
  restart: () => void;
  /** Back to the title screen from anywhere. */
  toTitle: () => void;
  /** Trigger the interaction the prompt is showing (mobile button). */
  interact: () => void;
  toggleBgm: () => void;
  toggleSfx: () => void;
  /** UI click/hover feedback sound. */
  uiSound: (tone?: 'tap' | 'back' | 'meow') => void;
}
