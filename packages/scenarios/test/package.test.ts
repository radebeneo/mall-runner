import { describe, expect, it } from 'vitest';
import * as scenarios from '../src/index';

describe('@credit-runner/scenarios', () => {
  it('exposes the schema, loader and registry from its entry point', () => {
    expect(scenarios.scenarioFileSchema).toBeDefined();
    expect(scenarios.parseScenario).toBeTypeOf('function');
    expect(scenarios.loadScenarioModules).toBeTypeOf('function');
    expect(scenarios.getScenario).toBeTypeOf('function');
    expect(scenarios.scenarios.length).toBeGreaterThan(0);
  });
});
