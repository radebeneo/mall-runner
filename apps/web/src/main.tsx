import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';
import { preloadMallArt } from './scenes/mall-art';

// Load the mall art while the player reads the title screen, away from the game loop. A run
// that starts before it finishes draws the procedural mall instead.
void preloadMallArt();

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element #root not found');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
