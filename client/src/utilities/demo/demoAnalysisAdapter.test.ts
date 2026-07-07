import fs from 'fs';
import path from 'path';

import demoAnalysisData from '../../variables/demo/demo_analysis_data.json';
import demoPolisData from '../../variables/demo/demo_polis_data.json';
import historicalFigureDemographics from '../../variables/demo/historical_figure_demographics.js';
import buildDemoAnalysisData, { DEMO_ANALYSIS_RESPONSE_OPTIONS, buildQuestionTags } from './demoAnalysisAdapter.js';
import type {
  DemoAnalysisData,
  DemoAnalysisMetadataByXid,
  DemoAnalysisParticipant,
  DemoFlatResponse,
  QuestionProfileSummary,
  QuestionTag,
} from './demoAnalysisAdapter.js';

describe('demoAnalysisAdapter', () => {
  const metadataByXid = historicalFigureDemographics as DemoAnalysisMetadataByXid;
  const demoParticipants: DemoAnalysisParticipant[] = Array.isArray(demoPolisData?.participantsVotes)
    ? (demoPolisData.participantsVotes as DemoAnalysisParticipant[])
    : [];
  const analysisData: DemoAnalysisData = buildDemoAnalysisData(demoPolisData, metadataByXid);
  const modeledAnalysisData: DemoAnalysisData = buildDemoAnalysisData(demoAnalysisData, metadataByXid);

  it('resolves every demo participant xid to canonical demographics', () => {
    const unresolved = demoParticipants
      .map((participant) => participant?.xid)
      .filter((xid) => xid && !metadataByXid[String(xid)]);
    expect(unresolved).toEqual([]);
  });

  it('builds complete Agree/Unsure/Disagree aggregates for every question segment', () => {
    const rowsByQuestionAndSegment = new Map<string, DemoFlatResponse[]>();
    analysisData.flatResponses.forEach((row) => {
      const key = `${row.questionId}::${row.segmentKey}`;
      if (!rowsByQuestionAndSegment.has(key)) {
        rowsByQuestionAndSegment.set(key, []);
      }
      rowsByQuestionAndSegment.get(key)?.push(row);
    });

    analysisData.questions.forEach((question) => {
      const segmentKeys = Object.keys(analysisData.segmentCounts[question.id] || {});
      expect(segmentKeys.length).toBeGreaterThan(0);
      segmentKeys.forEach((segmentKey) => {
        const rows = rowsByQuestionAndSegment.get(`${question.id}::${segmentKey}`) || [];
        expect(rows).toHaveLength(DEMO_ANALYSIS_RESPONSE_OPTIONS.length);
        expect(rows.map((row) => row.responseText).sort()).toEqual(DEMO_ANALYSIS_RESPONSE_OPTIONS.slice().sort());
      });
    });
  });

  it('keeps per-question segment rates normalized to the participants who voted on that question', () => {
    const rowsByQuestionAndSegment = new Map<string, DemoFlatResponse[]>();
    analysisData.flatResponses.forEach((row) => {
      const key = `${row.questionId}::${row.segmentKey}`;
      if (!rowsByQuestionAndSegment.has(key)) {
        rowsByQuestionAndSegment.set(key, []);
      }
      rowsByQuestionAndSegment.get(key)?.push(row);
    });

    rowsByQuestionAndSegment.forEach((rows, key) => {
      const totalVotes = rows[0]?.totalVotes || 0;
      const questionId = key.split('::')[0];
      const expectedCount = demoParticipants.filter(
        (participant) => participant?.votes?.[questionId] !== undefined,
      ).length;

      if (key.endsWith('::All')) {
        expect(totalVotes).toBe(Number(expectedCount || 0));
      }

      const totalRate = rows.reduce((sum, row) => sum + row.rate, 0);
      expect(totalRate).toBeCloseTo(totalVotes > 0 ? 1 : 0, 8);
    });
  });

  it('derives question tags from current demo comment categories and sources', () => {
    const firstQuestionTags: QuestionTag[] = analysisData.questionTagsData['0'] || [];
    const tagIds = firstQuestionTags.map((tag) => tag.tagID);
    const tagNames = firstQuestionTags.map((tag) => tag.tagName);

    expect(tagIds).toContain('category:existential-risk-safety-foundations');
    expect(tagIds).toContain('source:tweets');
    expect(tagIds).toContain('source:arxiv');
    expect(tagIds).toContain('source:lesswrong');
    expect(tagNames).toContain('Tweets');
    expect(tagNames).toContain('arXiv');
    expect(tagNames).toContain('LessWrong');
    expect(tagIds).not.toContain('ai-daily-integration');
  });

  it('preserves per-question key tensions so the UI can explain why a split matters', () => {
    expect(modeledAnalysisData.questions[0]?.keyTension).toContain('Experts range from <10% to 99.9% probability');
    expect(modeledAnalysisData.questions[0]?.sourcePromptType).toBe('binary');
  });

  it('summarizes the modeled respondent profiles for each question when synthetic rows are present', () => {
    const questionProfiles: QuestionProfileSummary[] = modeledAnalysisData.questionProfileSummaries['0'] || [];
    const profileIds = questionProfiles.map((profile) => profile.profileId);

    expect(profileIds).toEqual(['bridge_builder', 'consensus_echo', 'historical_baseline']);
    expect(questionProfiles.find((profile) => profile.profileId === 'historical_baseline')).toMatchObject({
      label: 'Historical persona baseline',
      confidence: 'High',
    });
    expect(questionProfiles.find((profile) => profile.profileId === 'consensus_echo')).toMatchObject({
      label: 'Consensus echo',
      confidence: 'Medium',
    });
  });

  it('normalizes corpus source aliases so breakdown tags stay clean', () => {
    const tags = buildQuestionTags({
      sources: 'metr, scifi, sci-fi, LessWrong',
    });

    expect(tags.map((tag) => tag.tagID)).toEqual(['source:metr', 'source:scifi', 'source:lesswrong']);
    expect(tags.map((tag) => tag.tagName)).toEqual(['METR', 'Sci-Fi', 'LessWrong']);
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
    const syntheticMetadataByXid: DemoAnalysisMetadataByXid = {
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

    const syntheticAnalysisData = buildDemoAnalysisData(sourceData, syntheticMetadataByXid);
    const overallRows = syntheticAnalysisData.flatResponses.filter(
      (row) => row.questionId === '0' && row.segmentKey === 'All',
    );

    expect(syntheticAnalysisData.questions[0].participationCount).toBe(2);
    expect(syntheticAnalysisData.demographics.Era).toEqual([{ value: 'Modern', count: 2 }]);
    expect(overallRows[0]?.participantCount).toBe(2);
    expect(overallRows[0]?.totalVotes).toBe(3);
  });

  it('keeps the adapter free of a baked-in demo polis fixture import', () => {
    const adapterSource = fs.readFileSync(path.join(__dirname, 'demoAnalysisAdapter.ts'), 'utf8');

    expect(adapterSource).not.toMatch(/demo_polis_data\.json/);
  });
});
