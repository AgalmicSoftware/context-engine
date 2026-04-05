import fs from 'fs';
import path from 'path';

import debateMapData from './debate_map_demo_data.json';
import debates from './debates.json';
import demoPolisData from './demo_polis_data.json';
import loopholeHistoricalCases from './loophole_historical_cases.json';
import loopholeHistoricalFigurePrinciples from './loophole_historical_figure_principles.json';

describe('demo data fixture cleanup', () => {
  it('keeps the canonical Polis fixture at the snake_case path', () => {
    const demoDir = __dirname;

    expect(fs.existsSync(path.join(demoDir, 'demo_polis_data.json'))).toBe(true);
    expect(fs.existsSync(path.join(demoDir, 'demoPolisData.json'))).toBe(false);
    expect(Object.keys(demoPolisData)).toEqual([
      'comments',
      'participantsVotes',
      'clusterAnalysis',
      'consensusStatements',
      'divisiveStatements',
      'clusterAnalysisVersion',
    ]);
    expect(demoPolisData.comments).toHaveLength(42);
    expect(Array.isArray(demoPolisData.participantsVotes)).toBe(true);
    expect(Array.isArray(demoPolisData.clusterAnalysis)).toBe(true);
  });

  it('merges the split debate fixtures into a single dataset', () => {
    const demoDir = __dirname;

    expect(fs.existsSync(path.join(demoDir, 'debates.json'))).toBe(true);
    expect(fs.existsSync(path.join(demoDir, 'debates_part1.json'))).toBe(false);
    expect(fs.existsSync(path.join(demoDir, 'debates_part2.json'))).toBe(false);
    expect(Array.isArray(debates)).toBe(true);
    expect(debates).toHaveLength(8);
    expect(debates.map((debate) => debate.id)).toEqual([
      'debate_exponential_progress',
      'debate_reward_hacking_misalignment',
      'debate_predeployment_eval_adequacy',
      'debate_ai_rd_automation',
      'debate_open_vs_closed_safety',
      'debate_benchmark_validity',
      'debate_regulation_speed',
      'debate_deceptive_alignment',
    ]);
  });

  it('covers every atlas leaf node with at least one Loophole historical case', () => {
    const leafNodeIds = [];
    const coveredNodeIds = new Set(
      (Array.isArray(loopholeHistoricalCases) ? loopholeHistoricalCases : []).flatMap((entry) => (
        Array.isArray(entry?.debate_map_issues) ? entry.debate_map_issues : []
      ))
    );

    const visit = (nodes) => {
      (nodes || []).forEach((node) => {
        if (Array.isArray(node.children) && node.children.length > 0) {
          visit(node.children);
          return;
        }
        leafNodeIds.push(node.id);
      });
    };

    visit(debateMapData);

    expect(leafNodeIds).toHaveLength(40);
    expect(leafNodeIds.filter((nodeId) => !coveredNodeIds.has(nodeId))).toEqual([]);
  });

  it('provides principle lists for every historical figure used in Loophole cases', () => {
    const caseAuthors = Array.from(new Set(
      (Array.isArray(loopholeHistoricalCases) ? loopholeHistoricalCases : []).flatMap((entry) => (
        Array.isArray(entry?.authors) ? entry.authors : []
      ))
    )).sort();

    expect(caseAuthors).toHaveLength(38);
    expect(caseAuthors.filter((authorName) => !Array.isArray(loopholeHistoricalFigurePrinciples?.[authorName]))).toEqual([]);
    expect(caseAuthors.filter((authorName) => (loopholeHistoricalFigurePrinciples?.[authorName] || []).length < 2)).toEqual([]);
  });
});
