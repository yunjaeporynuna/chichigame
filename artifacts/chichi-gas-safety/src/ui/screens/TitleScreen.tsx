import { motion } from 'framer-motion';
import { GameState } from '@/game/types';
import { STR } from '@/game/strings';
import { actions } from '@/game/store';
import { Button } from '../components/Button';
import { Volume2, VolumeX, Music, Star } from 'lucide-react';

export function TitleScreen({ state }: { state: GameState }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.5 } }}
      className="absolute inset-0 bg-background/40 backdrop-blur-[2px] flex flex-col items-center justify-between pointer-events-auto"
      style={{
        paddingTop: 'calc(3rem + env(safe-area-inset-top))',
        paddingBottom: 'calc(3rem + env(safe-area-inset-bottom))',
        paddingLeft: 'calc(1.5rem + env(safe-area-inset-left))',
        paddingRight: 'calc(1.5rem + env(safe-area-inset-right))'
      }}
    >
      {/* Settings Row */}
      <div className="w-full max-w-4xl flex justify-end gap-3">
        <button
          onClick={() => {
            actions.uiSound('tap');
            actions.toggleBgm();
          }}
          className="p-3 bg-white/70 backdrop-blur-sm rounded-full shadow-sm text-foreground hover:bg-white transition-colors"
          aria-label={STR.bgm}
        >
          {state.settings.bgm ? <Music size={20} /> : <div className="relative"><Music size={20} className="opacity-40" /><div className="absolute inset-0 border-t-2 border-foreground transform rotate-45 origin-center"></div></div>}
        </button>
        <button
          onClick={() => {
            actions.uiSound('tap');
            actions.toggleSfx();
          }}
          className="p-3 bg-white/70 backdrop-blur-sm rounded-full shadow-sm text-foreground hover:bg-white transition-colors"
          aria-label={STR.sfx}
        >
          {state.settings.sfx ? <Volume2 size={20} /> : <VolumeX size={20} className="opacity-50" />}
        </button>
      </div>

      {/* Main Title Area */}
      <div className="flex flex-col items-center text-center gap-6 mt-10">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, type: "spring" }}
          className="space-y-4"
        >
          <div className="inline-block px-4 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-bold mb-2">
            {STR.subtitle}
          </div>
          <h1 className="text-5xl sm:text-7xl font-display font-bold text-foreground drop-shadow-sm">
            {STR.title}
          </h1>
        </motion.div>
        
        {state.bestScore > 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex items-center gap-2 text-muted-foreground bg-white/60 px-4 py-2 rounded-2xl shadow-sm mt-4 font-bold"
          >
            <Star size={16} className="text-accent" fill="currentColor" />
            <span>{STR.bestScore}</span>
            <span className="text-primary">{state.bestScore.toLocaleString()}</span>
          </motion.div>
        )}
      </div>

      {/* Controls & CTA */}
      <div className="flex flex-col items-center gap-8 mb-10 w-full max-w-md">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="w-full"
        >
          <Button 
            size="lg" 
            className="w-full py-5 text-2xl shadow-xl shadow-primary/20"
            onClick={() => actions.start()}
            soundTone="meow"
          >
            {STR.start}
          </Button>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center text-sm sm:text-base text-muted-foreground/80 font-medium bg-white/40 px-6 py-3 rounded-2xl backdrop-blur-sm"
        >
          {state.isTouch ? STR.controlsTouch : STR.controlsDesktop}
        </motion.div>
      </div>
    </motion.div>
  );
}
