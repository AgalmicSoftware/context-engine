import fs from 'fs';
import path from 'path';

import demoPolisData from '../../variables/demo/demo_polis_data.json';
import historicalFigureDemographics from '../../variables/demo/historical_figure_demographics.js';
import buildDemoAnalysisData, {
  DEMO_ANALYSIS_RESPONSE_OPTIONS,
  buildQuestionTags,
} from './demoAnalysisAdapter.js';

describe('demoAnalysisAdapter', () => {
  const analysisData: any = buildDemoAnalysisData(
    demoPolisData,
    historicalFigureDemographics as Record<string, any>
  );

  it('resolves every demo participant xid to canonical demographics', () => {
    const unresolved = (demoPolisData?.participantsVotes || [])
      .map((participant) => participant?.xid)
      .filter((xid) => xid && !(historicalFigureDemographics as Record<string, any>)[xid]);
    expect(unresolved).toEqual([]);
  });

  it('builds complete Agree/Unsure/Disagree aggregates for every question segment', () => {
    const rowsByQuestionAndSegment = new Map();
    analysisData.flatResponses.forEach((row: any) => {
      const key = `${row.questionId}::${row.segmentKey}`;
      if (!rowsByQuestionAndSegment.has(key)) {
        rowsByQuestionAndSegment.set(key, []);
      }
      rowsByQuestionAndSegment.get(key).push(row);
    });

    analysisData.questions.forEach((question: any) => {
      const segmentKeys = Object.keys(analysisData.segmentCounts[question.id] || {});
      expect(segmentKeys.length).toBeGreaterThan(0);
      segmentKeys.forEach((segmentKey) => {
        const rows: any[] = rowsByQuestionAndSegment.get(`${question.id}::${segmentKey}`) || [];
        expect(rows).toHaveLength(DEMO_ANALYSIS_RESPONSE_OPTIONS.length);
        expect(rows.map((row: any) => row.responseText).sort()).toEqual(DEMO_ANALYSIS_RESPONSE_OPTIONS.slice().sort());
      });
    });
  });

  it('keeps per-question segment rates normalized to the participants who voted on that question', () => {
    const rowsByQuestionAndSegment = new Map();
    analysisData.flatResponses.forEach((row: any) => {
      const key = `${row.questionId}::${row.segmentKey}`;
      if (!rowsByQuestionAndSegment.has(key)) {
        rowsByQuestionAndSegment.set(key, []);
      }
      rowsByQuestionAndSegment.get(key).push(row);
    });

    rowsByQuestionAndSegment.forEach((rows: any[], key) => {
      const totalVotes = rows[0]?.totalVotes || 0;
      const expectedCount = Object.values(
        demoPolisData.participantsVotes.reduce((acc: { count?: number }, participant: any) => {
          const questionId = key.split('::')[0];
          if (participant?.votes?.[questionId] === undefined) {
            return acc;
          }
          acc.count = Number(acc.count || 0) + 1;
          return acc;
        }, {})
      )[0];

      if (key.endsWith('::All')) {
        expect(totalVotes).toBe(Number(expectedCount || 0));
      }

      const totalRate = rows.reduce((sum: number, row: any) => sum + row.rate, 0);
      expect(totalRate).toBeCloseTo(totalVotes > 0 ? 1 : 0, 8);
    });
  });

  it('derives question tags from current demo comment categories and sources', () => {
    const firstQuestionTags: any[] = analysisData.questionTagsData['0'] || [];
    const tagIds = firstQuestionTags.map((tag: any) => tag.tagID);
    const tagNames = firstQuestionTags.map((tag: any) => tag.tagName);

    expect(tagIds).toContain('category:existential-risk-safety-foundations');
    expect(tagIds).toContain('source:tweets');
    expect(tagIds).toContain('source:arxiv');
    expect(tagIds).toContain('source:lesswrong');
    expect(tagNames).toContain('Tweets');
    expect(tagNames).toContain('arXiv');
    expect(tagNames).toContain('LessWrong');
    expect(tagIds).not.toContain('ai-daily-integration');
  });

  it('normalizes corpus source aliases so breakdown tags stay clean', () => {
    const tags = buildQuestionTags({
      sources: 'metr, scifi, sci-fi, LessWrong',
    });

    expect(tags.map((tag) => tag.tagID)).toEqual([
      'source:metr',
      'source:scifi',
      'source:lesswrong',
    ]);
    expect(tags.map((tag) => tag.tagName)).toEqual([
      'METR',
      'Sci-Fi',
      'LessWrong',
    ]);
  });

  it('separates unique persona counts from modeled response totals when synthetic rows reuse an xid', () => {
    const sourceData = {
      comments: [
        {
          commentBody: 'Test breakdown question',
        },
      ],
      participantsVotes: [
        {
          participant: '0xbase-ada',
          xid: 'AdaLovelace',
          votes: { 0: 1 },
        },
        {
          participant: '0xsynthetic-ada',
          xid: 'AdaLovelace',
          votes: { 0: 0 },
        },
        {
          participant: '0xbase-grace',
          xid: 'GraceHopper',
          votes: { 0: -1 },
        },
      ],
    };
    const metadataByXid = {
      AdaLovelace: {
        eraBucket: 'Modern',
        region: 'Europe',
        country: 'United Kingdom',
        gender: 'Woman',
        affiliation: 'Mathematics',
        atlasCategory: 'Foundations',
      },
      GraceHopper: {
        eraBucket: 'Modern',
        region: 'North America',
        country: 'United States',
        gender: 'Woman',
        affiliation: 'Computer Science',
        atlasCategory: 'Foundations',
      },
    };

    const syntheticAnalysisData = buildDemoAnalysisData(sourceData, metadataByXid);
    const overallRows = syntheticAnalysisData.flatResponses.filter(
      (row: any) => row.questionId === '0' && row.segmentKey === 'All'
    );

    expect(syntheticAnalysisData.questions[0].participationCount).toBe(2);
    expect((syntheticAnalysisData.demographics as any).Era).toEqual([
      { value: 'Modern', count: 2 },
    ]);
    expect(overallRows[0]?.participantCount).toBe(2);
    expect(overallRows[0]?.totalVotes).toBe(3);
  });

  it('keeps the adapter free of a baked-in demo polis fixture import', () => {
    const adapterSource = fs.readFileSync(path.join(__dirname, 'demoAnalysisAdapter.ts'), 'utf8');

    expect(adapterSource).not.toMatch(/demo_polis_data\.json/);
  });
});
