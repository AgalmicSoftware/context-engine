import buildClusterAnalysisPrompt from './clusterAnalysisPrompt.js';
import buildCompareToolkitPrompt from './compareToolkitPrompt.js';
import buildTagInterpretationPrompt from './tagInterpretationPrompt.js';
import buildUserAnalysisPrompt from './userAnalysisPrompt.js';

describe('prompt builders', () => {
  it('builds tag interpretation prompts from normalized tag and question inputs', () => {
    const prompt = buildTagInterpretationPrompt({
      selectedTags: [' ai ', '', null],
      questions: [
        { prompt: ' First question ', responseCount: 1 },
        { prompt: 'Second question', responseCount: 2 },
      ],
      maxQuestions: 1,
    });

    expect(prompt).toContain('Analyze these questions tagged with ai');
    expect(prompt).toContain('Q: First question (1 response)');
    expect(prompt).not.toContain('Second question');
  });

  it('serializes compare toolkit envelopes into the strict JSON prompt section', () => {
    const prompt = buildCompareToolkitPrompt({
      task: 'compare',
      users: [{ address: '0xabc', createdCounts: { questions: 2 } }],
    });

    expect(prompt).toContain('OUTPUT CONTRACTS');
    expect(prompt).toContain('"task": "compare"');
    expect(prompt).toContain('"address": "0xabc"');
  });

  it('serializes user analysis data and falls back to an empty object for null input', () => {
    const prompt = buildUserAnalysisPrompt({
      sbts: ['Builders'],
      createdCounts: { surveys: 1 },
    });
    const fallbackPrompt = buildUserAnalysisPrompt(null);

    expect(prompt).toContain('USER DATA (JSON):');
    expect(prompt).toContain('"sbts": [');
    expect(prompt).toContain('"Builders"');
    expect(fallbackPrompt).toContain('USER DATA (JSON):\n{}');
  });

  it('builds cluster prompts from guarded cluster records and fallback context', () => {
    const prompt = buildClusterAnalysisPrompt(
      {
        clusterIndex: 2,
        clusterSize: 5,
        topStatements: [{ prompt: 'Regulate frontier systems' }],
      },
      { clusterCount: 4 }
    );
    const fallbackPrompt = buildClusterAnalysisPrompt(null, null);

    expect(prompt).toContain('grouped participants into 4 opinion clusters');
    expect(prompt).toContain('cluster #2 of size 5');
    expect(prompt).toContain('"prompt": "Regulate frontier systems"');
    expect(fallbackPrompt).toContain('grouped participants into N opinion clusters');
    expect(fallbackPrompt).toContain('cluster #? of size ?');
  });
});
