import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { GameState } from '@/game/types';
import { STR } from '@/game/strings';
import { actions } from '@/game/store';
import { cutsceneVideoUrl } from '@/game/cutscene-videos';
import { SkipForward } from 'lucide-react';

export function CinematicScreen({ state }: { state: GameState }) {
  const cutscene = state.cutscene;
  const sceneId = cutscene?.id;
  const videoUrl = cutsceneVideoUrl(cutscene?.video);
  // A clip that fails to decode must not black out the scene: drop back to the
  // in-engine cinematic that is already playing underneath.
  const [videoBroken, setVideoBroken] = useState(false);
  useEffect(() => setVideoBroken(false), [sceneId]);

  if (!cutscene) return null;
  const showVideo = Boolean(videoUrl) && !videoBroken;
  const fullScreenVideo =
    showVideo && (sceneId === 'intro' || sceneId === 'ending');

  if (fullScreenVideo) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.45 }}
        className="absolute inset-0 z-40 bg-black pointer-events-auto"
      >
        <video
          key={videoUrl ?? ''}
          src={videoUrl ?? undefined}
          autoPlay
          muted
          playsInline
          preload="auto"
          onError={() => setVideoBroken(true)}
          className="h-full w-full object-contain"
        />
        {cutscene.canSkip && (
          <button
            onClick={() => {
              actions.uiSound('tap');
              actions.skip();
            }}
            className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-black/45 px-4 py-2 text-sm font-bold tracking-widest text-white/70 backdrop-blur-sm transition-colors hover:text-white sm:right-8 sm:top-6"
            style={{
              top: 'calc(1rem + env(safe-area-inset-top))',
              right: 'calc(1rem + env(safe-area-inset-right))',
            }}
          >
            {STR.skip} <SkipForward size={14} />
          </button>
        )}
      </motion.div>
    );
  }

  return (
    <div className="absolute inset-0 z-40 pointer-events-none flex flex-col justify-between">
      {/* Pre-rendered clip, when this scene has one. */}
      {showVideo && (
        <motion.div
          key={`clip-${sceneId}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45 }}
          className="absolute inset-0 bg-black"
        >
          <video
            key={videoUrl ?? ''}
            src={videoUrl ?? undefined}
            autoPlay
            muted
            playsInline
            preload="auto"
            onError={() => setVideoBroken(true)}
            className="w-full h-full object-cover"
          />
        </motion.div>
      )}
      {/* Top Letterbox Bar */}
      <motion.div 
        initial={{ y: '-100%' }}
        animate={{ y: 0 }}
        exit={{ y: '-100%' }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full h-[15vh] bg-black pointer-events-auto relative"
      >
        {cutscene.canSkip && (
          <button
            onClick={() => {
              actions.uiSound('tap');
              actions.skip();
            }}
            className="absolute top-4 right-4 sm:top-6 sm:right-8 text-white/50 hover:text-white text-sm font-bold tracking-widest px-4 py-2 transition-colors flex items-center gap-1"
            style={{ top: 'calc(1rem + env(safe-area-inset-top))', right: 'calc(1rem + env(safe-area-inset-right))' }}
          >
            {STR.skip} <SkipForward size={14} />
          </button>
        )}
      </motion.div>
      
      {/* Bottom Letterbox Bar */}
      <motion.div 
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full h-[25vh] sm:h-[20vh] bg-black pointer-events-auto flex flex-col items-center justify-center px-6 relative"
      >
        <AnimatePresence mode="wait">
          <motion.p
            key={cutscene.caption}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
            className="text-white text-center font-sans text-lg sm:text-2xl max-w-3xl leading-relaxed text-shadow"
          >
            {cutscene.caption}
          </motion.p>
        </AnimatePresence>
        
        {/* Progress Hint */}
        <div className="absolute bottom-4 left-0 right-0 flex justify-center">
          <div className="w-32 h-1 bg-white/20 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-white/60 rounded-full"
              style={{ width: `${cutscene.progress * 100}%` }}
            />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
