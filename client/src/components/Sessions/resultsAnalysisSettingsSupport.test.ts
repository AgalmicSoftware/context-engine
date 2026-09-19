import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../utilities/session/sessionModeProfile';
import {
  getBackgroundResultsAnalysisUnsupportedReason,
  supportsBackgroundResultsAnalysis,
} from './resultsAnalysisSettingsSupport';

describe('resultsAnalysisSettingsSupport', () => {
  it('recognizes reachable Worker-canonical Cloudflare profiles through capability projection', () => {
    expect(
      supportsBackgroundResultsAnalysis({
        sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
      }),
    ).toBe(true);
  });

  it('explains why registry and non-Cloudflare profiles cannot use background automatic runs', () => {
    expect(
      supportsBackgroundResultsAnalysis({
        sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED),
      }),
    ).toBe(false);
    expect(
      getBackgroundResultsAnalysisUnsupportedReason({
        sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED),
      }),
    ).toMatch(/Worker-canonical Cloudflare/);

    const workerArweaveProfile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    workerArweaveProfile.storage.backend = 'arweave';
    expect(supportsBackgroundResultsAnalysis({ sessionModeProfile: workerArweaveProfile })).toBe(false);
    expect(getBackgroundResultsAnalysisUnsupportedReason({ sessionModeProfile: workerArweaveProfile })).toMatch(
      /Cloudflare-backed result storage/,
    );
  });
});
