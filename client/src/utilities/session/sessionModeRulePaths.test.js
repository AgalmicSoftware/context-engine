import { validateSessionModeProfile } from './sessionModeProfile';
import { RULE_FIXTURES, registry } from './sessionModeRuleFixtures.testUtils';
import { validateWorkerConfigModeValues } from '../../../../workers/shared/workerConfigModeValidation.mjs';
import {
  WORKER_MODE_PATH_RULE_CODES,
  parseWorkerModeErrorPath,
  ruleCodeForWorkerModePath,
} from '@ce-shared/sessionModeRulePaths.mjs';

const workerPath = (profile) =>
  validateWorkerConfigModeValues({ sessionModeProfile: profile }, { allowPartialProfileStorage: true }).path;

describe('Worker mode paths map to rules-table codes', () => {
  it.each(Object.entries(RULE_FIXTURES))('%s', (code, profile) => {
    const { issues } = validateSessionModeProfile(profile);
    const issue = issues.find((entry) => entry.code === code);
    expect(issue).toBeDefined();
    const path = workerPath(profile);
    expect(path).toBe(`sessionModeProfile.${issue.path}`);
    expect(WORKER_MODE_PATH_RULE_CODES[path]).toContain(code);
    expect(ruleCodeForWorkerModePath(path, issues)).toBe(code);
  });

  it('maps only observed paths to known codes and falls back to the first code', () => {
    const observed = Object.values(RULE_FIXTURES).map(workerPath);
    expect(Object.keys(WORKER_MODE_PATH_RULE_CODES).sort()).toEqual([...new Set(observed)].sort());
    expect(Object.values(WORKER_MODE_PATH_RULE_CODES).flat().sort()).toEqual(Object.keys(RULE_FIXTURES).sort());
    expect(ruleCodeForWorkerModePath('sessionModeProfile.storage.backend')).toBe(
      'worker_authority_requires_cloudflare',
    );
    expect(ruleCodeForWorkerModePath('sessionModeProfile.surfaces.web')).toBe('');
  });

  it('reads the path from both Worker error messages', () => {
    expect(parseWorkerModeErrorPath('Invalid session config mode at sessionModeProfile.identity.')).toBe(
      'sessionModeProfile.identity',
    );
    expect(parseWorkerModeErrorPath('Invalid deployment mode at sessionModeProfile.evm.registryChainId.')).toBe(
      'sessionModeProfile.evm.registryChainId',
    );
    expect(parseWorkerModeErrorPath('Unsupported worker-canonical session config field: ai.')).toBe('');
    expect(parseWorkerModeErrorPath(undefined)).toBe('');
  });

  it('keeps the client-only Cloudflare rule for Worker encryption', () => {
    const profile = registry((entry) => {
      entry.encryption = { mode: 'worker_envelope', keyProvider: 'worker_secret' };
      entry.results.visibility = 'participant_aggregate';
    });
    expect(validateSessionModeProfile(profile).issues.map((issue) => issue.code)).toContain(
      'worker_envelope_requires_cloudflare',
    );
    expect(
      validateWorkerConfigModeValues({ sessionModeProfile: profile }, { allowPartialProfileStorage: true }),
    ).toEqual({
      ok: true,
    });
  });
});
