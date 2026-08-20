import { readJsonFile } from '../src/io.mjs';
import { auditOpenRouterRoster, fetchOpenRouterCatalog } from '../src/openrouter-catalog.mjs';
import { throwIfErrors, validateModelRoster } from '../src/schema.mjs';

const rosterPath = process.env.AIDB_MODEL_ROSTER || './data/model-roster.openrouter.sample.json';
const modelRoster = await readJsonFile(rosterPath);
throwIfErrors('model roster', validateModelRoster(modelRoster));

const audit = auditOpenRouterRoster({
  modelRoster,
  catalog: await fetchOpenRouterCatalog(),
});
console.log(JSON.stringify(audit, null, 2));
throwIfErrors('OpenRouter roster preflight', audit.errors);
