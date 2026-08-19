import { useGameState } from '@/game/store';
import { AnimatePresence } from 'framer-motion';

import { LoadingScreen } from './screens/LoadingScreen';
import { TitleScreen } from './screens/TitleScreen';
import { CinematicScreen } from './screens/CinematicScreen';
import { PlayingScreen } from './screens/PlayingScreen';
import { ChoiceScreen } from './screens/ChoiceScreen';
import { ResultScreen } from './screens/ResultScreen';
import { FinScreen } from './screens/FinScreen';

export function GameUI() {
  const state = useGameState();

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-10 selection:bg-transparent">
      <AnimatePresence mode="wait">
        {state.phase === 'loading' && <LoadingScreen key="loading" state={state} />}
        {state.phase === 'title' && <TitleScreen key="title" state={state} />}
        {state.phase === 'playing' && <PlayingScreen key="playing" state={state} />}
        {state.phase === 'choice' && <ChoiceScreen key="choice" state={state} />}
        {state.phase === 'result' && <ResultScreen key="result" state={state} />}
        {state.phase === 'fin' && <FinScreen key="fin" state={state} />}
      </AnimatePresence>
      
      {/* Cinematic overlay handles intro, cutscene, ending which just overlay on top of game */}
      <AnimatePresence>
        {(state.phase === 'intro' || state.phase === 'cutscene' || state.phase === 'ending') && (
          <CinematicScreen key="cinematic" state={state} />
        )}
      </AnimatePresence>
    </div>
  );
}
