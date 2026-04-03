import fs from 'fs';
import path from 'path';

import debates from './debates.json';
import demoPolisData77 from './demo_polis_data_77.json';

describe('demo data fixture cleanup', () => {
  it('keeps the renamed Polis fixture at the snake_case path', () => {
    const demoDir = __dirname;

    expect(fs.existsSync(path.join(demoDir, 'demo_polis_data_77.json'))).toBe(true);
    expect(fs.existsSync(path.join(demoDir, 'demoPolisData_77.json'))).toBe(false);
    expect(Object.keys(demoPolisData77)).toEqual([
      'comments',
      'participantsVotes',
      'clusterAnalysis',
      'consensusStatements',
      'divisiveStatements',
      'clusterAnalysisVersion',
    ]);
    expect(demoPolisData77.comments).toHaveLength(77);
    expect(Array.isArray(demoPolisData77.participantsVotes)).toBe(true);
    expect(Array.isArray(demoPolisData77.clusterAnalysis)).toBe(true);
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
});
