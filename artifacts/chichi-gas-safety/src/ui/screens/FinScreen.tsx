import { motion } from 'framer-motion';
import { GameState } from '@/game/types';
import { STR } from '@/game/strings';
import { actions } from '@/game/store';
import { Button } from '../components/Button';

export function FinScreen({ state }: { state: GameState }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.5 }}
      className="absolute inset-0 bg-black z-50 flex flex-col items-center justify-center pointer-events-auto px-6"
      style={{
        paddingTop: 'calc(1.5rem + env(safe-area-inset-top))',
        paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))'
      }}
    >
      <div className="flex-1 flex flex-col items-center justify-center">
        <motion.h1 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1, duration: 2 }}
          className="text-6xl sm:text-8xl font-display text-white tracking-widest font-bold drop-shadow-lg"
        >
          {STR.fin}
        </motion.h1>
        
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 1.5 }}
          className="mt-6 text-white/60 font-sans tracking-widest text-sm sm:text-base text-center"
        >
          {STR.finNote}
        </motion.p>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 3.5, duration: 1 }}
        className="w-full max-w-md flex flex-col sm:flex-row gap-4 pb-12 sm:pb-20"
      >
        <Button 
          variant="primary" 
          size="lg" 
          className="flex-1 shadow-primary/20"
          onClick={() => actions.restart()}
          soundTone="meow"
        >
          {STR.restart}
        </Button>
        <Button 
          variant="outline" 
          size="lg" 
          className="flex-1 bg-white/10 text-white border-white/20 hover:bg-white/20 backdrop-blur-none"
          onClick={() => actions.toTitle()}
        >
          {STR.toTitle}
        </Button>
      </motion.div>
    </motion.div>
  );
}
