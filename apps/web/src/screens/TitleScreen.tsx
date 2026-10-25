import { Button, Callout, Disclaimer, ScreenPanel } from '@credit-runner/ui';
import { loadStarterScenario } from '../session/session';
import { useGameStore } from '../store/game-store';

export function TitleScreen() {
  const start = useGameStore((store) => store.start);
  const scenario = loadStarterScenario();

  return (
    <ScreenPanel badge="Decisions-only mode" title="Credit Runner" intro={scenario.summary}>
      <Callout tone="info" title={scenario.title}>
        Each month you shop at the mall, handle surprise costs and offers, then get your card
        statement and plan a payment. A short quiz ends the run.
      </Callout>
      <Button onClick={start}>Start</Button>
      <Disclaimer />
    </ScreenPanel>
  );
}
