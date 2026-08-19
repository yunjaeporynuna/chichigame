import { motion, AnimatePresence } from 'framer-motion';
import { GameState } from '@/game/types';
import { STR } from '@/game/strings';
import { actions } from '@/game/store';
import { cn } from '@/lib/utils';
import { Clock, Star, Zap, PawPrint, ShieldAlert } from 'lucide-react';

export function PlayingScreen({ state }: { state: GameState }) {
  return (
    <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
      
      {/* Warning Glow */}
      <div 
        className="absolute inset-0 pointer-events-none transition-opacity duration-300 pointer-events-none"
        style={{ 
          opacity: state.warning,
          boxShadow: 'inset 0 0 100px rgba(255, 50, 50, 0.4)'
        }}
      />
      
      {/* Golden Time Overlay */}
      <AnimatePresence>
        {state.goldenTime && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none border-4 border-accent/50 bg-accent/5 z-0"
          />
        )}
      </AnimatePresence>

      <div className="absolute inset-safe p-4 sm:p-6 flex flex-col justify-between h-full z-10">
        
        {/* Top HUD */}
        <div className="flex justify-between items-start">
          
          {/* Top Left: Time & Score */}
          <div className="flex flex-col gap-2">
            <div className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/80 backdrop-blur-md shadow-sm border-2 font-bold text-lg",
              state.timeLeft <= 10 ? "border-destructive text-destructive animate-pulse" : "border-transparent text-foreground"
            )}>
              <Clock size={20} className={state.timeLeft <= 10 ? "animate-bounce" : ""} />
              <span className="w-10 text-center">{Math.ceil(state.timeLeft)}</span>
            </div>
            
            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/80 backdrop-blur-md shadow-sm border-2 border-transparent font-bold text-lg">
              <Star size={20} className="text-accent" fill="currentColor" />
              <span>{state.score.toLocaleString()}</span>
            </div>
            
            <AnimatePresence>
              {state.combo > 1 && (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground shadow-md font-bold mt-1 relative overflow-hidden"
                >
                  <Zap size={16} fill="currentColor" className="animate-pulse" />
                  <span>{state.combo} Combo!</span>
                  {/* Combo Fuel Bar */}
                  <div className="absolute bottom-0 left-0 h-1 bg-white/40" style={{ width: `${state.comboFuel * 100}%` }} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Top Right: Badges & Stickers */}
          <div className="flex flex-col gap-2 items-end">
            <div className="flex items-center gap-1 bg-white/80 backdrop-blur-md p-2 rounded-2xl shadow-sm border-2 border-transparent">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                  i < state.badges ? "bg-secondary text-secondary-foreground shadow-inner scale-110" : "bg-black/5 text-black/20"
                )}>
                  <ShieldAlert size={16} fill={i < state.badges ? "currentColor" : "none"} />
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 bg-white/80 backdrop-blur-md px-3 py-1.5 rounded-2xl shadow-sm border-2 border-transparent text-sm font-bold">
              <PawPrint size={16} className="text-accent" fill="currentColor" />
              <span>{state.stickers} / {state.stickerGoal}</span>
            </div>
          </div>
        </div>

        {/* Center Bottom: Interact Prompt */}
        <div className="flex-1 flex flex-col justify-end items-center pb-8 sm:pb-4 pointer-events-none">
          <AnimatePresence>
            {state.prompt && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.9 }}
                className={cn(
                  "px-6 py-3 rounded-full font-bold shadow-lg flex items-center gap-3 backdrop-blur-md pointer-events-auto",
                  !state.isTouch && "border-b-4", // Only show border interaction affordance on desktop where they press space
                  state.prompt.kind === 'gas' ? "bg-destructive/90 text-destructive-foreground border-destructive-foreground/30" : "bg-white/90 text-foreground border-black/10"
                )}
                onClick={() => state.isTouch && actions.interact()} // Tap prompt itself acts as interact on touch if they miss the big button
              >
                {!state.isTouch && (
                  <kbd className="bg-black/10 px-2 py-1 rounded text-xs uppercase font-mono">
                    {state.prompt.requiresJump ? 'SPACE ×2' : 'SPACE'}
                  </kbd>
                )}
                <span className="text-lg">{state.prompt.label}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Floating Elements (Toast, ScorePops) */}
      <AnimatePresence>
        {state.toast && (
          <motion.div
            key={state.toast}
            initial={{ opacity: 0, y: -50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="absolute top-1/4 left-1/2 -translate-x-1/2 px-6 py-3 bg-foreground/90 text-background rounded-full font-bold shadow-xl z-30"
          >
            {state.toast}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {state.scorePops.map((pop) => (
          <motion.div
            key={pop.id}
            initial={{ opacity: 1, y: 0, scale: 0.5 }}
            animate={{ opacity: 0, y: -50, scale: 1.2 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className={cn(
              "absolute font-display font-bold text-2xl z-20 pointer-events-none drop-shadow-md",
              pop.tone === 'golden' ? "text-accent drop-shadow-glow" :
              pop.tone === 'safety' ? "text-secondary drop-shadow-glow" :
              "text-white"
            )}
            style={{ left: `${pop.x}%`, top: `${pop.y}%`, transform: 'translate(-50%, -50%)' }}
          >
            {pop.text}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Mobile Controls */}
      {state.isTouch && (
        <>
          {/* Virtual Joystick Visual */}
          <AnimatePresence>
            {state.joystick.active && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 0.4, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute w-24 h-24 rounded-full border-4 border-white/50 bg-black/10 z-10 pointer-events-none flex items-center justify-center"
                style={{ 
                  left: state.joystick.cx - 48, 
                  top: state.joystick.cy - 48 
                }}
              >
                <div 
                  className="w-10 h-10 rounded-full bg-white shadow-sm"
                  style={{
                    transform: `translate(${state.joystick.dx}px, ${state.joystick.dy}px)`
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Right Thumb Interact Button */}
          <div className="absolute bottom-8 right-8 sm:bottom-12 sm:right-12 z-20 pointer-events-auto" style={{ bottom: 'calc(2rem + env(safe-area-inset-bottom))', right: 'calc(2rem + env(safe-area-inset-right))' }}>
            <button
              onClick={() => {
                actions.uiSound('tap');
                actions.interact();
              }}
              disabled={!state.prompt}
              className={cn(
                "w-20 h-20 rounded-full shadow-xl flex items-center justify-center transition-all duration-200",
                state.prompt 
                  ? (state.prompt.kind === 'gas' ? "bg-destructive text-white active:scale-95" : "bg-primary text-white active:scale-95")
                  : "bg-black/20 text-white/50 border-2 border-white/20"
              )}
            >
              <PawPrint size={32} fill={state.prompt ? "currentColor" : "none"} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
