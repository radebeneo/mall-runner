import { loadScenarioModules } from './loader';
import type { Scenario } from './loader';

// Every JSON file in packages/scenarios/data is bundled and validated at load time. Adding a
// scenario means adding a file there; no code changes are needed (AGENTS.md section 5).
const modules = import.meta.glob<unknown>('../data/*.json', { eager: true, import: 'default' });

export const STARTER_SCENARIO_ID = 'starter-3-month';

/** All bundled scenarios, validated. Loading fails loudly if any file is invalid. */
export const scenarios: readonly Scenario[] = loadScenarioModules(modules);

export function getScenario(id: string): Scenario | undefined {
  return scenarios.find((scenario) => scenario.config.id === id);
}
