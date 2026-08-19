import { ErrorBoundary } from '@/components/error-boundary';
import { GameCanvas } from '@/game/GameCanvas';
import { GameUI } from '@/ui/GameUI';

/**
 * The whole product is one screen: a full-bleed Three.js canvas with the
 * React overlay UI on top. The engine owns game state; the overlay reads it
 * through `useGameState()` and calls `actions.*`.
 */
function App() {
  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-black">
      <GameCanvas />
      <ErrorBoundary>
        <GameUI />
      </ErrorBoundary>
    </div>
  );
}

export default App;
