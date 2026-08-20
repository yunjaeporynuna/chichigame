import { motion } from 'framer-motion';
import { GameState } from '@/game/types';
import { STR } from '@/game/strings';
import { actions } from '@/game/store';
import { Button } from '../components/Button';
import endingCard from '@/assets/ending-card.png';

export function FinScreen({ state }: { state: GameState }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1 }}
      className="absolute inset-0 z-50 flex items-center justify-center overflow-hidden bg-black pointer-events-auto"
    >
      <img
        src={endingCard}
        alt={`${STR.fin} — ${STR.finNote}`}
        className="absolute inset-0 h-full w-full object-contain"
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.3, duration: 0.7 }}
        className="absolute bottom-4 right-4 flex gap-2 sm:bottom-6 sm:right-6"
        style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        <Button
          variant="primary"
          className="border border-amber-300/30 bg-amber-500/90 px-4 py-2 text-sm text-black shadow-xl hover:bg-amber-400 sm:px-5"
          onClick={() => actions.restart()}
          soundTone="meow"
        >
          {STR.restart}
        </Button>
        <Button
          variant="outline"
          className="border-white/25 bg-black/55 px-4 py-2 text-sm text-white backdrop-blur-sm hover:bg-white/15 sm:px-5"
          onClick={() => actions.toTitle()}
        >
          {STR.toTitle}
        </Button>
      </motion.div>
    </motion.div>
  );
}
