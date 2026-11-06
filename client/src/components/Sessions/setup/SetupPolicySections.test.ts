import { defaultSessionSetupProfile } from './sessionSetupProfile';
import { summarizeResults } from './SetupPolicySections';

const summaryFor = (generationMode?: string) =>
  summarizeResults({
    sessionModeProfile: defaultSessionSetupProfile(),
    ...(generationMode ? { resultsAnalysis: { generationMode } } : {}),
  } as never);

describe('summarizeResults', () => {
  it('reports the saved results analysis choice', () => {
    expect(summaryFor()).toContain('analysis manual');
    expect(summaryFor('manual')).toContain('analysis manual');
    expect(summaryFor('automatic')).toContain('analysis automatic');
    expect(summaryFor('both')).toContain('analysis manual and automatic');
  });
});
