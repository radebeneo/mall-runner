// Scenario content as JSON, validated with Zod at load time (AGENTS.md section 5).
export {
  SCENARIO_SCHEMA_VERSION,
  calendarMonthSchema,
  scenarioConfigSchema,
  scenarioEventSchema,
  scenarioFileSchema,
  scenarioOfferSchema,
  scenarioPurchaseSchema,
} from './schema';
export { ScenarioValidationError, loadScenarioModules, parseScenario } from './loader';
export type { Scenario } from './loader';
export { STARTER_SCENARIO_ID, getScenario, scenarios } from './registry';
