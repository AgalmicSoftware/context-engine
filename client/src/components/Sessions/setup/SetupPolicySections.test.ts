import { defaultSessionSetupProfile } from './sessionSetupProfile';
import { summarizeResults } from './SetupPolicySections';

const summaryFor = (generationMode?: string) =>
  summarizeResults({
    sessionModeProfile: defaultSessionSetupProfile(),
    ...(generationMode ? { resultsAnalysis: { generationMode } } : {}),
  } as never);

describe('summarizeResults', () => {
  it('reports the saved results analysis choice', () => {
    // Nothing about AI Views unless the session still builds it automatically.
    expect(summaryFor()).not.toMatch(/analysis|AI Views/);
    expect(summaryFor('manual')).not.toMatch(/analysis|AI Views/);
    expect(summaryFor('automatic')).toContain('automatic AI Views builds');
    expect(summaryFor('both')).toContain('automatic AI Views builds');
  });
});
