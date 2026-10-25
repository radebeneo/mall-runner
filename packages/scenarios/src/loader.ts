import { validateScenarioConfig } from '@credit-runner/finance-engine';
import type { ScenarioConfig } from '@credit-runner/finance-engine';
import { scenarioFileSchema } from './schema';

/** A validated scenario file. All amounts and rates are fictional. */
export interface Scenario {
  schemaVersion: 1;
  title: string;
  summary: string;
  /** Display-only label for the existing commitments, e.g. "clothing + phone". */
  commitmentsNote?: string | undefined;
  config: ScenarioConfig;
}

export class ScenarioValidationError extends Error {
  override name = 'ScenarioValidationError';

  constructor(
    /** Where the data came from, e.g. a file name. */
    readonly source: string,
    /** One readable line per problem, each starting with the field path. */
    readonly issues: readonly string[],
  ) {
    super(`Invalid scenario "${source}":\n${issues.map((issue) => `  - ${issue}`).join('\n')}`);
  }
}

/**
 * Validates unknown data (usually parsed JSON) as a scenario. Throws a ScenarioValidationError that
 * lists every problem, so an author can fix a file in one pass.
 */
export function parseScenario(data: unknown, source = 'scenario'): Scenario {
  const result = scenarioFileSchema.safeParse(data);
  if (!result.success) {
    throw new ScenarioValidationError(
      source,
      result.error.issues.map((issue) => {
        const path = issue.path.map(String).join('.');
        return `${path === '' ? '(file)' : path}: ${issue.message}`;
      }),
    );
  }
  // The engine's own checks run too, so the schema and the engine can never disagree silently.
  validateScenarioConfig(result.data.config);
  const scenario: Scenario = result.data;
  return scenario;
}

/**
 * Validates a set of scenario modules keyed by file path. Results are sorted by path so the order
 * is stable. Scenario ids must be unique across files.
 */
export function loadScenarioModules(modules: Readonly<Record<string, unknown>>): Scenario[] {
  const byId = new Map<string, string>();
  return Object.keys(modules)
    .sort()
    .map((path) => {
      const scenario = parseScenario(modules[path], path);
      const clash = byId.get(scenario.config.id);
      if (clash !== undefined) {
        throw new ScenarioValidationError(path, [
          `config.id: "${scenario.config.id}" is already used by ${clash}`,
        ]);
      }
      byId.set(scenario.config.id, path);
      return scenario;
    });
}
