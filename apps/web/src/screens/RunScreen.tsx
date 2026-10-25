// RUNNING in runner mode, following art-direction/gameplay-screen.png: the 3D mall fills the
// screen under the gameplay HUD. The simulation and the Three.js scene live in refs and run on
// requestAnimationFrame; React holds only discrete UI state (the overlay, the stumble notice and
// the points from collected coins), never per-frame values (AGENTS.md section 7, rule 1).
import { formatPoints, formatRand, formatShortDate } from '@credit-runner/finance-engine';
import {
  DEFAULT_RUNNER_CONFIG,
  animationFrameScheduler,
  attachInput,
  createLoop,
  createRunner,
  createStepClock,
  queueAction,
  resetRunner,
  stepRunner,
} from '@credit-runner/game-core';
import type { GameLoop, RunnerState } from '@credit-runner/game-core';
import { Button, Disclaimer, Hud, Icon, ScreenPanel } from '@credit-runner/ui';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import runnerAvatar from '../assets/art/runner-avatar.png';
import { createMallScene } from '../scenes/mall-scene';
import type { MallScene } from '../scenes/mall-scene';
import {
  currentStatementDates,
  hudCardBalance,
  hudPointsWithRun,
  hudTimelineProgress,
  monthShortLabel,
  pendingOffer,
} from '../session/session';
import type { Session } from '../session/session';
import { useGameStore } from '../store/game-store';

type Overlay = 'NONE' | 'PAUSED' | 'CRASHED' | 'UNSUPPORTED';

/** How long the stumble warning stays up, in milliseconds. */
const STUMBLE_NOTICE_MS = 2500;

/** A card over the paused or crashed scene. */
function OverlayCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="absolute inset-0 z-20 flex items-center justify-center bg-hud/55 p-3 backdrop-blur-[2px]"
    >
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}

export function RunScreen({ session }: { session: Session }) {
  const bankRunPoints = useGameStore((store) => store.bankRunPoints);
  const finishRun = useGameStore((store) => store.finishRun);
  const openRunOffer = useGameStore((store) => store.openRunOffer);
  const setMode = useGameStore((store) => store.setMode);

  const [overlay, setOverlay] = useState<Overlay>('NONE');
  const [runPoints, setRunPoints] = useState(0);
  const [stumbled, setStumbled] = useState(false);

  const hasOffer = pendingOffer(session) !== undefined;

  const surfaceRef = useRef<HTMLDivElement>(null);
  const offerLabelRef = useRef<HTMLDivElement>(null);
  const runnerRef = useRef<RunnerState | null>(null);
  const sceneRef = useRef<MallScene | null>(null);
  const loopRef = useRef<GameLoop | null>(null);
  const overlayRef = useRef<Overlay>('NONE');
  const hasOfferRef = useRef(hasOffer);
  const seedRef = useRef(session.cycle.monthIndex + 1);
  const attemptRef = useRef(0);

  // Builds the scene, the simulation and the loop once per mount.
  useEffect(() => {
    const surface = surfaceRef.current;
    if (surface === null) return undefined;

    let scene: MallScene;
    try {
      scene = createMallScene(surface, DEFAULT_RUNNER_CONFIG);
    } catch {
      setOverlay('UNSUPPORTED');
      return undefined;
    }
    scene.showOffers = hasOfferRef.current;

    let stumbleTimer: number | undefined;
    const runner = createRunner(DEFAULT_RUNNER_CONFIG, seedRef.current, {
      onCoin: (points) => {
        setRunPoints(points);
      },
      onStumble: () => {
        setStumbled(true);
        window.clearTimeout(stumbleTimer);
        stumbleTimer = window.setTimeout(() => {
          setStumbled(false);
        }, STUMBLE_NOTICE_MS);
      },
      onCrash: () => {
        setStumbled(false);
        setOverlay('CRASHED');
      },
    });

    // The offer label follows the bag on screen. It is written to the DOM only when it changes.
    const label = offerLabelRef.current;
    let labelShown = false;
    let labelX = Number.NaN;
    let labelY = Number.NaN;

    const clock = createStepClock();
    const loop = createLoop(
      {
        update: (dt) => {
          stepRunner(runner, dt);
        },
        render: (alpha) => {
          scene.render(runner, alpha * clock.step);
          if (label === null) return;
          const marker = scene.offer;
          if (marker.visible !== labelShown) {
            labelShown = marker.visible;
            label.hidden = !labelShown;
          }
          if (!labelShown) return;
          const x = Math.round(marker.x);
          const y = Math.round(marker.y);
          if (x === labelX && y === labelY) return;
          labelX = x;
          labelY = y;
          label.style.transform = `translate(${String(x)}px, ${String(y)}px) translate(-50%, -100%)`;
        },
      },
      animationFrameScheduler,
      clock,
    );

    const resize = (): void => {
      scene.resize(surface.clientWidth, surface.clientHeight);
    };
    resize();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    observer?.observe(surface);
    window.addEventListener('resize', resize);

    // Escape or P pauses; Escape resumes from the pause card.
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' && event.key !== 'p' && event.key !== 'P') return;
      if (overlayRef.current === 'NONE') {
        event.preventDefault();
        setOverlay('PAUSED');
      } else if (overlayRef.current === 'PAUSED' && event.key === 'Escape') {
        event.preventDefault();
        setOverlay('NONE');
      }
    };
    window.addEventListener('keydown', onKey);

    // Leaving the tab pauses the run.
    const onVisibility = (): void => {
      if (document.hidden && overlayRef.current === 'NONE') setOverlay('PAUSED');
    };
    document.addEventListener('visibilitychange', onVisibility);

    runnerRef.current = runner;
    sceneRef.current = scene;
    loopRef.current = loop;
    loop.start();

    return () => {
      loop.stop();
      window.clearTimeout(stumbleTimer);
      observer?.disconnect();
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVisibility);
      scene.dispose();
      runnerRef.current = null;
      sceneRef.current = null;
      loopRef.current = null;
    };
  }, []);

  // The loop and swipe/keyboard input run only while no card is open.
  useEffect(() => {
    overlayRef.current = overlay;
    const runner = runnerRef.current;
    const loop = loopRef.current;
    const surface = surfaceRef.current;
    if (runner === null || loop === null || surface === null) return undefined;
    if (overlay !== 'NONE') {
      loop.stop();
      return undefined;
    }
    loop.start();
    return attachInput({ surface, keyboard: window }, (action) => {
      queueAction(runner, action);
    });
  }, [overlay]);

  useEffect(() => {
    hasOfferRef.current = hasOffer;
    if (sceneRef.current !== null) sceneRef.current.showOffers = hasOffer;
  }, [hasOffer]);

  const collected = (): number => runnerRef.current?.points ?? 0;

  const runAgain = (): void => {
    const runner = runnerRef.current;
    if (runner === null) return;
    // The coins from the crashed run are kept.
    bankRunPoints(runner.points);
    attemptRef.current += 1;
    resetRunner(runner, seedRef.current + attemptRef.current * 101);
    setRunPoints(0);
    setOverlay('NONE');
  };

  if (overlay === 'UNSUPPORTED') {
    return (
      <div className="min-h-dvh px-3 py-6 sm:px-5">
        <div className="mx-auto max-w-xl">
          <ScreenPanel
            icon={{ name: 'alert', tone: 'amber' }}
            title="The 3D mall can’t start here."
            intro="This browser or device could not start the runner. Every money decision still works without it."
          >
            <Button
              onClick={() => {
                setMode('DECISIONS');
              }}
            >
              Play decisions only
            </Button>
            <Disclaimer variant="mint" />
          </ScreenPanel>
        </div>
      </div>
    );
  }

  const dates = currentStatementDates(session);

  return (
    <div className="fixed inset-0 overflow-hidden bg-mall">
      {/* The game surface: swipes land here (AGENTS.md section 7, rule 5). */}
      <div
        ref={surfaceRef}
        aria-hidden="true"
        className="absolute inset-0 touch-none overscroll-none select-none"
      />

      <div className="pointer-events-none relative z-10 [&_button]:pointer-events-auto">
        <Hud
          variant="gameplay"
          month={monthShortLabel(session)}
          cardBalance={formatRand(hudCardBalance(session))}
          points={formatPoints(hudPointsWithRun(session, runPoints))}
          statementCloses={formatShortDate(dates.closes)}
          paymentDue={formatShortDate(dates.due)}
          progress={hudTimelineProgress(session)}
          avatarSrc={runnerAvatar}
          onPause={() => {
            setOverlay('PAUSED');
          }}
        />
      </div>

      <div
        ref={offerLabelRef}
        hidden
        className="pointer-events-none absolute left-0 top-0 z-10 will-change-transform"
      >
        <p className="mb-2 flex items-center gap-2 whitespace-nowrap rounded-2xl border-2 border-offer bg-white/95 px-3 py-2 text-sm font-extrabold text-ink shadow-pill sm:px-4 sm:text-base">
          <Icon name="tag" strokeWidth={2.5} className="size-5 shrink-0 text-accent" />
          An offer ahead — stop and check?
        </p>
      </div>

      <div
        role="status"
        className="pointer-events-none absolute inset-x-0 top-[38%] z-10 flex justify-center px-4"
      >
        {stumbled && (
          <p className="rounded-2xl bg-danger px-4 py-2 text-center text-base font-extrabold text-white shadow-pill">
            Stumble! Another hit soon after ends the run.
          </p>
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <p className="flex items-center gap-3 rounded-2xl border border-white/15 bg-hud/85 px-4 py-2.5 text-sm font-semibold text-white shadow-pill backdrop-blur-sm sm:gap-4 sm:text-base">
          <span className="font-extrabold">Swipe</span>
          <span className="sr-only">or use the arrow keys:</span>
          <span>
            <span aria-hidden="true">← →</span> Change lane
          </span>
          <span>
            <span aria-hidden="true">↑</span> Jump
          </span>
          <span>
            <span aria-hidden="true">↓</span> Roll
          </span>
        </p>
        <p
          role="note"
          className="max-w-md rounded-xl bg-hud/80 px-3 py-1.5 text-center text-xs leading-snug text-white"
        >
          Fictional learning scenario. Amounts and dates are for practice only.
        </p>
      </div>

      {overlay === 'PAUSED' && (
        <OverlayCard label="Paused">
          <ScreenPanel
            icon={{ name: 'pause', tone: 'green' }}
            title="Paused"
            intro="Your run waits here until you are ready."
          >
            <Button
              onClick={() => {
                setOverlay('NONE');
              }}
            >
              Resume
            </Button>
            {hasOffer && (
              <Button
                variant="secondary"
                onClick={() => {
                  openRunOffer(collected());
                }}
              >
                See the offer
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => {
                finishRun(collected());
              }}
            >
              Finish shopping
            </Button>
            <Disclaimer variant="mint" />
          </ScreenPanel>
        </OverlayCard>
      )}

      {overlay === 'CRASHED' && (
        <OverlayCard label="You took a tumble">
          <ScreenPanel
            icon={{ name: 'alert', tone: 'red' }}
            title="You took a tumble."
            intro="Two hits close together end a run. Your coins are kept."
          >
            <p className="text-base text-ink">
              Points from this run: <strong>{formatPoints(runPoints)}</strong>
            </p>
            <Button onClick={runAgain}>Run again</Button>
            <Button
              variant="secondary"
              onClick={() => {
                finishRun(collected());
              }}
            >
              Finish shopping
            </Button>
            <Disclaimer variant="mint" />
          </ScreenPanel>
        </OverlayCard>
      )}
    </div>
  );
}
