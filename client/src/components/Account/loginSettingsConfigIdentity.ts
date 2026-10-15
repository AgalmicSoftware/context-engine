import { resolveValidatedWorkerCanonicalLoginConfig } from './loginAndSettingsAgentTokenActions';
import { normalizeSettingsSessionSlug } from './loginSettingsRouteHelpers';

// Registry display configs are rebuilt during cache hydration. Only a changed
// verified Worker identity/revision changes the config consumed by the read.
export const getLoginSettingsSponsoredConfigKey = (sessionConfig: unknown): string => {
  const verified = resolveValidatedWorkerCanonicalLoginConfig({
    sessionConfig,
    normalizeSessionSlug: normalizeSettingsSessionSlug,
  });
  return verified
    ? JSON.stringify([verified.slug, verified.sessionId, verified.corsWorkerUrl, verified.configRevision])
    : '';
};
