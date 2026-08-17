import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { TestMemoryRouter as MemoryRouter } from 'testUtils/TestMemoryRouter';
import DebateMap, {
  AtlasView,
  buildExpandedHistoricalCaseBriefMap,
  buildHistoricalCaseBrief,
  buildHistoricalCompassPoints,
  getAtlasLinkStableKey,
  getCompactTreeNodeLabel,
  getDebateNodeListStableKeys,
  getDebateNodeStableKey,
  getDebateQuestionListStableKeys,
  getDebateQuestionStableKey,
  getDebateTagStableKeys,
  getPackedAtlasClickTarget,
  getPackedAtlasLabelFontSizePx,
  getPackedAtlasVerticalLiftPx,
  getTopAtlasNodesByHeat,
  getTreeChildColumnCount,
  getTreeChildStaggerPx,
  getTreeSubtreeSpan,
  getTreeViewportFitHeight,
  getTreeViewportFitScale,
} from './DebateMap';
import treeData from '../../variables/demo/debate_map_demo_data.json';
import historicalFigureData from '../../variables/demo/historical_figures_tree_qs_and_votes.json';
import loopholeHistoricalCases from '../../variables/demo/loophole_historical_cases.json';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { getHistoricalFigureAvatarOrBlockie } from 'utilities/ui/historicalFigureAvatars.js';

jest.setTimeout(30000);

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

jest.mock('../Shared/AudioInput/AudioInput', () => () => <div data-testid="atlas-audio-input" />);
jest.mock('../../utilities/arweave/arweaveClient.js', () => ({
  arweaveClient: {
    uploadDataToArweave: jest.fn(),
  },
}));
jest.mock('../../utilities/session/resourceKeys.js', () => ({
  getEffectiveArweaveKey: jest.fn(),
}));
jest.mock('../../utilities/crypto/litProtocol.js', () => ({
  getGlobalLitHooks: jest.fn(),
  resolveLitChain: jest.fn(),
  litStorage: {
    uploadEncryptedArweaveData: jest.fn(),
  },
}));
jest.mock('utilities/logging.js', () => ({
  createLogger: jest.fn(() => ({
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));
jest.mock('utilities/ui/historicalFigureAvatars.js', () => ({
  getHistoricalFigureAvatarOrBlockie: jest.fn(() => 'avatar.png'),
}));
jest.mock('../../utilities/ui/notify.js', () => ({
  notify: {
    success: jest.fn(),
    warn: jest.fn(),
  },
}));
jest.mock('../DemoViews/DebateHUD/PoliticalCompassView', () => ({
  __esModule: true,
  StandalonePoliticalCompass: ({ compass }: any) => (
    <div data-testid="atlas-compass">{compass?.xAxis?.label || 'Political Compass'}</div>
  ),
}));

const DebateMapComponent = DebateMap as React.ComponentType<any>;
const AtlasViewComponent = AtlasView as React.ComponentType<any>;
const buildExpandedHistoricalCaseBriefMapAny = buildExpandedHistoricalCaseBriefMap as any;
const buildHistoricalCaseBriefAny = buildHistoricalCaseBrief as any;
const buildHistoricalCompassPointsAny = buildHistoricalCompassPoints as any;
const getAtlasLinkStableKeyAny = getAtlasLinkStableKey as any;
const getCompactTreeNodeLabelAny = getCompactTreeNodeLabel as any;
const getDebateNodeListStableKeysAny = getDebateNodeListStableKeys as any;
const getDebateNodeStableKeyAny = getDebateNodeStableKey as any;
const getDebateQuestionListStableKeysAny = getDebateQuestionListStableKeys as any;
const getDebateQuestionStableKeyAny = getDebateQuestionStableKey as any;
const getDebateTagStableKeysAny = getDebateTagStableKeys as any;
const getPackedAtlasClickTargetAny = getPackedAtlasClickTarget as any;
const getPackedAtlasLabelFontSizePxAny = getPackedAtlasLabelFontSizePx as any;
const getPackedAtlasVerticalLiftPxAny = getPackedAtlasVerticalLiftPx as any;
const getTopAtlasNodesByHeatAny = getTopAtlasNodesByHeat as any;
const getTreeChildColumnCountAny = getTreeChildColumnCount as any;
const getTreeChildStaggerPxAny = getTreeChildStaggerPx as any;
const getTreeSubtreeSpanAny = getTreeSubtreeSpan as any;
const getTreeViewportFitHeightAny = getTreeViewportFitHeight as any;
const getTreeViewportFitScaleAny = getTreeViewportFitScale as any;
const mockedGetHistoricalFigureAvatarOrBlockie = getHistoricalFigureAvatarOrBlockie as jest.Mock;
const treeDataFixture = treeData as any[];
const historicalFigureDataFixture = historicalFigureData as Record<string, any>;
const loopholeHistoricalCasesFixture = loopholeHistoricalCases as any[];
const mutableEnv = process.env as Record<string, string | undefined>;

const getCurrentDemoLeafFixture = () => {
  const questionsById = new Map<string, string[]>();

  Object.values(historicalFigureDataFixture || {}).forEach((figure: any) => {
    (figure?.questions || []).forEach((question: any) => {
      if (!questionsById.has(question.id)) {
        questionsById.set(question.id, []);
      }
      questionsById.get(question.id)?.push(question.question);
    });
  });

  let selectedLeaf: { depth: number; leafName: string; questionText: string } | null = null;

  const visit = (nodes: any[] = [], depth = 0) => {
    (nodes || []).forEach((node: any) => {
      expect(Array.isArray(node.children)).toBe(true);

      if (node.children.length > 0) {
        visit(node.children, depth + 1);
        return;
      }

      const matchedQuestions = questionsById.get(node.id);
      if (!matchedQuestions || matchedQuestions.length === 0) return;

      if (!selectedLeaf || depth > selectedLeaf.depth) {
        selectedLeaf = {
          depth,
          leafName: node.name,
          questionText: matchedQuestions[0],
        };
      }
    });
  };

  visit(treeDataFixture);

  if (!selectedLeaf) {
    throw new Error('Expected a deepest atlas leaf with demo historical questions.');
  }

  return selectedLeaf as { depth: number; leafName: string; questionText: string };
};

const currentDemoLeafFixture: { depth: number; leafName: string; questionText: string } = getCurrentDemoLeafFixture();
const governanceCategoryNodeId = '0x3000000000000000000000000000000000000000000000000000000000000000';
const parseHistoricalVote = (vote: any) => {
  if (vote === 'up') return 1;
  if (vote === 'down') return -1;

  const parsedVote = parseInt(vote, 10);
  return Number.isNaN(parsedVote) ? null : parsedVote;
};
const getQuadrantKey = (point: any) => `${point.y > 0.5 ? 'top' : 'bottom'}-${point.x > 0.5 ? 'right' : 'left'}`;
const getVoteEntriesForNode = (nodeId: string) =>
  Object.entries(historicalFigureDataFixture || {}).reduce((entries: any[], [username, figure]: [string, any]) => {
    const parsedVote = parseHistoricalVote(figure?.votes?.[nodeId]);
    if (!Number.isFinite(parsedVote)) return entries;
    return entries.concat({ username, value: parsedVote });
  }, [] as any[]);
const getAtlasNodeLabel = (label: string): HTMLElement => {
  const labelElement = screen
    .getAllByText(label)
    .find((element) => String(element.className || '').includes('nodeLabel'));
  if (!labelElement) throw new Error(`Missing atlas node label: ${label}`);
  return labelElement;
};
const getAtlasNodeDiameter = (label: string) => {
  const labelElement = getAtlasNodeLabel(label);
  const dotElement = labelElement.parentElement?.querySelector('[class*="nodeDot"]');
  if (!dotElement) throw new Error(`Missing atlas node dot: ${label}`);
  return parseFloat((dotElement as HTMLElement).style.width);
};
const getAtlasNodeElementById = (nodeId: string, layout = ''): HTMLElement | undefined =>
  screen
    .getAllByTestId(E2E_TESTIDS.ATLAS_NODE)
    .find(
      (element) =>
        element.getAttribute('data-ce-node-id') === nodeId &&
        (!layout || element.getAttribute('data-ce-node-layout') === layout),
    );
const getDebateViewModeButton = (mode: string): HTMLElement => {
  const button = screen
    .getAllByTestId(E2E_TESTIDS.DEBATE_VIEW_MODE)
    .find((element) => element.getAttribute('data-ce-view-mode') === mode);
  if (!button) throw new Error(`Missing debate view mode button: ${mode}`);
  return button;
};
const getPackedNodeLabel = (label: string): HTMLElement | undefined =>
  screen.getAllByText(label).find((element) => String(element.className || '').includes('packedNodeLabel'));
const getAtlasNodeDiameterById = (nodeId: string, layout = '') => {
  const nodeElement = getAtlasNodeElementById(nodeId, layout);
  if (!nodeElement) throw new Error(`Missing atlas node: ${nodeId}`);
  const dotElement = nodeElement.querySelector('[class*="nodeDot"]');
  if (!dotElement) throw new Error(`Missing atlas node dot: ${nodeId}`);
  return parseFloat((dotElement as HTMLElement).style.width);
};
const privacyAndSurveillanceNodeId = '0x4320000000000000000000000000000000000000000000000000000000000000';
const deceptiveAlignmentNodeId = '0x1110000000000000000000000000000000000000000000000000000000000000';
const liabilityFrameworksNodeId = '0x3140000000000000000000000000000000000000000000000000000000000000';

const getHistoricalCaseForNode = (nodeId: string) => {
  const matchedCase = (Array.isArray(loopholeHistoricalCasesFixture) ? loopholeHistoricalCasesFixture : []).find(
    (historicalCase: any) =>
      Array.isArray(historicalCase?.debate_map_issues) && historicalCase.debate_map_issues.includes(nodeId),
  );

  if (!matchedCase) {
    throw new Error(`Expected a historical case fixture for node ${nodeId}.`);
  }

  return matchedCase;
};

const renderDemoAtlasNode = (nodeId: string) =>
  render(
    <MemoryRouter initialEntries={[`/atlas/${nodeId}`]}>
      <Routes>
        <Route
          path="/atlas/:nodeId"
          element={
            <DebateMapComponent
              account=""
              provider=""
              network={{ id: 84532 }}
              activeSessionSlug=""
              toggleLoginModal={jest.fn()}
              demoMode={true}
            />
          }
        />
      </Routes>
    </MemoryRouter>,
  );

const getAtlasModalContent = (headingName: string | RegExp): HTMLElement => {
  const heading = screen.getByRole('heading', { name: headingName });
  const modalContent = heading.closest('[class*="modalContent"]');

  if (!modalContent) {
    throw new Error(`Expected modal content wrapper for heading ${String(headingName)}.`);
  }

  return modalContent as HTMLElement;
};

const getAtlasModalNetVoteScore = (modalContent: HTMLElement): number => {
  const score = modalContent.querySelector('[class*="netScoreValue"]');
  if (!score) throw new Error('Expected atlas modal net vote score.');
  return Number(score.textContent);
};

const getAtlasModalConfirmVoteButton = (modalContent: HTMLElement): HTMLElement => {
  const confirmButton = modalContent.querySelector('[class*="confirmBtn"]');
  if (!confirmButton) throw new Error('Expected atlas modal vote confirmation button.');
  return confirmButton as HTMLElement;
};

const openHistoricalCaseBrief = async (nodeId: string) => {
  renderDemoAtlasNode(nodeId);
  fireEvent.click(await screen.findByRole('button', { name: /Historical Cases/i }));
  fireEvent.click(await screen.findByRole('button', { name: 'View full brief' }));
};

describe('DebateMap', () => {
  afterEach(() => {
    mockNavigate.mockReset();
    mockedGetHistoricalFigureAvatarOrBlockie.mockClear();
    localStorage.removeItem('bookmarkedNodes');
  });

  it('renders the standalone heading as Debate Map', () => {
    render(
      <MemoryRouter>
        <DebateMapComponent
          account=""
          provider=""
          network={{ id: 84532 }}
          activeSessionSlug=""
          toggleLoginModal={jest.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /^Debate Map$/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /^AI Policy Atlas$/i })).not.toBeInTheDocument();
  });

  it('renders circles mode by default in DebateMap', () => {
    render(
      <MemoryRouter>
        <DebateMapComponent
          account=""
          provider=""
          network={{ id: 84532 }}
          activeSessionSlug=""
          toggleLoginModal={jest.fn()}
        />
      </MemoryRouter>,
    );

    expect(
      getAtlasNodeElementById('0x1000000000000000000000000000000000000000000000000000000000000000', 'packed'),
    ).toBeTruthy();
  });

  it('ignores wrong-shaped bookmark storage before rendering bookmarkable list nodes', async () => {
    localStorage.setItem('bookmarkedNodes', '{"bad":true}');

    render(
      <MemoryRouter>
        <DebateMapComponent
          account=""
          provider=""
          network={{ id: 84532 }}
          activeSessionSlug=""
          toggleLoginModal={jest.fn()}
        />
      </MemoryRouter>,
    );

    fireEvent.click(getDebateViewModeButton('list'));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /^Debate Map$/i })).toBeInTheDocument();
      expect(screen.getAllByTestId(E2E_TESTIDS.DEBATE_VIEW_MODE).length).toBeGreaterThan(0);
    });
  });

  it('builds stable keys for reorderable atlas and list items', () => {
    expect(getDebateNodeStableKeyAny({ id: 'node-id', name: 'Name' }, 'fallback')).toBe('node-id');
    expect(getDebateNodeStableKeyAny({ name: 'Name', parentPath: [{ name: 'Parent' }] }, 'fallback')).toBe(
      'Parent/Name',
    );
    expect(getDebateNodeStableKeyAny({ name: 'Name' }, 'fallback')).toBe('Name');
    expect(getDebateNodeStableKeyAny({}, 'fallback')).toBe('fallback');
    expect(getDebateNodeListStableKeysAny([{ name: 'Name' }, { name: 'Name' }], 'top-node')).toEqual([
      'Name',
      'Name:2',
    ]);
    expect(getDebateQuestionStableKeyAny({ id: 'q1', prompt: 'Prompt' }, 'fallback')).toBe('q1');
    expect(getDebateQuestionStableKeyAny({ prompt: 'Prompt' }, 'fallback')).toBe('fallback:Prompt');
    expect(
      getDebateQuestionListStableKeysAny(
        [{ prompt: 'Same prompt' }, { prompt: 'Same prompt' }, { id: 'q3', prompt: 'Same prompt' }],
        'question-card',
      ),
    ).toEqual(['question-card:Same prompt', 'question-card:Same prompt:2', 'q3']);
    expect(getDebateTagStableKeysAny(['tax', 'Tax', 'energy'])).toEqual(['tag:tax', 'tag:Tax:2', 'tag:energy']);

    expect(
      getAtlasLinkStableKeyAny(
        {
          sourceId: 'source-id',
          targetId: 'target-id',
          source: { x: 1, y: 2 },
          target: { x: 3, y: 4 },
        },
        0,
      ),
    ).toBe('source-id->target-id');
    expect(
      getAtlasLinkStableKeyAny(
        {
          source: { x: 1, y: 2 },
          target: { x: 3, y: 4 },
        },
        7,
      ),
    ).toBe('coords:1.000:2.000:3.000:4.000:7');
  });

  it('finds top atlas nodes by heat without changing pre-order tie behavior', () => {
    const topNodes = getTopAtlasNodesByHeatAny(
      [
        {
          id: 'early-tie',
          votes: { up: 5, down: 0 },
          children: [
            {
              id: 'nested-high',
              votes: { up: 9, down: 0 },
            },
          ],
        },
        {
          id: 'comment-heavy',
          votes: { up: 3, down: 0 },
          comments: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }],
        },
        {
          id: 'late-tie',
          votes: { up: 5, down: 0 },
        },
      ],
      3,
    );

    expect(topNodes.map((node: any) => node.id)).toEqual(['comment-heavy', 'nested-high', 'early-tie']);
  });

  it('switches between circles and atlas from the main mode controls', () => {
    render(
      <MemoryRouter>
        <DebateMapComponent
          account=""
          provider=""
          network={{ id: 84532 }}
          activeSessionSlug=""
          toggleLoginModal={jest.fn()}
        />
      </MemoryRouter>,
    );

    expect(
      getAtlasNodeElementById('0x1000000000000000000000000000000000000000000000000000000000000000', 'packed'),
    ).toBeTruthy();

    fireEvent.click(getDebateViewModeButton('atlas'));

    expect(
      getAtlasNodeElementById('0x1000000000000000000000000000000000000000000000000000000000000000', 'orbital'),
    ).toBeTruthy();
    expect(
      getAtlasNodeElementById('0x1000000000000000000000000000000000000000000000000000000000000000', 'packed'),
    ).toBeFalsy();

    fireEvent.click(getDebateViewModeButton('circles'));

    expect(
      getAtlasNodeElementById('0x1000000000000000000000000000000000000000000000000000000000000000', 'packed'),
    ).toBeTruthy();
  });

  it('starts in atlas mode when explicitly configured', () => {
    render(
      <MemoryRouter>
        <DebateMapComponent
          account=""
          provider=""
          network={{ id: 84532 }}
          activeSessionSlug=""
          toggleLoginModal={jest.fn()}
          atlasLayoutMode="orbital"
        />
      </MemoryRouter>,
    );

    expect(
      getAtlasNodeElementById('0x1000000000000000000000000000000000000000000000000000000000000000', 'orbital'),
    ).toBeTruthy();
  });

  it('builds historical compass points using the current vote for x and other votes for y', () => {
    const nodeId = '0x1130000000000000000000000000000000000000000000000000000000000000';
    const [point] = buildHistoricalCompassPointsAny([{ username: 'AdaLovelace', value: 7 }], [], nodeId);

    expect(point).toMatchObject({
      name: 'AdaLovelace',
      type: 'historical',
    });
    expect(point.x).toBeCloseTo(0.9375);
    expect(point.y).toBeCloseTo(0.625);
    expect(point.color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('keeps the governance compass sample distributed across all populated quadrants', () => {
    const voteEntries = getVoteEntriesForNode(governanceCategoryNodeId);

    const points = buildHistoricalCompassPointsAny(voteEntries, [], governanceCategoryNodeId) as any[];
    const quadrantKeys = new Set(points.map(getQuadrantKey));

    expect(points).toHaveLength(20);
    expect(points.some((point) => point.x < 0.5)).toBe(true);
    expect(points.some((point) => point.x > 0.5)).toBe(true);
    expect(quadrantKeys).toEqual(new Set(['top-left', 'top-right', 'bottom-left', 'bottom-right']));
  });

  it('keeps every atlas compass directional label within 35 characters', () => {
    const visit = (nodes: any[] = []) => {
      (nodes || []).forEach((node: any) => {
        if (Array.isArray(node.children) && node.children.length > 0) {
          visit(node.children);
          return;
        }

        if (!node.compass) return;

        expect(node.compass.xAxis.left).not.toContain('...');
        expect(node.compass.xAxis.right).not.toContain('...');
        expect(node.compass.yAxis.top).not.toContain('...');
        expect(node.compass.yAxis.bottom).not.toContain('...');
        expect(node.compass.xAxis.left.length).toBeLessThanOrEqual(35);
        expect(node.compass.xAxis.right.length).toBeLessThanOrEqual(35);
        expect(node.compass.yAxis.top.length).toBeLessThanOrEqual(35);
        expect(node.compass.yAxis.bottom.length).toBeLessThanOrEqual(35);
      });
    };

    visit(treeDataFixture);
  });

  it('normalizes enriched historical-case helpers and preserves template fallback copy', () => {
    const enrichedBrief = buildHistoricalCaseBriefAny(
      {
        authors: ['Figure Alpha', 'Figure Beta'],
        category: 'Loophole Finder',
        draft_legal_code: {
          articles: ['Art. 7. Emergency powers expire at sunset.'],
        },
        loophole_exploit: {
          institution: 'Transit hub',
          actor: 'Director',
          action: 'Uses a vague emergency memo to expand surveillance.',
          victims: 'Peaceful protesters',
          why_legal: 'The rule allows incident-specific intelligence.',
          why_immoral: 'The exception swallows the principle.',
        },
        overreach_variant: {
          institution: 'Transit hub',
          actor: 'Watch commander',
          blocked_action: 'Track identified bombers during a live attack.',
          who_gets_harmed: 'Commuters',
          why_illegal: 'Only the director can sign the activation.',
          why_moral: 'The threat is concrete and immediate.',
        },
        concrete_patch_options: [
          {
            name: 'Two-track emergency rule',
            summary: 'Split fast violent-threat use from unrest scenarios.',
            favored_by: 'both',
          },
        ],
        best_patch: 'Two-track emergency rule',
        open_question: 'Should protest unrest ever trigger live facial recognition?',
      },
      {
        name: 'Privacy & Surveillance',
        compass: {
          xAxis: { label: 'liberty' },
          yAxis: { label: 'order' },
        },
      },
    );

    expect(enrichedBrief.draftLegalCode).toEqual({
      articles: [
        {
          label: 'Article 7',
          body: 'Emergency powers expire at sunset.',
        },
      ],
    });
    expect(enrichedBrief.adversarialAttack.panels).toHaveLength(2);
    expect(enrichedBrief.patchOptions[0]).toMatchObject({
      name: 'Two-track emergency rule',
      favoredBy: ['Figure Alpha', 'Figure Beta'],
    });

    const fallbackBrief = buildHistoricalCaseBriefAny(
      {
        authors: ['Ada Lovelace', 'Grace Hopper'],
        category: 'Loophole Finder',
        summary: 'Template fallback summary.',
      },
      {
        name: 'Privacy & Surveillance',
        compass: {
          xAxis: { label: 'Liberty' },
          yAxis: { label: 'Order' },
        },
      },
    );

    expect(typeof fallbackBrief.draftLegalCode).toBe('string');
    expect(fallbackBrief.adversarialAttack.fallbackText).toMatch(/Loophole Finder case/i);
    expect(fallbackBrief.patchOptions).toEqual([]);
    expect(fallbackBrief.decisionPrompt).toMatch(/What patch closes the exploit in Privacy & Surveillance/i);
  });

  it('builds historical case briefs only for the expanded case key', () => {
    const brief = buildHistoricalCaseBriefAny(
      { title: 'Expanded case', summary: 'Expanded summary.' },
      { name: 'Liability Frameworks' },
    );
    const buildBrief = jest.fn(() => brief);
    const historicalCases = [
      { id: 'collapsed-case', title: 'Collapsed case', summary: 'Collapsed summary.' },
      { id: 'expanded-case', title: 'Expanded case', summary: 'Expanded summary.' },
    ];

    const collapsedBriefs = buildExpandedHistoricalCaseBriefMapAny(
      historicalCases,
      { id: 'node-a', name: 'Liability Frameworks' },
      '',
      buildBrief,
    );
    expect(collapsedBriefs.size).toBe(0);
    expect(buildBrief).not.toHaveBeenCalled();

    const expandedBriefs = buildExpandedHistoricalCaseBriefMapAny(
      historicalCases,
      { id: 'node-a', name: 'Liability Frameworks' },
      'expanded-case',
      buildBrief,
    );

    expect(buildBrief).toHaveBeenCalledTimes(1);
    expect(buildBrief).toHaveBeenCalledWith(historicalCases[1], { id: 'node-a', name: 'Liability Frameworks' });
    expect(expandedBriefs.get('expanded-case')).toBe(brief);
  });

  it('compacts long tree labels and child layouts for denser debate branches', () => {
    expect(getCompactTreeNodeLabelAny('3. AI Governance & Policy')).toBe('AI Governance & Policy');
    expect(getCompactTreeNodeLabelAny('International Coordination')).toBe('Intl. Coord.');
    expect(getCompactTreeNodeLabelAny('Pre-deployment Testing')).toBe('Pre-deploy. Testing');
    expect(getTreeChildColumnCountAny(1, 4)).toBe(2);
    expect(getTreeChildColumnCountAny(0, 2)).toBe(2);
    expect(
      getTreeSubtreeSpanAny({
        children: [{ children: [{}, {}] }, {}],
      }),
    ).toBe(3);
    expect(getTreeChildStaggerPxAny(2, 1, 2)).toBeGreaterThan(getTreeChildStaggerPxAny(2, 0, 2));
    expect(getTreeChildStaggerPxAny(2, 3, 2)).toBeGreaterThan(getTreeChildStaggerPxAny(2, 1, 2));
    expect(getTreeViewportFitScaleAny(320, 960)).toBeCloseTo(0.3, 1);
    expect(getTreeViewportFitScaleAny(1024, 800)).toBe(1);
    expect(getTreeViewportFitHeightAny(1200, 0.5)).toBe(600);
  });

  it('refreshes the drilled atlas node immediately when the data prop changes', () => {
    const onNodeClick = jest.fn();
    const initialData = [
      {
        id: 'parent-node',
        name: 'Parent Node',
        children: [{ id: 'child-node', name: 'Child A' }],
      },
    ];
    const updatedData = [
      {
        id: 'parent-node',
        name: 'Parent Node',
        children: [{ id: 'child-node', name: 'Child B' }],
      },
    ];

    const { rerender } = render(<AtlasViewComponent data={initialData} onNodeClick={onNodeClick} />);

    fireEvent.click(
      screen
        .getAllByText('Parent Node')
        .find((element) => String(element.className || '').includes('nodeLabel')) as HTMLElement,
    );

    expect(screen.getByText(/Up Level/i)).toBeInTheDocument();
    expect(screen.getAllByText('Child A').length).toBeGreaterThan(0);

    rerender(<AtlasViewComponent data={updatedData} onNodeClick={onNodeClick} />);

    expect(screen.getAllByText('Child B').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Child A')).toHaveLength(0);
  });

  it('sizes atlas nodes by disagreement instead of raw vote volume', () => {
    render(
      <AtlasViewComponent
        data={[
          {
            id: 'low-disagreement',
            name: 'Low Disagreement',
            votes: { up: 60, down: 4 },
          },
          {
            id: 'high-disagreement',
            name: 'High Disagreement',
            votes: { up: 18, down: 16 },
          },
        ]}
        onNodeClick={jest.fn()}
      />,
    );

    expect(getAtlasNodeDiameter('High Disagreement')).toBeGreaterThan(getAtlasNodeDiameter('Low Disagreement'));
  });

  it('renders nested packed atlas nodes in circles mode', () => {
    render(
      <MemoryRouter>
        <DebateMapComponent
          account=""
          provider=""
          network={{ id: 84532 }}
          activeSessionSlug=""
          toggleLoginModal={jest.fn()}
        />
      </MemoryRouter>,
    );

    expect(
      getAtlasNodeElementById('0x1000000000000000000000000000000000000000000000000000000000000000', 'packed'),
    ).toBeTruthy();
    expect(getAtlasNodeElementById(deceptiveAlignmentNodeId, 'packed')).toBeTruthy();
  });

  it('drills into packed top-level parent circles and uses the title action to open them', () => {
    const onNodeClick = jest.fn();

    render(
      <AtlasViewComponent
        data={[
          {
            id: 'parent-node',
            name: 'Parent Node',
            children: [{ id: 'child-node', name: 'Child Node' }],
          },
        ]}
        onNodeClick={onNodeClick}
        atlasLayoutMode="packed"
      />,
    );

    fireEvent.click(getAtlasNodeElementById('parent-node', 'packed') as HTMLElement);

    expect(screen.getByRole('button', { name: /up level/i })).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.ATLAS_TITLE_ACTION)).toHaveTextContent('Parent Node');
    expect(getAtlasNodeElementById('child-node', 'packed')).toBeTruthy();

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.ATLAS_TITLE_ACTION));

    expect(onNodeClick).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'parent-node' }));
  });

  it('drills into packed child circles, hides the outer root circle, and exposes a clickable title action', () => {
    const onNodeClick = jest.fn();

    render(
      <AtlasViewComponent
        data={[
          {
            id: 'parent-node',
            name: 'Parent Node',
            children: [
              {
                id: 'child-node',
                name: 'Child Node',
                children: [{ id: 'grandchild-node', name: 'Grandchild Node' }],
              },
            ],
          },
        ]}
        onNodeClick={onNodeClick}
        atlasLayoutMode="packed"
      />,
    );

    fireEvent.click(getAtlasNodeElementById('child-node', 'packed') as HTMLElement);

    expect(screen.getByRole('button', { name: /up level/i })).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.ATLAS_TITLE_ACTION)).toHaveTextContent('Parent Node');
    expect(getAtlasNodeElementById('child-node', 'packed')).toBeTruthy();

    fireEvent.click(getAtlasNodeElementById('child-node', 'packed') as HTMLElement);

    expect(screen.getByRole('button', { name: /up level/i })).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.ATLAS_TITLE_ACTION)).toHaveTextContent('Child Node');
    expect(getAtlasNodeElementById('child-node', 'packed')).toBeFalsy();
    expect(getAtlasNodeElementById('grandchild-node', 'packed')).toBeTruthy();

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.ATLAS_TITLE_ACTION));

    expect(onNodeClick).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'child-node' }));
  });

  it('swaps packed root labels from parent titles to child titles when hovering within a cluster', () => {
    render(
      <AtlasViewComponent
        data={[
          {
            id: 'parent-node',
            name: 'Parent Node',
            children: [
              { id: 'child-node-a', name: 'Child Node A' },
              { id: 'child-node-b', name: 'Child Node B' },
            ],
          },
        ]}
        onNodeClick={jest.fn()}
        atlasLayoutMode="packed"
      />,
    );

    expect(String(getPackedNodeLabel('Parent Node')?.className || '')).toContain('alwaysVisible');
    expect(String(getPackedNodeLabel('Child Node A')?.className || '')).not.toContain('alwaysVisible');

    fireEvent.mouseEnter(getAtlasNodeElementById('child-node-a', 'packed') as HTMLElement);

    expect(String(getPackedNodeLabel('Parent Node')?.className || '')).not.toContain('alwaysVisible');
    expect(String(getPackedNodeLabel('Child Node A')?.className || '')).toContain('alwaysVisible');
    expect(String(getPackedNodeLabel('Child Node B')?.className || '')).toContain('alwaysVisible');
  });

  it('opens atlas leaf modals from the packed layout', async () => {
    render(
      <MemoryRouter>
        <DebateMapComponent
          account=""
          provider=""
          network={{ id: 84532 }}
          activeSessionSlug=""
          toggleLoginModal={jest.fn()}
        />
      </MemoryRouter>,
    );

    fireEvent.click(getAtlasNodeElementById(deceptiveAlignmentNodeId, 'packed') as HTMLElement);
    expect(screen.getByTestId(E2E_TESTIDS.ATLAS_TITLE_ACTION)).toHaveTextContent('AI Safety & Alignment');

    fireEvent.click(getAtlasNodeElementById(deceptiveAlignmentNodeId, 'packed') as HTMLElement);
    expect(screen.getByTestId(E2E_TESTIDS.ATLAS_TITLE_ACTION)).toHaveTextContent('Alignment Research');

    fireEvent.click(getAtlasNodeElementById(deceptiveAlignmentNodeId, 'packed') as HTMLElement);

    expect(await screen.findByRole('heading', { name: 'Deceptive Alignment' })).toBeInTheDocument();
  });

  it('renders tree mode with abbreviated labels and wrapped child columns', () => {
    const { container } = render(
      <MemoryRouter>
        <DebateMapComponent
          account=""
          provider=""
          network={{ id: 84532 }}
          activeSessionSlug=""
          toggleLoginModal={jest.fn()}
        />
      </MemoryRouter>,
    );

    fireEvent.click(getDebateViewModeButton('tree'));
    fireEvent.click(screen.getByRole('button', { name: 'AI Governance & Policy' }));

    const orgChart = container.querySelector('[class*="orgChartContainer"]') as HTMLElement;
    const treeRoot = container.querySelector('[data-ce-tree-scale]') as HTMLElement;

    expect(within(orgChart).getByText('AI Governance & Policy')).toBeInTheDocument();
    expect(within(orgChart).getByText('Intl. Coord.')).toBeInTheDocument();
    expect(within(orgChart).getByText('Licensing & Compute Controls')).toBeInTheDocument();
    expect(treeRoot).toBeTruthy();

    const compactRows = Array.from(container.querySelectorAll('[data-ce-org-total-columns]'));
    expect(compactRows.length).toBeGreaterThan(0);
    expect(compactRows.some((element) => Number(element.getAttribute('data-ce-org-total-columns')) > 2)).toBe(true);
  });

  it('sizes packed atlas nodes by disagreement instead of raw vote volume', () => {
    render(
      <AtlasViewComponent
        data={[
          {
            id: 'low-disagreement',
            name: 'Low Disagreement',
            votes: { up: 60, down: 4 },
          },
          {
            id: 'high-disagreement',
            name: 'High Disagreement',
            votes: { up: 18, down: 16 },
          },
        ]}
        onNodeClick={jest.fn()}
        atlasLayoutMode="packed"
      />,
    );

    expect(getAtlasNodeDiameterById('high-disagreement', 'packed')).toBeGreaterThan(
      getAtlasNodeDiameterById('low-disagreement', 'packed'),
    );
  });

  it('applies much larger packed label sizing to large top-level circles', () => {
    const topLevelSize = getPackedAtlasLabelFontSizePxAny({ hierarchyDepth: 1, isCenter: false }, 520, true);
    const childSize = getPackedAtlasLabelFontSizePxAny({ hierarchyDepth: 2, isCenter: false }, 220, false);
    const leafSize = getPackedAtlasLabelFontSizePxAny({ hierarchyDepth: 3, isCenter: false }, 80, false);

    expect(topLevelSize).toBeGreaterThanOrEqual(32);
    expect(topLevelSize).toBeGreaterThan(childSize);
    expect(childSize).toBeGreaterThan(leafSize);
  });

  it('lifts drilled packed circles upward when invisible root slack leaves too much empty space', () => {
    const lift = getPackedAtlasVerticalLiftPxAny(
      [
        { y: 222, r: 120 },
        { y: 224, r: 118 },
        { y: 402, r: 96 },
      ],
      8,
    );

    expect(lift).toBeGreaterThan(90);
    expect(lift).toBeLessThan(110);
  });

  it('routes nested packed-circle clicks to the next visible level instead of skipping ahead', () => {
    const nodesById = new Map([
      ['parent-node', { id: 'parent-node', hierarchyDepth: 1 }],
      ['child-node', { id: 'child-node', hierarchyDepth: 2, groupId: 'parent-node' }],
    ]);

    expect(
      getPackedAtlasClickTargetAny({ id: 'child-node', hierarchyDepth: 2, groupId: 'parent-node' }, nodesById),
    ).toEqual(expect.objectContaining({ id: 'parent-node' }));
    expect(getPackedAtlasClickTargetAny({ id: 'parent-node', hierarchyDepth: 1 }, nodesById)).toEqual(
      expect.objectContaining({ id: 'parent-node' }),
    );
  });

  it('removes historical demo questions immediately when demo mode turns off', async () => {
    const baseProps = {
      account: '',
      provider: '',
      network: { id: 84532 },
      activeSessionSlug: '',
      toggleLoginModal: jest.fn(),
    };

    const { rerender } = render(
      <MemoryRouter>
        <DebateMapComponent {...baseProps} demoMode={true} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /List/i }));
    fireEvent.click(screen.getByRole('button', { name: currentDemoLeafFixture.leafName }));

    expect(await screen.findByText(currentDemoLeafFixture.questionText)).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <DebateMapComponent {...baseProps} demoMode={false} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.queryByText(currentDemoLeafFixture.questionText)).not.toBeInTheDocument();
    });
  });

  it('prefers local historical avatars for demo question authors', async () => {
    const baseProps = {
      account: '',
      provider: '',
      network: { id: 84532 },
      activeSessionSlug: '',
      toggleLoginModal: jest.fn(),
    };

    render(
      <MemoryRouter>
        <DebateMapComponent {...baseProps} demoMode={true} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /List/i }));
    fireEvent.click(screen.getByRole('button', { name: currentDemoLeafFixture.leafName }));
    fireEvent.click(await screen.findByRole('button', { name: /Questions/i }));

    expect(await screen.findByText(currentDemoLeafFixture.questionText)).toBeInTheDocument();

    await waitFor(() => {
      expect(mockedGetHistoricalFigureAvatarOrBlockie).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          preferBlockie: false,
        }),
      );
    });
  });

  it('opens key arguments by default and keeps historical briefs collapsed on atlas node entry', async () => {
    renderDemoAtlasNode(privacyAndSurveillanceNodeId);

    expect(await screen.findByRole('heading', { name: 'Privacy & Surveillance' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Key Arguments/i })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('heading', { name: 'For' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Historical Cases/i })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'View full brief' })).not.toBeInTheDocument();
  });

  it('preserves local atlas votes across demo-mode tree rebuilds', async () => {
    renderDemoAtlasNode(liabilityFrameworksNodeId);

    expect(await screen.findByRole('heading', { name: 'Liability Frameworks' })).toBeInTheDocument();
    const modal = getAtlasModalContent('Liability Frameworks');
    const initialScore = getAtlasModalNetVoteScore(modal);

    fireEvent.click(within(modal).getByTitle('Cast Upvotes'));
    fireEvent.change(within(modal).getByRole('spinbutton'), { target: { value: '3' } });
    fireEvent.click(getAtlasModalConfirmVoteButton(modal));

    await waitFor(() => {
      expect(getAtlasModalNetVoteScore(getAtlasModalContent('Liability Frameworks'))).toBe(initialScore + 3);
    });

    const demoModeCheckbox = screen.getByLabelText(/Demo Mode/i);
    fireEvent.click(demoModeCheckbox);
    await waitFor(() => {
      expect(demoModeCheckbox).not.toBeChecked();
    });

    fireEvent.click(demoModeCheckbox);
    await waitFor(() => {
      expect(demoModeCheckbox).toBeChecked();
      expect(getAtlasModalNetVoteScore(getAtlasModalContent('Liability Frameworks'))).toBe(initialScore + 3);
    });
  });

  it('renders enriched Loophole historical cases inside relevant atlas nodes in demo mode', async () => {
    const privacyCase = getHistoricalCaseForNode(privacyAndSurveillanceNodeId);

    renderDemoAtlasNode(privacyAndSurveillanceNodeId);

    expect(await screen.findByText('Historical Cases')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Historical Cases/i }));
    expect(await screen.findByText(privacyCase.title)).toBeInTheDocument();
    expect(screen.getAllByText(/Loophole Finder/i).length).toBeGreaterThan(0);
    expect(screen.getByText(privacyCase.summary)).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.ATLAS_HISTORICAL_CASE_EXPAND)).toHaveAttribute(
      'data-ce-case-id',
      privacyCase.id,
    );
    expect(screen.getByRole('link', { name: 'Loophole methodology' })).toHaveAttribute(
      'href',
      'https://github.com/brendanhogan/loophole',
    );
  });

  it('expands Privacy & Surveillance into structured enriched historical-case detail', async () => {
    const privacyCase = getHistoricalCaseForNode(privacyAndSurveillanceNodeId);

    await openHistoricalCaseBrief(privacyAndSurveillanceNodeId);

    expect(await screen.findByText('Moral principles')).toBeInTheDocument();
    expect(screen.getByText('Draft legal code')).toBeInTheDocument();
    expect(screen.getByText('Adversarial attack')).toBeInTheDocument();
    expect(screen.getByText('Why this case is hard')).toBeInTheDocument();
    expect(screen.getByText('Judge tension')).toBeInTheDocument();
    expect(screen.getByText('Precedent pressure')).toBeInTheDocument();
    expect(screen.getByText('Patch options')).toBeInTheDocument();
    expect(screen.getByText('Why the runner-up fails')).toBeInTheDocument();
    expect(screen.getByText('Open question')).toBeInTheDocument();
    expect(screen.getByText('Article 1')).toBeInTheDocument();
    expect(
      screen.getByText(
        /A metropolitan port authority may activate live facial-recognition surveillance only during a declared transportation security emergency/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Loophole exploit')).toBeInTheDocument();
    expect(screen.getByText('Overreach variant')).toBeInTheDocument();
    expect(screen.getByText(/Bay City Port Authority central rail terminal/i)).toBeInTheDocument();
    expect(screen.getByText(/Harbor Metro Station emergency operations center/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Should protest-related unrest ever qualify as a facial-recognition emergency trigger/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/In Re Harbor Terminal Emergency Scan/i)).toBeInTheDocument();
    expect(screen.queryByText('[object Object]')).not.toBeInTheDocument();

    const bestPatchCard = screen
      .getAllByTestId(E2E_TESTIDS.ATLAS_HISTORICAL_CASE_PATCH_CARD)
      .find((element) => element.getAttribute('data-ce-patch-kind') === 'best');
    expect(bestPatchCard).toBeTruthy();
    expect(within(bestPatchCard as HTMLElement).getByText('Best patch')).toBeInTheDocument();
    expect(within(bestPatchCard as HTMLElement).getByText('James Madison')).toBeInTheDocument();
    expect(within(bestPatchCard as HTMLElement).getByText('Augustus Caesar')).toBeInTheDocument();
    expect(within(bestPatchCard as HTMLElement).queryByText('Figure A')).not.toBeInTheDocument();
    expect(within(bestPatchCard as HTMLElement).queryByText('Figure B')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Hide brief' }));

    await waitFor(() => {
      expect(screen.queryByText('Moral principles')).not.toBeInTheDocument();
    });
  });

  it.each([deceptiveAlignmentNodeId, liabilityFrameworksNodeId])(
    'renders enriched historical-case detail for node %s without leaking raw objects',
    async (nodeId) => {
      const historicalCase = getHistoricalCaseForNode(nodeId);

      await openHistoricalCaseBrief(nodeId);

      expect(await screen.findByText(historicalCase.title)).toBeInTheDocument();
      expect(screen.getByText(historicalCase.open_question.trim())).toBeInTheDocument();
      expect(screen.getAllByText(historicalCase.best_patch).length).toBeGreaterThan(0);
      expect(screen.getByText('Loophole exploit')).toBeInTheDocument();
      expect(screen.getByText('Overreach variant')).toBeInTheDocument();
      expect(screen.queryByText('[object Object]')).not.toBeInTheDocument();
    },
  );

  it('keeps Loophole historical cases out of non-demo atlas nodes', async () => {
    render(
      <MemoryRouter initialEntries={['/atlas/0x4320000000000000000000000000000000000000000000000000000000000000']}>
        <Routes>
          <Route
            path="/atlas/:nodeId"
            element={
              <DebateMapComponent
                account=""
                provider=""
                network={{ id: 84532 }}
                activeSessionSlug=""
                toggleLoginModal={jest.fn()}
                demoMode={false}
              />
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole('heading', { name: 'Privacy & Surveillance' });

    expect(screen.queryByText('Historical Cases')).not.toBeInTheDocument();
    expect(screen.queryByText(getHistoricalCaseForNode(privacyAndSurveillanceNodeId).title)).not.toBeInTheDocument();
  });

  it('copies atlas deep links with PUBLIC_URL and demo mode preserved without the return target', async () => {
    const previousPublicUrl = mutableEnv.PUBLIC_URL;
    const previousClipboard = navigator.clipboard;
    const writeText = jest.fn().mockResolvedValue(undefined);
    mutableEnv.PUBLIC_URL = '/ce/';
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    try {
      render(
        <MemoryRouter
          initialEntries={[
            '/atlas/0x1110000000000000000000000000000000000000000000000000000000000000?returnTo=%2Fsu%2FFranklin',
          ]}
        >
          <Routes>
            <Route
              path="/atlas/:nodeId"
              element={
                <DebateMapComponent
                  account=""
                  provider=""
                  network={{ id: 84532 }}
                  activeSessionSlug=""
                  toggleLoginModal={jest.fn()}
                  demoMode={true}
                />
              }
            />
          </Routes>
        </MemoryRouter>,
      );

      fireEvent.click(await screen.findByTitle('Copy Deep Link URL'));

      await waitFor(() => {
        expect(writeText).toHaveBeenCalledWith(
          'http://localhost/ce/atlas/0x1110000000000000000000000000000000000000000000000000000000000000?demo=1',
        );
      });
    } finally {
      if (previousPublicUrl === undefined) delete mutableEnv.PUBLIC_URL;
      else mutableEnv.PUBLIC_URL = previousPublicUrl;
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: previousClipboard,
      });
    }
  });

  it('preserves the active session pin when opening tag pages from atlas tags', async () => {
    render(
      <MemoryRouter initialEntries={['/atlas/0x1110000000000000000000000000000000000000000000000000000000000000']}>
        <Routes>
          <Route
            path="/atlas/:nodeId"
            element={
              <DebateMapComponent
                account=""
                provider=""
                network={{ id: 84532 }}
                activeSessionSlug="edge"
                toggleLoginModal={jest.fn()}
              />
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'AI Safety' }));

    expect(mockNavigate).toHaveBeenCalledWith('/tag/AI%20Safety?session=edge');
  });

  it('opens a requested atlas node modal and notifies the parent when it closes', async () => {
    const onModalClose = jest.fn();

    render(
      <MemoryRouter>
        <DebateMapComponent
          account=""
          provider=""
          network={{ id: 84532 }}
          activeSessionSlug=""
          toggleLoginModal={jest.fn()}
          embedded={true}
          demoMode={true}
          requestedModalNodeId="0x1110000000000000000000000000000000000000000000000000000000000000"
          onModalClose={onModalClose}
        />
      </MemoryRouter>,
    );

    expect(await screen.findByTitle('Copy Deep Link URL')).toBeInTheDocument();
    expect(screen.getByTitle('Copy Deep Link URL')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Close'));

    await waitFor(() => {
      expect(screen.queryByTitle('Copy Deep Link URL')).not.toBeInTheDocument();
    });
    expect(onModalClose).toHaveBeenCalledTimes(1);
  });

  it('returns to the originating route when a deep-linked atlas modal closes', async () => {
    mockNavigate.mockClear();

    render(
      <MemoryRouter
        initialEntries={[
          '/atlas/0x1110000000000000000000000000000000000000000000000000000000000000?demo=1&returnTo=%2Fsu%2FFranklin%3Ftab%3Datlas%23positions',
        ]}
      >
        <Routes>
          <Route
            path="/atlas/:nodeId"
            element={
              <DebateMapComponent
                account=""
                provider=""
                network={{ id: 84532 }}
                activeSessionSlug=""
                toggleLoginModal={jest.fn()}
                demoMode={true}
              />
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByTitle('Copy Deep Link URL')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Close'));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/su/Franklin?tab=atlas#positions', { replace: true });
    });
  });

  it.each([
    ['has no return target', ''],
    ['has an unsafe return target', '?returnTo=https%3A%2F%2Fevil.example%2Fsteal'],
  ])('returns to the atlas index when a deep-linked modal %s', async (_case, search) => {
    mockNavigate.mockClear();

    render(
      <MemoryRouter
        initialEntries={[`/atlas/0x1110000000000000000000000000000000000000000000000000000000000000${search}`]}
      >
        <Routes>
          <Route
            path="/atlas/:nodeId"
            element={
              <DebateMapComponent
                account=""
                provider=""
                network={{ id: 84532 }}
                activeSessionSlug=""
                toggleLoginModal={jest.fn()}
                demoMode={true}
              />
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByTitle('Close'));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/atlas', { replace: true });
    });
    expect(mockNavigate).not.toHaveBeenCalledWith(-1);
  });

  it('resets atlas modal scroll position when switching to a different requested node', async () => {
    const baseProps = {
      account: '',
      provider: '',
      network: { id: 84532 },
      activeSessionSlug: '',
      toggleLoginModal: jest.fn(),
      embedded: true,
      demoMode: true,
    };

    const { rerender } = render(
      <MemoryRouter>
        <DebateMapComponent {...baseProps} requestedModalNodeId={privacyAndSurveillanceNodeId} />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Privacy & Surveillance' })).toBeInTheDocument();

    const firstModalContent = getAtlasModalContent('Privacy & Surveillance');
    firstModalContent.scrollTop = 320;
    firstModalContent.scrollLeft = 48;

    rerender(
      <MemoryRouter>
        <DebateMapComponent {...baseProps} requestedModalNodeId={deceptiveAlignmentNodeId} />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Deceptive Alignment' })).toBeInTheDocument();

    const secondModalContent = getAtlasModalContent('Deceptive Alignment');
    await waitFor(() => {
      expect(secondModalContent.scrollTop).toBe(0);
      expect(secondModalContent.scrollLeft).toBe(0);
    });
  });

  it('adds the embedded wrapper modifier only when embedded mode is enabled', () => {
    const baseProps = {
      account: '',
      provider: '',
      network: { id: 84532 },
      activeSessionSlug: '',
      toggleLoginModal: jest.fn(),
    };

    const { container, rerender } = render(
      <MemoryRouter>
        <DebateMapComponent {...baseProps} />
      </MemoryRouter>,
    );

    expect(container.firstChild).toHaveClass('debateMapWrapper');
    expect(container.firstChild).toHaveClass('standaloneAtlas');
    expect(container.firstChild).not.toHaveClass('embeddedAtlas');

    rerender(
      <MemoryRouter>
        <DebateMapComponent {...baseProps} embedded={true} />
      </MemoryRouter>,
    );

    expect(container.firstChild).toHaveClass('debateMapWrapper');
    expect(container.firstChild).toHaveClass('embeddedAtlas');
    expect(container.firstChild).not.toHaveClass('standaloneAtlas');
  });
});
