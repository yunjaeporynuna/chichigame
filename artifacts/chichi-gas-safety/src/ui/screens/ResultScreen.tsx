import { motion } from 'framer-motion';
import { GameState } from '@/game/types';
import { STR } from '@/game/strings';
import { actions } from '@/game/store';
import { Button } from '../components/Button';
import { ShieldAlert, Zap, PawPrint, Star } from 'lucide-react';

export function ResultScreen({ state }: { state: GameState }) {
  const res = state.result;
  if (!res) return null;

  return (
    <div 
      className="absolute inset-0 bg-background/90 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 sm:p-12 pointer-events-auto overflow-y-auto"
      style={{
        paddingTop: 'calc(1.5rem + env(safe-area-inset-top))',
        paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))'
      }}
    >
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-card border-4 border-card-border/50 rounded-[2rem] p-8 shadow-2xl relative"
      >
        {/* Cat Decor */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="absolute -top-12 left-1/2 -translate-x-1/2 w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center border-4 border-card shadow-sm text-primary"
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5c.67 0 1.35.09 2 .26 1.78-2 5.03-2.84 6.42-2.26 1.4.58-.42 7-.42 7 .57 1.07 1 2.24 1 3.44C21 17.9 16.97 21 12 21s-9-3-9-7.56c0-1.25.5-2.4 1.1-3.48 0 0-1.9-6.42-.5-7 1.39-.58 4.69.23 6.5 2.23A9.04 9.04 0 0 1 12 5Z"/>
            <path d="M8 14v.5"/>
            <path d="M16 14v.5"/>
            <path d="M11.25 16.25h1.5L12 17l-.75-.75Z"/>
          </svg>
        </motion.div>

        <h2 className="text-3xl font-display font-bold text-center mt-6 mb-8 text-foreground">
          {STR.resultTitle}
        </h2>

        {/* Score Area */}
        <div className="flex flex-col items-center bg-white rounded-2xl p-6 shadow-inner border border-black/5 mb-8">
          <span className="text-sm font-bold text-muted-foreground mb-1">{STR.resultTotal}</span>
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", delay: 0.3 }}
            className="flex items-center gap-3 text-5xl font-display font-bold text-primary"
          >
            <Star size={36} fill="currentColor" />
            {res.score.toLocaleString()}
          </motion.div>
          
          <div className="flex items-center gap-2 mt-4 text-sm font-bold text-muted-foreground bg-background px-4 py-1.5 rounded-full">
            <Star size={14} className="text-accent" fill="currentColor" />
            <span>{STR.bestScore} {res.bestScore.toLocaleString()}</span>
            {res.isNewBest && (
              <span className="text-accent px-2 py-0.5 bg-accent/10 rounded-md ml-2 animate-pulse flex items-center gap-1">
                <Star size={12} fill="currentColor" />
                {STR.newBest}
              </span>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <StatBox icon={<ShieldAlert />} label={STR.resultBadges} value={`${res.badges}/4`} delay={0.4} />
          <StatBox icon={<PawPrint />} label={STR.resultEvents} value={res.events} delay={0.5} />
          <StatBox icon={<Zap />} label={STR.resultCombo} value={res.bestCombo} delay={0.6} />
        </div>

        {/* Rank & Comment */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="text-center bg-secondary/10 border-2 border-secondary/20 rounded-2xl p-4 mb-8"
        >
          <div className="font-display text-xl font-bold text-secondary-foreground mb-1">
            {res.rank}
          </div>
          <div className="text-sm text-foreground/80 leading-relaxed">
            {res.comment}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
        >
          <Button size="lg" className="w-full text-xl py-4" onClick={() => actions.toEnding()}>
            {STR.toEnding}
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}

function StatBox({ icon, label, value, delay }: { icon: React.ReactNode; label: string; value: string | number; delay: number }) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay }}
      className="flex flex-col items-center bg-white p-3 rounded-xl shadow-sm border border-black/5"
    >
      <div className="text-primary/70 mb-1">{icon}</div>
      <div className="text-xl font-bold font-display">{value}</div>
      <div className="text-[10px] text-muted-foreground font-bold mt-1 text-center whitespace-nowrap overflow-hidden text-ellipsis w-full">{label}</div>
    </motion.div>
  );
}
