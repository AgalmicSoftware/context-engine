import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import DebateMap, { AtlasView, buildHistoricalCaseBrief, buildHistoricalCompassPoints } from './DebateMap.jsx';
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

jest.mock('../Shared/AudioInput/AudioInput.jsx', () => () => <div data-testid="atlas-audio-input" />);
jest.mock('../../utilities/arweave/arweaveScripts.js', () => ({
  arweaveScripts: {
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
jest.mock('../DemoViews/DebateHUD/PoliticalCompassView.jsx', () => ({
  __esModule: true,
  StandalonePoliticalCompass: ({ compass }) => (
    <div data-testid="atlas-compass">{compass?.xAxis?.label || 'Political Compass'}</div>
  ),
}));

const getCurrentDemoLeafFixture = () => {
  const questionsById = new Map();

  Object.values(historicalFigureData || {}).forEach((figure) => {
    (figure?.questions || []).forEach((question) => {
      if (!questionsById.has(question.id)) {
        questionsById.set(question.id, []);
      }
      questionsById.get(question.id).push(question.question);
    });
  });

  let selectedLeaf = null;

  const visit = (nodes, depth = 0) => {
    (nodes || []).forEach((node) => {
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

  visit(treeData);

  if (!selectedLeaf) {
    throw new Error('Expected a deepest atlas leaf with demo historical questions.');
  }

  return selectedLeaf;
};

const currentDemoLeafFixture = getCurrentDemoLeafFixture();
const governanceCategoryNodeId = '0x3000000000000000000000000000000000000000000000000000000000000000';
const parseHistoricalVote = (vote) => {
  if (vote === 'up') return 1;
  if (vote === 'down') return -1;

  const parsedVote = parseInt(vote, 10);
  return Number.isNaN(parsedVote) ? null : parsedVote;
};
const getQuadrantKey = (point) => (
  `${point.y > 0.5 ? 'top' : 'bottom'}-${point.x > 0.5 ? 'right' : 'left'}`
);
const getVoteEntriesForNode = (nodeId) => (
  Object.entries(historicalFigureData || {}).reduce((entries, [username, figure]) => {
    const parsedVote = parseHistoricalVote(figure?.votes?.[nodeId]);
    if (!Number.isFinite(parsedVote)) return entries;
    return entries.concat({ username, value: parsedVote });
  }, [])
);
const getAtlasNodeLabel = (label) => (
  screen.getAllByText(label).find((element) => (
    String(element.className || '').includes('nodeLabel')
  ))
);
const getAtlasNodeDiameter = (label) => {
  const labelElement = getAtlasNodeLabel(label);
  expect(labelElement).toBeTruthy();
  const dotElement = labelElement.parentElement?.querySelector('[class*="nodeDot"]');
  expect(dotElement).toBeTruthy();
  return parseFloat(dotElement.style.width);
};
const getAtlasNodeElementById = (nodeId, layout = '') => (
  screen.getAllByTestId(E2E_TESTIDS.ATLAS_NODE).find((element) => (
    element.getAttribute('data-ce-node-id') === nodeId
      && (!layout || element.getAttribute('data-ce-node-layout') === layout)
  ))
);
const getDebateViewModeButton = (mode) => (
  screen.getAllByTestId(E2E_TESTIDS.DEBATE_VIEW_MODE).find((element) => (
    element.getAttribute('data-ce-view-mode') === mode
  ))
);
const getPackedNodeLabel = (label) => (
  screen.getAllByText(label).find((element) => (
    String(element.className || '').includes('packedNodeLabel')
  ))
);
const getAtlasNodeDiameterById = (nodeId, layout = '') => {
  const nodeElement = getAtlasNodeElementById(nodeId, layout);
  expect(nodeElement).toBeTruthy();
  const dotElement = nodeElement.querySelector('[class*="nodeDot"]');
  expect(dotElement).toBeTruthy();
  return parseFloat(dotElement.style.width);
};
const privacyAndSurveillanceNodeId = '0x4320000000000000000000000000000000000000000000000000000000000000';
const deceptiveAlignmentNodeId = '0x1110000000000000000000000000000000000000000000000000000000000000';
const liabilityFrameworksNodeId = '0x3140000000000000000000000000000000000000000000000000000000000000';

const getHistoricalCaseForNode = (nodeId) => {
  const matchedCase = (Array.isArray(loopholeHistoricalCases) ? loopholeHistoricalCases : []).find((historicalCase) => (
    Array.isArray(historicalCase?.debate_map_issues)
      && historicalCase.debate_map_issues.includes(nodeId)
  ));

  if (!matchedCase) {
    throw new Error(`Expected a historical case fixture for node ${nodeId}.`);
  }

  return matchedCase;
};

const renderDemoAtlasNode = (nodeId) => render(
  <MemoryRouter initialEntries={[`/atlas/${nodeId}`]}>
    <Routes>
      <Route
        path="/atlas/:nodeId"
        element={(
          <DebateMap
            account=""
            provider=""
            network={{ id: 84532 }}
            activeSessionSlug=""
            toggleLoginModal={jest.fn()}
            demoMode={true}
          />
        )}
      />
    </Routes>
  </MemoryRouter>
);

const openHistoricalCaseBrief = async (nodeId) => {
  renderDemoAtlasNode(nodeId);
  fireEvent.click(await screen.findByRole('button', { name: 'View full brief' }));
};

describe('DebateMap', () => {
  afterEach(() => {
    mockNavigate.mockReset();
    getHistoricalFigureAvatarOrBlockie.mockClear();
  });

  it('renders the standalone heading as Debate Map', () => {
    render(
      <MemoryRouter>
        <DebateMap
          account=""
          provider=""
          network={{ id: 84532 }}
          activeSessionSlug=""
          toggleLoginModal={jest.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /^Debate Map$/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /^AI Policy Atlas$/i })).not.toBeInTheDocument();
  });

  it('renders circles mode by default in DebateMap', () => {
    render(
      <MemoryRouter>
        <DebateMap
          account=""
          provider=""
          network={{ id: 84532 }}
          activeSessionSlug=""
          toggleLoginModal={jest.fn()}
        />
      </MemoryRouter>
    );

    expect(getAtlasNodeElementById('0x1000000000000000000000000000000000000000000000000000000000000000', 'packed')).toBeTruthy();
  });

  it('switches between circles and atlas from the main mode controls', () => {
    render(
      <MemoryRouter>
        <DebateMap
          account=""
          provider=""
          network={{ id: 84532 }}
          activeSessionSlug=""
          toggleLoginModal={jest.fn()}
        />
      </MemoryRouter>
    );

    expect(getAtlasNodeElementById('0x1000000000000000000000000000000000000000000000000000000000000000', 'packed')).toBeTruthy();

    fireEvent.click(getDebateViewModeButton('atlas'));

    expect(getAtlasNodeElementById('0x1000000000000000000000000000000000000000000000000000000000000000', 'orbital')).toBeTruthy();
    expect(getAtlasNodeElementById('0x1000000000000000000000000000000000000000000000000000000000000000', 'packed')).toBeFalsy();

    fireEvent.click(getDebateViewModeButton('circles'));

    expect(getAtlasNodeElementById('0x1000000000000000000000000000000000000000000000000000000000000000', 'packed')).toBeTruthy();
  });

  it('starts in atlas mode when explicitly configured', () => {
    render(
      <MemoryRouter>
        <DebateMap
          account=""
          provider=""
          network={{ id: 84532 }}
          activeSessionSlug=""
          toggleLoginModal={jest.fn()}
          atlasLayoutMode="orbital"
        />
      </MemoryRouter>
    );

    expect(getAtlasNodeElementById('0x1000000000000000000000000000000000000000000000000000000000000000', 'orbital')).toBeTruthy();
  });

  it('builds historical compass points using the current vote for x and other votes for y', () => {
    const nodeId = '0x1130000000000000000000000000000000000000000000000000000000000000';
    const [point] = buildHistoricalCompassPoints([{ username: 'AdaLovelace', value: 7 }], [], nodeId);

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

    const points = buildHistoricalCompassPoints(voteEntries, [], governanceCategoryNodeId);
    const quadrantKeys = new Set(points.map(getQuadrantKey));

    expect(points).toHaveLength(20);
    expect(points.some((point) => point.x < 0.5)).toBe(true);
    expect(points.some((point) => point.x > 0.5)).toBe(true);
    expect(quadrantKeys).toEqual(new Set([
      'top-left',
      'top-right',
      'bottom-left',
      'bottom-right',
    ]));
  });

  it('keeps every atlas compass directional label within 35 characters', () => {
    const visit = (nodes) => {
      (nodes || []).forEach((node) => {
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

    visit(treeData);
  });

  it('normalizes enriched historical-case helpers and preserves template fallback copy', () => {
    const enrichedBrief = buildHistoricalCaseBrief(
      {
        authors: ['Figure Alpha', 'Figure Beta'],
        category: 'Loophole Finder',
        draft_legal_code: {
          articles: [
            'Art. 7. Emergency powers expire at sunset.',
          ],
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
      }
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

    const fallbackBrief = buildHistoricalCaseBrief(
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
      }
    );

    expect(typeof fallbackBrief.draftLegalCode).toBe('string');
    expect(fallbackBrief.adversarialAttack.fallbackText).toMatch(/Loophole Finder case/i);
    expect(fallbackBrief.patchOptions).toEqual([]);
    expect(fallbackBrief.decisionPrompt).toMatch(/What patch closes the exploit in Privacy & Surveillance/i);
  });

  it('refreshes the drilled atlas node immediately when the data prop changes', () => {
    const onNodeClick = jest.fn();
    const initialData = [
      {
        id: 'parent-node',
        name: 'Parent Node',
        children: [
          { id: 'child-node', name: 'Child A' },
        ],
      },
    ];
    const updatedData = [
      {
        id: 'parent-node',
        name: 'Parent Node',
        children: [
          { id: 'child-node', name: 'Child B' },
        ],
      },
    ];

    const { rerender } = render(<AtlasView data={initialData} onNodeClick={onNodeClick} />);

    fireEvent.click(screen.getAllByText('Parent Node').find((element) => (
      String(element.className || '').includes('nodeLabel')
    )));

    expect(screen.getByText(/Up Level/i)).toBeInTheDocument();
    expect(screen.getAllByText('Child A').length).toBeGreaterThan(0);

    rerender(<AtlasView data={updatedData} onNodeClick={onNodeClick} />);

    expect(screen.getAllByText('Child B').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Child A')).toHaveLength(0);
  });

  it('sizes atlas nodes by disagreement instead of raw vote volume', () => {
    render(
      <AtlasView
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
      />
    );

    expect(getAtlasNodeDiameter('High Disagreement')).toBeGreaterThan(
      getAtlasNodeDiameter('Low Disagreement')
    );
  });

  it('renders nested packed atlas nodes in circles mode', () => {
    render(
      <MemoryRouter>
        <DebateMap
          account=""
          provider=""
          network={{ id: 84532 }}
          activeSessionSlug=""
          toggleLoginModal={jest.fn()}
        />
      </MemoryRouter>
    );

    expect(getAtlasNodeElementById('0x1000000000000000000000000000000000000000000000000000000000000000', 'packed')).toBeTruthy();
    expect(getAtlasNodeElementById(deceptiveAlignmentNodeId, 'packed')).toBeTruthy();
  });

  it('drills into packed top-level parent circles and uses the title action to open them', () => {
    const onNodeClick = jest.fn();

    render(
      <AtlasView
        data={[
          {
            id: 'parent-node',
            name: 'Parent Node',
            children: [
              { id: 'child-node', name: 'Child Node' },
            ],
          },
        ]}
        onNodeClick={onNodeClick}
        atlasLayoutMode="packed"
      />
    );

    fireEvent.click(getAtlasNodeElementById('parent-node', 'packed'));

    expect(screen.getByRole('button', { name: /up level/i })).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.ATLAS_TITLE_ACTION)).toHaveTextContent('Parent Node');
    expect(getAtlasNodeElementById('child-node', 'packed')).toBeTruthy();

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.ATLAS_TITLE_ACTION));

    expect(onNodeClick).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'parent-node' }));
  });

  it('drills into packed child circles, hides the outer root circle, and exposes a clickable title action', () => {
    const onNodeClick = jest.fn();

    render(
      <AtlasView
        data={[
          {
            id: 'parent-node',
            name: 'Parent Node',
            children: [
              {
                id: 'child-node',
                name: 'Child Node',
                children: [
                  { id: 'grandchild-node', name: 'Grandchild Node' },
                ],
              },
            ],
          },
        ]}
        onNodeClick={onNodeClick}
        atlasLayoutMode="packed"
      />
    );

    fireEvent.click(getAtlasNodeElementById('child-node', 'packed'));

    expect(screen.getByRole('button', { name: /up level/i })).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.ATLAS_TITLE_ACTION)).toHaveTextContent('Child Node');
    expect(getAtlasNodeElementById('child-node', 'packed')).toBeFalsy();
    expect(getAtlasNodeElementById('grandchild-node', 'packed')).toBeTruthy();

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.ATLAS_TITLE_ACTION));

    expect(onNodeClick).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'child-node' }));
  });

  it('swaps packed root labels from parent titles to child titles when hovering within a cluster', () => {
    render(
      <AtlasView
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
      />
    );

    expect(String(getPackedNodeLabel('Parent Node')?.className || '')).toContain('alwaysVisible');
    expect(String(getPackedNodeLabel('Child Node A')?.className || '')).not.toContain('alwaysVisible');

    fireEvent.mouseEnter(getAtlasNodeElementById('child-node-a', 'packed'));

    expect(String(getPackedNodeLabel('Parent Node')?.className || '')).not.toContain('alwaysVisible');
    expect(String(getPackedNodeLabel('Child Node A')?.className || '')).toContain('alwaysVisible');
    expect(String(getPackedNodeLabel('Child Node B')?.className || '')).toContain('alwaysVisible');
  });

  it('opens atlas leaf modals from the packed layout', async () => {
    render(
      <MemoryRouter>
        <DebateMap
          account=""
          provider=""
          network={{ id: 84532 }}
          activeSessionSlug=""
          toggleLoginModal={jest.fn()}
        />
      </MemoryRouter>
    );

    fireEvent.click(getAtlasNodeElementById(deceptiveAlignmentNodeId, 'packed'));

    expect(await screen.findByRole('heading', { name: 'Deceptive Alignment' })).toBeInTheDocument();
  });

  it('sizes packed atlas nodes by disagreement instead of raw vote volume', () => {
    render(
      <AtlasView
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
      />
    );

    expect(getAtlasNodeDiameterById('high-disagreement', 'packed')).toBeGreaterThan(
      getAtlasNodeDiameterById('low-disagreement', 'packed')
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
        <DebateMap {...baseProps} demoMode={true} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /List/i }));
    fireEvent.click(screen.getByRole('button', { name: currentDemoLeafFixture.leafName }));

    expect(
      await screen.findByText(currentDemoLeafFixture.questionText)
    ).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <DebateMap {...baseProps} demoMode={false} />
      </MemoryRouter>
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
        <DebateMap {...baseProps} demoMode={true} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /List/i }));
    fireEvent.click(screen.getByRole('button', { name: currentDemoLeafFixture.leafName }));
    fireEvent.click(await screen.findByRole('button', { name: /Questions/i }));

    expect(
      await screen.findByText(currentDemoLeafFixture.questionText)
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(getHistoricalFigureAvatarOrBlockie).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          preferBlockie: false,
        })
      );
    });
  });

  it('renders enriched Loophole historical cases inside relevant atlas nodes in demo mode', async () => {
    const privacyCase = getHistoricalCaseForNode(privacyAndSurveillanceNodeId);

    renderDemoAtlasNode(privacyAndSurveillanceNodeId);

    expect(await screen.findByText('Historical Cases')).toBeInTheDocument();
    expect(await screen.findByText(privacyCase.title)).toBeInTheDocument();
    expect(screen.getAllByText(/Loophole Finder/i).length).toBeGreaterThan(0);
    expect(screen.getByText(privacyCase.summary)).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.ATLAS_HISTORICAL_CASE_EXPAND)).toHaveAttribute(
      'data-ce-case-id',
      privacyCase.id
    );
    expect(screen.getByRole('link', { name: 'Loophole methodology' })).toHaveAttribute(
      'href',
      'https://github.com/brendanhogan/loophole'
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
      screen.getByText(/A metropolitan port authority may activate live facial-recognition surveillance only during a declared transportation security emergency/i)
    ).toBeInTheDocument();
    expect(screen.getByText('Loophole exploit')).toBeInTheDocument();
    expect(screen.getByText('Overreach variant')).toBeInTheDocument();
    expect(screen.getByText(/Bay City Port Authority central rail terminal/i)).toBeInTheDocument();
    expect(screen.getByText(/Harbor Metro Station emergency operations center/i)).toBeInTheDocument();
    expect(screen.getByText(/Should protest-related unrest ever qualify as a facial-recognition emergency trigger/i)).toBeInTheDocument();
    expect(screen.getByText(/In Re Harbor Terminal Emergency Scan/i)).toBeInTheDocument();
    expect(screen.queryByText('[object Object]')).not.toBeInTheDocument();

    const bestPatchCard = screen.getAllByTestId(E2E_TESTIDS.ATLAS_HISTORICAL_CASE_PATCH_CARD).find((element) => (
      element.getAttribute('data-ce-patch-kind') === 'best'
    ));
    expect(bestPatchCard).toBeTruthy();
    expect(within(bestPatchCard).getByText('Best patch')).toBeInTheDocument();
    expect(within(bestPatchCard).getByText('James Madison')).toBeInTheDocument();
    expect(within(bestPatchCard).getByText('Augustus Caesar')).toBeInTheDocument();
    expect(within(bestPatchCard).queryByText('Figure A')).not.toBeInTheDocument();
    expect(within(bestPatchCard).queryByText('Figure B')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Hide brief' }));

    await waitFor(() => {
      expect(screen.queryByText('Moral principles')).not.toBeInTheDocument();
    });
  });

  it.each([
    deceptiveAlignmentNodeId,
    liabilityFrameworksNodeId,
  ])('renders enriched historical-case detail for node %s without leaking raw objects', async (nodeId) => {
    const historicalCase = getHistoricalCaseForNode(nodeId);

    await openHistoricalCaseBrief(nodeId);

    expect(await screen.findByText(historicalCase.title)).toBeInTheDocument();
    expect(screen.getByText(historicalCase.open_question.trim())).toBeInTheDocument();
    expect(screen.getAllByText(historicalCase.best_patch).length).toBeGreaterThan(0);
    expect(screen.getByText('Loophole exploit')).toBeInTheDocument();
    expect(screen.getByText('Overreach variant')).toBeInTheDocument();
    expect(screen.queryByText('[object Object]')).not.toBeInTheDocument();
  });

  it('keeps Loophole historical cases out of non-demo atlas nodes', async () => {
    render(
      <MemoryRouter initialEntries={['/atlas/0x4320000000000000000000000000000000000000000000000000000000000000']}>
        <Routes>
          <Route
            path="/atlas/:nodeId"
            element={(
              <DebateMap
                account=""
                provider=""
                network={{ id: 84532 }}
                activeSessionSlug=""
                toggleLoginModal={jest.fn()}
                demoMode={false}
              />
            )}
          />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByRole('heading', { name: 'Privacy & Surveillance' });

    expect(screen.queryByText('Historical Cases')).not.toBeInTheDocument();
    expect(screen.queryByText(getHistoricalCaseForNode(privacyAndSurveillanceNodeId).title)).not.toBeInTheDocument();
  });

  it('copies atlas deep links with PUBLIC_URL and demo mode preserved', async () => {
    const previousPublicUrl = process.env.PUBLIC_URL;
    const previousClipboard = navigator.clipboard;
    const writeText = jest.fn().mockResolvedValue();
    process.env.PUBLIC_URL = '/ce/';
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    try {
      render(
        <MemoryRouter initialEntries={['/atlas/0x1110000000000000000000000000000000000000000000000000000000000000']}>
          <Routes>
            <Route
              path="/atlas/:nodeId"
              element={(
                <DebateMap
                  account=""
                  provider=""
                  network={{ id: 84532 }}
                  activeSessionSlug=""
                  toggleLoginModal={jest.fn()}
                  demoMode={true}
                />
              )}
            />
          </Routes>
        </MemoryRouter>
      );

      fireEvent.click(await screen.findByTitle('Copy Deep Link URL'));

      await waitFor(() => {
        expect(writeText).toHaveBeenCalledWith(
          'http://localhost/ce/atlas/0x1110000000000000000000000000000000000000000000000000000000000000?demo=1'
        );
      });
    } finally {
      if (previousPublicUrl === undefined) delete process.env.PUBLIC_URL;
      else process.env.PUBLIC_URL = previousPublicUrl;
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
            element={(
              <DebateMap
                account=""
                provider=""
                network={{ id: 84532 }}
                activeSessionSlug="edge"
                toggleLoginModal={jest.fn()}
              />
            )}
          />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'AI Safety' }));

    expect(mockNavigate).toHaveBeenCalledWith('/tag/AI%20Safety?session=edge');
  });

  it('opens a requested atlas node modal and notifies the parent when it closes', async () => {
    const onModalClose = jest.fn();

    render(
      <MemoryRouter>
        <DebateMap
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
      </MemoryRouter>
    );

    expect(await screen.findByTitle('Copy Deep Link URL')).toBeInTheDocument();
    expect(screen.getByTitle('Copy Deep Link URL')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Close'));

    await waitFor(() => {
      expect(screen.queryByTitle('Copy Deep Link URL')).not.toBeInTheDocument();
    });
    expect(onModalClose).toHaveBeenCalledTimes(1);
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
        <DebateMap {...baseProps} />
      </MemoryRouter>
    );

    expect(container.firstChild).toHaveClass('debateMapWrapper');
    expect(container.firstChild).toHaveClass('standaloneAtlas');
    expect(container.firstChild).not.toHaveClass('embeddedAtlas');

    rerender(
      <MemoryRouter>
        <DebateMap {...baseProps} embedded={true} />
      </MemoryRouter>
    );

    expect(container.firstChild).toHaveClass('debateMapWrapper');
    expect(container.firstChild).toHaveClass('embeddedAtlas');
    expect(container.firstChild).not.toHaveClass('standaloneAtlas');
  });
});
