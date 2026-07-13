import { DEFAULT_OPENROUTER_BASE_URL } from './config.mjs';

const trimTrailingSlash = (value) => String(value || '').replace(/\/+$/, '');
const perMillion = (value) => Number((Number(value) * 1_000_000).toFixed(9));
const samePrice = (left, right) => Math.abs(Number(left) - Number(right)) <= 1e-9;

export const fetchOpenRouterCatalog = async ({
  env = process.env,
  fetchImpl = fetch,
} = {}) => {
  const baseUrl = trimTrailingSlash(env.OPENROUTER_BASE_URL || DEFAULT_OPENROUTER_BASE_URL);
  const response = await fetchImpl(`${baseUrl}/models`, {
    headers: {
      ...(env.OPENROUTER_API_KEY ? { authorization: `Bearer ${env.OPENROUTER_API_KEY}` } : {}),
      'X-Title': env.OPENROUTER_APP_NAME || 'ai-discourse-bench',
    },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`OpenRouter model catalog failed with HTTP ${response.status}: ${body.slice(0, 500)}`);
  }
  const payload = await response.json();
  if (!Array.isArray(payload?.data)) throw new Error('OpenRouter model catalog response did not contain a data array');
  return payload.data;
};

export const auditOpenRouterRoster = ({ modelRoster, catalog, checkedAt = new Date().toISOString() }) => {
  const catalogById = new Map((catalog || []).map((entry) => [entry.id, entry]));
  const errors = [];
  const models = (modelRoster.models || [])
    .filter((model) => model.provider === 'openrouter')
    .map((model) => {
      const catalogEntry = catalogById.get(model.model);
      if (!catalogEntry) {
        errors.push(`${model.id}: OpenRouter model id ${model.model} is not in the current catalog`);
        return { id: model.id, requestedModel: model.model, available: false };
      }
      const canonicalSlug = catalogEntry.canonical_slug || catalogEntry.id;
      if (model.provenance?.modelRevision !== canonicalSlug) {
        errors.push(`${model.id}: declared revision ${model.provenance?.modelRevision || '(missing)'} does not match ${canonicalSlug}`);
      }
      const supportedParameters = Array.isArray(catalogEntry.supported_parameters)
        ? catalogEntry.supported_parameters
        : [];
      if (['auto', 'json_schema'].includes(model.structuredOutput || 'auto')
        && !supportedParameters.includes('structured_outputs')) {
        errors.push(`${model.id}: ${model.model} does not advertise structured_outputs`);
      }
      const inputPerMillion = perMillion(catalogEntry.pricing?.prompt);
      const outputPerMillion = perMillion(catalogEntry.pricing?.completion);
      if (!Number.isFinite(inputPerMillion) || !Number.isFinite(outputPerMillion)) {
        errors.push(`${model.id}: current OpenRouter pricing is unavailable`);
      } else if (!samePrice(model.pricing?.inputPerMillion, inputPerMillion)
        || !samePrice(model.pricing?.outputPerMillion, outputPerMillion)) {
        errors.push(`${model.id}: declared pricing ${model.pricing?.inputPerMillion ?? '(missing)'}/${model.pricing?.outputPerMillion ?? '(missing)'} does not match ${inputPerMillion}/${outputPerMillion} per million tokens`);
      }
      const expirationDate = catalogEntry.expiration_date || null;
      if (expirationDate && expirationDate < checkedAt.slice(0, 10)) {
        errors.push(`${model.id}: ${model.model} expired on ${expirationDate}`);
      }
      return {
        id: model.id,
        requestedModel: model.model,
        available: true,
        canonicalSlug,
        inputPerMillion,
        outputPerMillion,
        supportedParameters,
        expirationDate,
      };
    });
  return {
    kind: 'ai_discourse_bench_openrouter_catalog_audit',
    checkedAt,
    source: 'https://openrouter.ai/api/v1/models',
    errors,
    models,
  };
};
