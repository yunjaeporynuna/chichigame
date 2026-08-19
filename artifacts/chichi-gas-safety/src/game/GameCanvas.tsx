import { useEffect, useRef, useState } from 'react';

import { Game } from './engine';
import { resetActions } from './store';

/** Some sandboxed/headless browsers cannot create a WebGL context at all. */
function supportsWebGL(): boolean {
  try {
    const probe = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (probe.getContext('webgl2') ?? probe.getContext('webgl')),
    );
  } catch {
    return false;
  }
}

/**
 * Mounts the Three.js game onto a full-bleed canvas. The engine owns its own
 * render loop; React never re-renders this component.
 */
export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [webglFailed, setWebglFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!supportsWebGL()) {
      setWebglFailed(true);
      return;
    }

    let game: Game;
    try {
      game = new Game(canvas);
    } catch {
      setWebglFailed(true);
      return;
    }
    void game.init();

    return () => {
      game.dispose();
      resetActions();
    };
  }, []);

  if (webglFailed) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-[#fdf3e7] px-6 text-center">
        <div className="max-w-sm space-y-3">
          <p className="text-2xl font-bold text-[#3f3230]">
            치치가 잠시 숨었어요
          </p>
          <p className="text-sm leading-relaxed text-[#6b5b54]">
            이 브라우저에서는 3D 화면(WebGL)을 켤 수 없어요. 크롬·사파리·엣지
            최신 버전에서 하드웨어 가속을 켠 뒤 다시 열어 주세요.
          </p>
        </div>
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full touch-none"
      aria-label="치치의 가스안전 대작전 게임 화면"
    />
  );
}
