import {
  enrichRiskMatrixCommentRecord,
  getRiskMatrixCorpusSourceCitations,
  type RiskMatrixCorpusRef,
  type RiskMatrixHistoricalFigure,
} from './riskMatrixCommentContext';
import corpusSample from './corpus_sample.json';
import historicalFigureUsers from './historical_figure_users.json';
import riskMatrixCommentContextData from './riskMatrixCommentContext.json';

describe('riskMatrixCommentContext', () => {
  it('enriches seeded overlap comments from demo context data', () => {
    const entry = enrichRiskMatrixCommentRecord({
      cell: 'Capabilities.Reasoning.Labor.Productivity',
      comment: 'Test overlap',
      valence: 'opportunity' as const,
      intensity: 7,
    });

    expect(entry.historicalFigure).toEqual<RiskMatrixHistoricalFigure>({
      name: 'Franklin D. Roosevelt',
      role: 'Shared-gains politics',
    });
    expect(entry.corpusRefs).toEqual(expect.arrayContaining<RiskMatrixCorpusRef>([
      expect.objectContaining({
        corpusId: 'tweets',
        label: 'AI Discourse Tweets',
        note: 'William Bryk on knowledge-work compression',
      }),
    ]));
  });

  it('preserves explicit comment metadata already carried by the record', () => {
    const entry = enrichRiskMatrixCommentRecord({
      cell: 'Capabilities.Reasoning.Labor.Productivity',
      comment: 'Custom overlap',
      valence: 'risk' as const,
      intensity: 3,
      historicalFigure: {
        name: 'Custom Figure',
        role: 'Custom role',
      },
      corpusRefs: [{
        label: 'Custom corpus',
        note: 'Custom note',
        url: 'https://example.com/custom',
      }],
    });

    expect(entry.historicalFigure).toEqual<RiskMatrixHistoricalFigure>({
      name: 'Custom Figure',
      role: 'Custom role',
    });
    expect(entry.corpusRefs).toEqual<RiskMatrixCorpusRef[]>([{
      label: 'Custom corpus',
      note: 'Custom note',
      url: 'https://example.com/custom',
    }]);
  });

  it('keeps seeded historical figures inside the existing historical figure demo set', () => {
    const validFigureNames = new Set((historicalFigureUsers as Array<{ name?: string }>)
      .map((entry) => String(entry?.name || '').trim())
      .filter(Boolean));

    const usedFigureNames = new Set<string>();
    ['SUBCATEGORY_CONTEXT', 'CATEGORY_CONTEXT'].forEach((sectionKey) => {
      Object.values((riskMatrixCommentContextData as Record<string, any>)?.[sectionKey] || {}).forEach((entry: any) => {
        const figureName = String(entry?.historicalFigure?.name || '').trim();
        if (figureName) usedFigureNames.add(figureName);
      });
    });

    expect(Array.from(usedFigureNames).every((figureName) => validFigureNames.has(figureName))).toBe(true);
  });

  it('keeps seeded corpus refs anchored to real corpus ids and titles', () => {
    const corpusLabelById = Object.fromEntries(
      Object.entries((corpusSample as any)?.meta?.corpuses || {}).map(([corpusId, corpusEntry]: [string, any]) => [
        corpusId,
        String(corpusEntry?.label || '').trim(),
      ])
    );

    ['SUBCATEGORY_CONTEXT', 'CATEGORY_CONTEXT'].forEach((sectionKey) => {
      Object.values((riskMatrixCommentContextData as Record<string, any>)?.[sectionKey] || {}).forEach((entry: any) => {
        const refs = Array.isArray(entry?.corpusRefs) ? entry.corpusRefs : [];
        refs.forEach((ref: any) => {
          const corpusId = String(ref?.corpusId || '').trim();
          expect(corpusId).not.toBe('');
          expect(corpusLabelById[corpusId]).toBe(String(ref?.label || '').trim());
        });
      });
    });
  });

  it('derives specific corpus-entry citations only when refs resolve to real corpus entries', () => {
    const citations = getRiskMatrixCorpusSourceCitations([
      {
        corpusId: 'tweets',
        label: 'AI Discourse Tweets',
        note: 'PalisadeAI on o3 shutdown sabotage',
        url: 'https://x.com/PalisadeAI/status/1926084635903025621',
      },
      {
        corpusId: 'cross_corpus',
        label: 'Cross-Corpus Debates',
        note: 'Who captures gains when automation moves faster than bargaining',
      },
    ]);

    expect(citations).toHaveLength(1);
    expect(citations[0]).toMatch(/^@PalisadeAI — .*o3 model sabotaged a shutdown mechanism/i);
  });
});
