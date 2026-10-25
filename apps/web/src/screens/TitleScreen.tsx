// The title screen. There is no mockup for it, so it reuses the decision screens' visual
// language: the cream panel, coloured icon tiles and the mint disclaimer. The player chooses the
// runner or the decisions-only mode (AGENTS.md section 7, rule 7).
import { Button, Disclaimer, IconTile, ScreenPanel } from '@credit-runner/ui';
import type { IconName, TileTone } from '@credit-runner/ui';
import { loadStarterScenario } from '../session/session';
import { useGameStore } from '../store/game-store';

interface Step {
  icon: IconName;
  tone: TileTone;
  title: string;
  body: string;
}

const STEPS: readonly Step[] = [
  {
    icon: 'bag',
    tone: 'green',
    title: 'Run the mall',
    body: 'Dodge obstacles and collect coins. Your purchases go on the card; watch for offers and surprise costs.',
  },
  {
    icon: 'document',
    tone: 'purple',
    title: 'Get your statement',
    body: 'See what you owe, when the statement closed and when payment is due.',
  },
  {
    icon: 'calculator',
    tone: 'amber',
    title: 'Plan a payment',
    body: 'Choose how much to pay, then see what happens next month.',
  },
  {
    icon: 'bulb',
    tone: 'blue',
    title: 'Check what you learned',
    body: 'A short quiz ends the three-month run.',
  },
];

export function TitleScreen() {
  const start = useGameStore((store) => store.start);
  const scenario = loadStarterScenario();

  return (
    <ScreenPanel
      badge="Fictional learning game"
      icon={{ name: 'card', tone: 'green' }}
      title="Credit Runner"
      intro={scenario.summary}
    >
      <section
        aria-labelledby="title-how"
        className="rounded-2xl border border-line bg-cream-card p-3 sm:p-4"
      >
        <h2 id="title-how" className="text-lg font-bold text-ink sm:text-xl">
          {scenario.title}
        </h2>
        <ol className="mt-3 flex flex-col gap-3">
          {STEPS.map((step) => (
            <li key={step.title} className="flex items-start gap-3">
              <IconTile name={step.icon} tone={step.tone} size="sm" />
              <span className="min-w-0 text-sm leading-snug text-ink sm:text-base">
                <span className="block font-bold">{step.title}</span>
                {step.body}
              </span>
            </li>
          ))}
        </ol>
      </section>
      <Button
        onClick={() => {
          start('RUNNER');
        }}
      >
        Start running
      </Button>
      <Button
        variant="secondary"
        onClick={() => {
          start('DECISIONS');
        }}
      >
        Decisions only
      </Button>
      <p className="text-center text-sm leading-snug text-ink-muted">
        Decisions only skips the runner and goes straight to each month’s choices.
      </p>
      <Disclaimer variant="mint" />
    </ScreenPanel>
  );
}
