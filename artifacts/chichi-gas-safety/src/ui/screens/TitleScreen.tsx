import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { GameState } from '@/game/types';
import { STR } from '@/game/strings';
import { actions } from '@/game/store';
import introScreen from '@/assets/intro-screen.png';
import { Music, Volume2, VolumeX, X } from 'lucide-react';

export function TitleScreen({ state }: { state: GameState }) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.5 } }}
      className="absolute inset-0 z-30 flex items-center justify-center overflow-hidden bg-black pointer-events-auto"
    >
      <div
        className="relative shrink-0"
        style={{ width: 'min(100vw, 176.842vh)', aspectRatio: '2688 / 1520' }}
      >
        <img
          src={introScreen}
          alt="치치의 가스안전 대작전 시작 화면"
          className="absolute inset-0 h-full w-full object-contain"
        />

        <button
          aria-label={STR.start}
          onClick={() => {
            actions.start();
          }}
          className="absolute left-[39%] top-[61%] h-[14%] w-[29%] cursor-pointer rounded-full bg-transparent focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-amber-300"
        />

        <button
          aria-label="설정"
          onClick={() => {
            actions.uiSound('tap');
            setSettingsOpen(true);
          }}
          className="absolute left-[45%] top-[78%] h-[10%] w-[18%] cursor-pointer rounded-full bg-transparent focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white"
        />
      </div>

      <AnimatePresence>
        {settingsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 flex items-center justify-center bg-black/55 px-5 backdrop-blur-sm"
            onClick={() => setSettingsOpen(false)}
          >
            <motion.div
              initial={{ y: 18, scale: 0.96 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 18, scale: 0.96 }}
              className="relative w-full max-w-sm rounded-3xl border border-white/25 bg-neutral-950/90 p-7 text-white shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                onClick={() => setSettingsOpen(false)}
                className="absolute right-4 top-4 rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white"
                aria-label="설정 닫기"
              >
                <X size={20} />
              </button>
              <h2 className="mb-6 text-center text-2xl font-bold">설정</h2>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => actions.toggleBgm()}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 py-4 font-bold hover:bg-white/20"
                >
                  <Music size={20} />
                  배경음 {state.settings.bgm ? '켜짐' : '꺼짐'}
                </button>
                <button
                  onClick={() => actions.toggleSfx()}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 py-4 font-bold hover:bg-white/20"
                >
                  {state.settings.sfx ? <Volume2 size={20} /> : <VolumeX size={20} />}
                  효과음 {state.settings.sfx ? '켜짐' : '꺼짐'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
