import { motion } from 'framer-motion';
import { GameState } from '@/game/types';
import { actions } from '@/game/store';

export function ChoiceScreen({ state }: { state: GameState }) {
  const choice = state.choice;
  if (!choice) return null;

  return (
    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 pointer-events-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-sm bg-card rounded-3xl p-6 sm:p-8 shadow-2xl border-4 border-card-border/50 flex flex-col gap-6 text-center relative overflow-hidden"
      >
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-secondary/10 rounded-full blur-2xl pointer-events-none" />
        
        <h2 className="text-2xl sm:text-3xl font-display font-bold text-foreground relative z-10">
          {choice.title}
        </h2>
        
        <div className="flex flex-col gap-3 relative z-10">
          {choice.options.map((opt, i) => (
            <motion.button
              key={opt.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                actions.uiSound('tap');
                actions.choose(opt.id);
              }}
              className="group relative flex flex-col items-center justify-center p-4 rounded-2xl bg-white border-2 border-primary/20 hover:border-primary/60 shadow-sm hover:shadow-md transition-all text-left"
            >
              <span className="font-bold text-lg text-foreground group-hover:text-primary transition-colors">
                {opt.label}
              </span>
              {opt.hint && (
                <span className="text-sm text-muted-foreground mt-1">
                  {opt.hint}
                </span>
              )}
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
