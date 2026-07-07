import fs from 'fs';
import path from 'path';

import corpusSample from './corpus_sample.json';
import demoAnalysisGenerationConfig from './demo_analysis_generation_config.json';
import debateMapData from './debate_map_demo_data.json';
import demoAnalysisData from './demo_analysis_data.json';
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

  it('keeps the dedicated breakdown analysis fixture separate from the canonical Polis demo fixture', () => {
    const demoDir = __dirname;
    const syntheticVariantCount = Array.isArray(
      demoAnalysisGenerationConfig?.syntheticParticipantConfig?.variantProfiles,
    )
      ? demoAnalysisGenerationConfig.syntheticParticipantConfig.variantProfiles.length
      : 0;

    expect(fs.existsSync(path.join(demoDir, 'demo_analysis_data.json'))).toBe(true);
    expect(Object.keys(demoAnalysisData)).toEqual(['comments', 'participantsVotes']);
    expect(demoAnalysisData.comments).toHaveLength(demoPolisData.comments.length);
    expect(demoAnalysisData.participantsVotes).toHaveLength(
      demoPolisData.participantsVotes.length * (syntheticVariantCount + 1),
    );
  });

  it('keeps breakdown generation curation in a dedicated demo variable file', () => {
    const demoDir = __dirname;

    expect(fs.existsSync(path.join(demoDir, 'demo_analysis_generation_config.json'))).toBe(true);
    expect(Object.keys(demoAnalysisGenerationConfig)).toEqual([
      'treeNodeIdsByQuestionId',
      'questionOverridesByQuestionId',
      'syntheticParticipantConfig',
    ]);
    expect(Object.keys(demoAnalysisGenerationConfig.treeNodeIdsByQuestionId).length).toBeGreaterThan(0);
    expect(Object.keys(demoAnalysisGenerationConfig.questionOverridesByQuestionId).length).toBeGreaterThan(0);
    expect(Array.isArray(demoAnalysisGenerationConfig?.syntheticParticipantConfig?.variantProfiles)).toBe(true);
    expect(demoAnalysisGenerationConfig.syntheticParticipantConfig.variantProfiles.length).toBeGreaterThan(0);
  });

  it('merges the split debate fixtures into a single dataset', () => {
    const demoDir = __dirname;

    expect(fs.existsSync(path.join(demoDir, 'debates.json'))).toBe(true);
    expect(fs.existsSync(path.join(demoDir, 'debates_part1.json'))).toBe(false);
    expect(fs.existsSync(path.join(demoDir, 'debates_part2.json'))).toBe(false);
    expect(Array.isArray(debates)).toBe(true);
    expect(debates).toHaveLength(16);
    expect(debates.map((debate) => debate.id)).toEqual([
      'debate_exponential_progress',
      'debate_reward_hacking_misalignment',
      'debate_predeployment_eval_adequacy',
      'debate_ai_rd_automation',
      'debate_open_vs_closed_safety',
      'debate_benchmark_validity',
      'debate_regulation_speed',
      'debate_deceptive_alignment',
      'debate_ai_water_usage',
      'debate_ai_labor_automation',
      'debate_ai_education_integrity',
      'debate_ai_copyright_training',
      'debate_multimodal_deepfake_governance',
      'debate_government_prerelease_access',
      'debate_alignment_tractability_2026',
      'debate_ai_labor_displacement_timeline',
    ]);
  });

  it('keeps the client demo corpus sample curated around featured-first entries on visible tabs', () => {
    const expectedVisibleCounts = {
      tweets: 25,
      ai_laws_policy: 20,
      arxiv_ai_safety: 20,
      lesswrong_posts: 20,
      cross_corpus: 16,
      dwarkesh_lab_insiders: 20,
      ai_scifi_books: 20,
      metr_evals_metrics: 15,
    };
    const expectedFeaturedLeads = {
      tweets: [
        'https://x.com/jburnmurdoch/status/1689189112710885376',
        'https://x.com/Gregory_C_Allen/status/1898040379611504983',
        'https://x.com/PalisadeAI/status/1926084635903025621',
      ],
      ai_laws_policy: ['eu_ai_act', 'eu_gdpr_article_22', 'council_of_europe_ai_convention'],
      arxiv_ai_safety: [
        'gpt3_language_models_few_shot',
        'gpt4_technical_report',
        'attention_all_you_need_vaswani_2017',
      ],
      lesswrong_posts: ['yudkowsky_ai_box', 'bostrom_dragon_tyrant', 'sequences_rationality_az'],
      cross_corpus: [
        'debate_exponential_progress',
        'debate_reward_hacking_misalignment',
        'debate_predeployment_eval_adequacy',
      ],
      dwarkesh_lab_insiders: [
        'amodei_dario_dwarkesh_2026_scaling',
        'hassabis_demis_dwarkesh_2024_superhuman',
        'amodei_dario_dwarkesh_2023_scaling',
      ],
      ai_scifi_books: ['shelley_frankenstein', 'butler_erewhon', 'forster_machine_stops'],
      metr_evals_metrics: [
        'metr_time_horizon_paper_2025',
        'metr_reward_hacking_2025',
        'metr_developer_productivity_rct_2025',
      ],
    };

    Object.entries(expectedVisibleCounts).forEach(([corpusKey, expectedCount]) => {
      const entries = corpusSample?.corpuses?.[corpusKey]?.entries;

      expect(Array.isArray(entries)).toBe(true);
      expect(entries).toHaveLength(expectedCount);
      expect(entries.length).toBeGreaterThan(0);
    });

    expect(corpusSample.corpuses.tweets.entries.slice(0, 3).map((entry) => entry.url)).toEqual(
      expectedFeaturedLeads.tweets,
    );

    Object.entries(expectedFeaturedLeads)
      .filter(([corpusKey]) => corpusKey !== 'tweets')
      .forEach(([corpusKey, expectedIds]) => {
        expect(corpusSample.corpuses[corpusKey].entries.slice(0, expectedIds.length).map((entry) => entry.id)).toEqual(
          expectedIds,
        );
      });
  });

  it('keeps the canonical demo fixtures internally consistent with normalized UTC datetimes', () => {
    const formatDemoUtcDateTime = (timestamp) => {
      const date = new Date(Number(timestamp));
      const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const pad = (value) => String(value).padStart(2, '0');
      return [
        weekdays[date.getUTCDay()],
        months[date.getUTCMonth()],
        pad(date.getUTCDate()),
        `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`,
        'UTC',
        date.getUTCFullYear(),
      ].join(' ');
    };

    [demoPolisData.comments, demoAnalysisData.comments].forEach((comments) => {
      comments.forEach((comment) => {
        expect(comment.datetime).toBe(formatDemoUtcDateTime(comment.timestamp));
      });
    });
  });

  it('removes the known demo corpus text glitches that made the sample feel synthetic', () => {
    const serializedCorpusSample = JSON.stringify(corpusSample);

    expect(serializedCorpusSample).not.toMatch(/partneredwith/);
    expect(serializedCorpusSample).not.toMatch(/calledOpenAI/);
    expect(serializedCorpusSample).not.toMatch(/it somewhat fragile/);
  });

  it('covers every atlas leaf node with at least one Loophole historical case', () => {
    const leafNodeIds = [];
    const coveredNodeIds = new Set(
      (Array.isArray(loopholeHistoricalCases) ? loopholeHistoricalCases : []).flatMap((entry) =>
        Array.isArray(entry?.debate_map_issues) ? entry.debate_map_issues : [],
      ),
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

    expect(leafNodeIds).toHaveLength(41);
    expect(leafNodeIds.filter((nodeId) => !coveredNodeIds.has(nodeId))).toEqual([]);
  });

  it('keeps every Loophole historical case on the enriched schema contract', () => {
    const requiredExploitFields = ['institution', 'actor', 'action', 'victims', 'why_legal', 'why_immoral'];
    const requiredOverreachFields = [
      'institution',
      'actor',
      'blocked_action',
      'who_gets_harmed',
      'why_illegal',
      'why_moral',
    ];

    expect(Array.isArray(loopholeHistoricalCases)).toBe(true);
    expect(loopholeHistoricalCases.length).toBeGreaterThan(0);

    loopholeHistoricalCases.forEach((historicalCase) => {
      expect(Array.isArray(historicalCase?.draft_legal_code?.articles)).toBe(true);
      expect(historicalCase.draft_legal_code.articles.length).toBeGreaterThan(0);
      expect(
        historicalCase.draft_legal_code.articles.every(
          (article) => typeof article === 'string' && article.trim().length > 0,
        ),
      ).toBe(true);

      requiredExploitFields.forEach((fieldName) => {
        expect(typeof historicalCase?.loophole_exploit?.[fieldName]).toBe('string');
        expect(historicalCase.loophole_exploit[fieldName].trim().length).toBeGreaterThan(0);
      });

      requiredOverreachFields.forEach((fieldName) => {
        expect(typeof historicalCase?.overreach_variant?.[fieldName]).toBe('string');
        expect(historicalCase.overreach_variant[fieldName].trim().length).toBeGreaterThan(0);
      });

      expect(Array.isArray(historicalCase?.concrete_patch_options)).toBe(true);
      expect(historicalCase.concrete_patch_options.length).toBeGreaterThan(0);
      historicalCase.concrete_patch_options.forEach((patchOption) => {
        expect(typeof patchOption?.name).toBe('string');
        expect(patchOption.name.trim().length).toBeGreaterThan(0);
        expect(typeof patchOption?.summary).toBe('string');
        expect(patchOption.summary.trim().length).toBeGreaterThan(0);
        expect(typeof patchOption?.favored_by).toBe('string');
        expect(patchOption.favored_by.trim().length).toBeGreaterThan(0);
      });

      expect(typeof historicalCase?.best_patch).toBe('string');
      expect(historicalCase.best_patch.trim().length).toBeGreaterThan(0);
      expect(typeof historicalCase?.open_question).toBe('string');
      expect(historicalCase.open_question.trim().length).toBeGreaterThan(0);
    });
  });

  it('provides principle lists for every historical figure used in Loophole cases', () => {
    const caseAuthors = Array.from(
      new Set(
        (Array.isArray(loopholeHistoricalCases) ? loopholeHistoricalCases : []).flatMap((entry) =>
          Array.isArray(entry?.authors) ? entry.authors : [],
        ),
      ),
    ).sort();

    expect(caseAuthors).toHaveLength(38);
    expect(
      caseAuthors.filter((authorName) => !Array.isArray(loopholeHistoricalFigurePrinciples?.[authorName])),
    ).toEqual([]);
    expect(
      caseAuthors.filter((authorName) => (loopholeHistoricalFigurePrinciples?.[authorName] || []).length < 2),
    ).toEqual([]);
  });
});
