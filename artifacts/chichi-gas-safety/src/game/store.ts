import { useSyncExternalStore } from 'react';

import { TUNING } from './config';
import type { GameActions, GameState } from './types';

const BEST_SCORE_KEY = 'chichi.bestScore';
const SETTINGS_KEY = 'chichi.settings';

function readBestScore(): number {
  if (typeof window === 'undefined') return 0;
  const raw = window.localStorage.getItem(BEST_SCORE_KEY);
  const parsed = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function readSettings(): { bgm: boolean; sfx: boolean } {
  if (typeof window === 'undefined') return { bgm: true, sfx: true };
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { bgm: true, sfx: true };
    const parsed = JSON.parse(raw) as Partial<{ bgm: boolean; sfx: boolean }>;
    return { bgm: parsed.bgm !== false, sfx: parsed.sfx !== false };
  } catch {
    return { bgm: true, sfx: true };
  }
}

const initialState: GameState = {
  phase: 'loading',
  loadProgress: 0,
  loadError: null,

  timeLeft: TUNING.roundTime,
  score: 0,
  combo: 1,
  comboFuel: 0,

  badges: 0,
  stickers: 0,
  stickerGoal: 5,

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

  joystick: { active: false, cx: 0, cy: 0, dx: 0, dy: 0 },
  isTouch: false,

  bestScore: readBestScore(),
  settings: readSettings(),
};

let state: GameState = initialState;
const listeners = new Set<() => void>();

export function getState(): GameState {
  return state;
}

export function setState(patch: Partial<GameState>): void {
  let changed = false;
  for (const key of Object.keys(patch) as (keyof GameState)[]) {
    if (!Object.is(state[key], patch[key])) {
      changed = true;
      break;
    }
  }
  if (!changed) return;
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useGameState(): GameState {
  return useSyncExternalStore(subscribe, getState, getState);
}

export function persistBestScore(score: number): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(BEST_SCORE_KEY, String(score));
}

export function persistSettings(settings: {
  bgm: boolean;
  sfx: boolean;
}): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

const noop = () => {};

/**
 * Live action handles. The engine replaces these on mount; the UI can call
 * them safely before then (they are no-ops while assets load).
 */
export const actions: GameActions = {
  start: noop,
  skip: noop,
  choose: noop,
  toEnding: noop,
  restart: noop,
  toTitle: noop,
  interact: noop,
  toggleBgm: noop,
  toggleSfx: noop,
  uiSound: noop,
};

export function registerActions(impl: Partial<GameActions>): void {
  Object.assign(actions, impl);
}

export function resetActions(): void {
  Object.assign(actions, {
    start: noop,
    skip: noop,
    choose: noop,
    toEnding: noop,
    restart: noop,
    toTitle: noop,
    interact: noop,
    toggleBgm: noop,
    toggleSfx: noop,
    uiSound: noop,
  });
}
