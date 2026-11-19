import { defaultSessionSetupProfile } from './sessionSetupProfile';
import { summarizeResults } from './SetupPolicySections';

const summaryFor = (generationMode?: string) =>
  summarizeResults({
    sessionModeProfile: defaultSessionSetupProfile(),
    ...(generationMode ? { resultsAnalysis: { generationMode } } : {}),
  } as never);

describe('summarizeResults', () => {
  it('reports the saved results analysis choice', () => {
    // Nothing unless the session's Session Agent updates automatically.
    expect(summaryFor()).not.toMatch(/analysis|AI Views|update/);
    expect(summaryFor('manual')).not.toMatch(/analysis|AI Views|update/);
    expect(summaryFor('automatic')).toContain('automatic Session Agent updates');
    expect(summaryFor('both')).toContain('automatic Session Agent updates');
  });
});
