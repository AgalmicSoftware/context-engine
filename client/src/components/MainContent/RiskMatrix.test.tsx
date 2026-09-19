import fs from 'fs';
import path from 'path';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import RiskMatrix, { type RiskMatrixRestoreState } from './RiskMatrix';
import debateMapDemoData from '../../variables/demo/debate_map_demo_data.json';
import { riskMatrixAtlasScenarioSamples } from '../../variables/demo/riskMatrixAtlasScenarioData';

const mutableEnv = process.env as Record<string, string | undefined>;
const originalPublicUrl = process.env.PUBLIC_URL;

const collectAtlasNodeIds = (nodes: any[] = []): Set<string> => {
  const ids = new Set<string>();

  const visit = (node: any) => {
    const nodeId = String(node?.id || '').trim();
    if (nodeId) ids.add(nodeId);
    if (Array.isArray(node?.children)) {
      node.children.forEach(visit);
    }
  };

  nodes.forEach(visit);
  return ids;
};

describe('RiskMatrix', () => {
  afterEach(() => {
    if (originalPublicUrl === undefined) delete mutableEnv.PUBLIC_URL;
    else mutableEnv.PUBLIC_URL = originalPublicUrl;
  });

  it('adds the embedded wrapper modifier only when embedded mode is enabled', () => {
    const { container, rerender } = render(<RiskMatrix />);

    expect(container.firstChild).toHaveClass('container');
    expect(container.firstChild).not.toHaveClass('embedded');

    rerender(<RiskMatrix embedded={true} />);

    expect(container.firstChild).toHaveClass('container');
    expect(container.firstChild).toHaveClass('embedded');
  });

  it('keeps risk matrix headers readable in the dense grid', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'RiskMatrix.module.scss'), 'utf8');
    render(<RiskMatrix />);

    const infraHeader = screen.getByTestId('ce-risk-matrix-header-x-infra');

    expect(scss).toMatch(/\.headerCell\s*{[\s\S]*?min-height:\s*72px;[\s\S]*?font-size:\s*0\.88rem;/);
    expect(infraHeader.parentElement).toHaveStyle({
      gridTemplateColumns: '122px repeat(10, minmax(104px, 1fr))',
      gridTemplateRows: 'auto repeat(10, minmax(78px, auto))',
    });
  });

  it('renders populated seeded cells and opens aggregated top-level notes', () => {
    render(<RiskMatrix />);

    expect(screen.queryByRole('heading', { name: 'Risk Matrix' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('ce-risk-matrix-legend-opportunity')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ce-risk-matrix-legend-risk')).not.toBeInTheDocument();
    expect(screen.getByTestId('ce-risk-matrix-cell-capabilities-vs-labor')).toHaveTextContent('+2');

    fireEvent.click(screen.getByTestId('ce-risk-matrix-cell-capabilities-vs-labor'));

    expect(screen.getByTestId('ce-risk-matrix-modal')).toBeInTheDocument();
    expect(screen.getByText('Interaction: Capabilities vs Labor')).toBeInTheDocument();
    expect(
      screen.getByText(
        'AI-driven productivity gains could reshape knowledge work within 2 years. Early adopters may compress reporting, research, and drafting cycles.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('ce-risk-matrix-aggregate-note')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ce-risk-matrix-comment-input')).not.toBeInTheDocument();
  });

  it('renders generated read-only comments without falling back to seeded notes', () => {
    render(
      <RiskMatrix
        categories={[
          { name: 'Session Evidence', subcategories: ['Generated'] },
          { name: 'Rehearsal Readiness', subcategories: ['Generated'] },
        ]}
        commentEyebrow="Generated note"
        initialComments={[
          {
            cell: 'Session Evidence.Generated.Rehearsal Readiness.Generated',
            comment: 'Participants noted that late setup changes could reduce rehearsal quality.',
            intensity: 8,
            valence: 'risk',
          },
        ]}
        readOnly={true}
      />,
    );

    fireEvent.click(screen.getByTestId('ce-risk-matrix-cell-session-evidence-vs-rehearsal-readiness'));

    expect(
      screen.getByText('Participants noted that late setup changes could reduce rehearsal quality.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/AI-driven productivity gains/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('ce-risk-matrix-comment-input')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ce-risk-matrix-save-comment')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Close'));
    fireEvent.click(screen.getByTestId('ce-risk-matrix-subcell-session-evidence-generated-vs-rehearsal-readiness-generated'));

    expect(screen.getByText('Generated note')).toBeInTheDocument();
  });

  it('opens generated likelihood and impact assessment details without seeded scenarios or measured counts', () => {
    render(
      <RiskMatrix
        generatedSeverityAssessments={[
          {
            id: 'risk_1',
            category: 'Rehearsal Readiness',
            likelihood: 'medium',
            impact: 'high',
            sourceRefs: ['question:setup-readiness'],
            summary: 'Late setup changes may reduce rehearsal quality.',
          },
        ]}
        readOnly={true}
      />,
    );

    expect(screen.getByTestId('ce-risk-matrix-generated-severity')).toBeInTheDocument();
    expect(screen.getByTestId('ce-risk-matrix-severity-cell-likelihood-medium-impact-high')).toHaveTextContent(
      'Rehearsal Readiness',
    );
    expect(screen.getByText(/not measured response counts/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Rehearsal Readiness/i }));

    expect(screen.getByText('Late setup changes may reduce rehearsal quality.')).toBeInTheDocument();
    expect(screen.getByText('question:setup-readiness')).toBeInTheDocument();
    expect(screen.queryByText(/0 votes|0 responses|0 participants/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/AI-driven productivity gains/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('ce-risk-matrix-comment-input')).not.toBeInTheDocument();
  });

  it('renders generated risk assessments on dynamic AI-selected axes', () => {
    render(
      <RiskMatrix
        generatedSeverityAxes={{
          x: {
            id: 'readiness_uncertainty',
            label: 'Readiness uncertainty',
            levels: [
              { id: 'settled', label: 'Settled' },
              { id: 'uncertain', label: 'Uncertain' },
            ],
          },
          y: {
            id: 'coordination_load',
            label: 'Coordination load',
            levels: [
              { id: 'light', label: 'Light' },
              { id: 'heavy', label: 'Heavy' },
            ],
          },
        }}
        generatedSeverityAssessments={[
          {
            id: 'risk_1',
            category: 'Setup Risk',
            xLevelId: 'uncertain',
            yLevelId: 'heavy',
            sourceRefs: ['q2'],
            summary: 'Late setup changes may reduce quality.',
          },
        ]}
        readOnly={true}
      />,
    );

    expect(screen.getByText('Coordination load / Readiness uncertainty')).toBeInTheDocument();
    expect(screen.getByTestId('ce-risk-matrix-axis-cell-x-uncertain-y-heavy')).toHaveTextContent('Setup Risk');
    expect(screen.getByText(/generated axes/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Setup Risk/i }));

    expect(screen.getByText('Late setup changes may reduce quality.')).toBeInTheDocument();
    expect(screen.getByText('q2')).toBeInTheDocument();
    expect(screen.queryByText(/0 votes|0 responses|0 participants/i)).not.toBeInTheDocument();
  });

  it('does not fall back to seeded categories when explicit categories are empty', () => {
    render(<RiskMatrix categories={[]} initialComments={[]} />);

    expect(screen.queryByTestId('ce-risk-matrix-header-x-safety')).not.toBeInTheDocument();
    expect(screen.queryByText(/AI-driven productivity gains/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('ce-risk-matrix')).toBeInTheDocument();
  });

  it('renders the crypto category and opens seeded crypto aggregate notes', () => {
    render(<RiskMatrix />);

    expect(screen.getByTestId('ce-risk-matrix-header-x-crypto')).toBeInTheDocument();
    expect(screen.getByTestId('ce-risk-matrix-header-y-crypto')).toBeInTheDocument();
    expect(screen.getByTestId('ce-risk-matrix-cell-crypto-vs-governance')).toHaveTextContent('+2');

    fireEvent.click(screen.getByTestId('ce-risk-matrix-cell-crypto-vs-governance'));

    expect(screen.getByText('Interaction: Crypto vs Governance')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Elinor Ostrom: Durable rules reduce friction when cooperation does not rely on a single referee. Trustless agreements reduce need for enforcement bureaucracy.',
      ),
    ).toBeInTheDocument();
  });

  it('keeps aggregate cells visually focused on the single score value', () => {
    render(<RiskMatrix />);

    expect(screen.getByTestId('ce-risk-matrix-cell-capabilities-vs-crypto')).not.toHaveTextContent(/atlas|notes/i);
    expect(screen.getByTestId('ce-risk-matrix-cell-security-vs-discourse')).not.toHaveTextContent(/atlas|notes/i);
  });

  it('shows linked scenario cards with local historical avatar imagery without an extra section heading', () => {
    render(<RiskMatrix />);

    fireEvent.click(screen.getByTestId('ce-risk-matrix-cell-safety-vs-capabilities'));

    expect(screen.queryByText('Atlas-linked scenarios')).not.toBeInTheDocument();
    expect(screen.getByText('Audit-aware agents learn the shape of oversight')).toBeInTheDocument();
    expect(screen.getAllByText('Deceptive Alignment').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Medium confidence, 1-3 years')).toBeInTheDocument();
    expect(screen.getByText('Medium confidence')).toBeInTheDocument();
    expect(screen.getByText('1-3 years')).toBeInTheDocument();
    expect(screen.getByAltText(/alan turing portrait anchoring the audit-aware agents overlap/i)).toHaveAttribute(
      'src',
      '/historical-avatars/alanturing.jpg',
    );
    expect(screen.getAllByText('Alan Turing').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Ada Lovelace').length).toBeGreaterThan(0);
  });

  it('renders specific AI discourse corpus citations instead of generic corpus bucket labels', () => {
    render(<RiskMatrix />);

    fireEvent.click(screen.getByTestId('ce-risk-matrix-cell-safety-vs-capabilities'));

    expect(screen.getAllByText(/Sources?:/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/@PalisadeAI — .*o3 model sabotaged a shutdown mechanism/i).length).toBeGreaterThan(0);
    const palisadeLinks = screen.getAllByRole('link', {
      name: /@PalisadeAI — .*o3 model sabotaged a shutdown mechanism/i,
    });
    expect(palisadeLinks.length).toBeGreaterThan(0);
    palisadeLinks.forEach((palisadeLink) => {
      expect(palisadeLink).toHaveAttribute('href', 'https://x.com/PalisadeAI/status/1926084635903025621');
      expect(palisadeLink).toHaveAttribute('target', '_blank');
      expect(palisadeLink).toHaveAttribute('rel', 'noopener noreferrer');
    });
    expect(screen.queryByText(/AI Discourse Tweets/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Cross-Corpus Debates/i)).not.toBeInTheDocument();
  });

  it('prepends PUBLIC_URL to atlas scenario imagery for subpath deploys', () => {
    mutableEnv.PUBLIC_URL = '/ce/';
    render(<RiskMatrix />);

    fireEvent.click(screen.getByTestId('ce-risk-matrix-cell-safety-vs-capabilities'));

    expect(screen.getByAltText(/alan turing portrait anchoring the audit-aware agents overlap/i)).toHaveAttribute(
      'src',
      '/ce/historical-avatars/alanturing.jpg',
    );
    expect(
      screen
        .getAllByAltText('Alan Turing')
        .some((image) => image.getAttribute('src') === '/ce/historical-avatars/alanturing.jpg'),
    ).toBe(true);
  });

  it('shows multiple linked crypto scenarios for capabilities x crypto overlaps', () => {
    render(<RiskMatrix />);

    fireEvent.click(screen.getByTestId('ce-risk-matrix-cell-capabilities-vs-crypto'));

    expect(screen.getByText('Interaction: Capabilities vs Crypto')).toBeInTheDocument();
    expect(screen.getByText('Agent key custody becomes the governance layer')).toBeInTheDocument();
    expect(screen.getByText('Reasoning agents can accelerate post-quantum migration')).toBeInTheDocument();
    expect(screen.getAllByTestId('ce-risk-matrix-atlas-scenario-card')).toHaveLength(2);
    expect(
      screen.getByTestId('ce-risk-matrix-atlas-link-capabilities-reasoning-crypto-post-quantum'),
    ).toHaveTextContent('Reasoning & Planning');
    expect(
      screen.getByTestId('ce-risk-matrix-atlas-link-capabilities-reasoning-crypto-post-quantum'),
    ).not.toHaveTextContent(/open .* in atlas/i);
  });

  it('uses the provided atlas opener callback when launched from an embedded session flow', () => {
    const onOpenAtlasNode = jest.fn();
    render(<RiskMatrix onOpenAtlasNode={onOpenAtlasNode} />);

    fireEvent.click(screen.getByTestId('ce-risk-matrix-cell-capabilities-vs-labor'));
    fireEvent.click(screen.getByTestId('ce-risk-matrix-atlas-link-labor-automation-capabilities-scaling'));

    expect(onOpenAtlasNode).toHaveBeenCalledTimes(1);
    expect(onOpenAtlasNode.mock.calls[0]?.[0]).toBe(
      '0x4110000000000000000000000000000000000000000000000000000000000000',
    );
    const restoreState = onOpenAtlasNode.mock.calls[0]?.[1] as RiskMatrixRestoreState;
    expect(restoreState).toMatchObject({
      modal: true,
      selectedCellId: 'Capabilities_vs_Labor',
      activeCategoryX: 'Capabilities',
      activeCategoryY: 'Labor',
    });
  });

  it('preserves the current route in standalone atlas scenario links', () => {
    const priorUrl = window.location.href;

    try {
      window.history.replaceState({}, '', '/matrix?panel=capabilities#scenario');
      render(<RiskMatrix />);

      fireEvent.click(screen.getByTestId('ce-risk-matrix-cell-capabilities-vs-labor'));

      expect(screen.getByTestId('ce-risk-matrix-atlas-link-labor-automation-capabilities-scaling')).toHaveAttribute(
        'href',
        '/atlas/0x4110000000000000000000000000000000000000000000000000000000000000?demo=1&returnTo=%2Fmatrix%3Fpanel%3Dcapabilities%23scenario',
      );
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('shows linked crypto scenarios from the mirrored aggregate cell as well', () => {
    render(<RiskMatrix />);

    fireEvent.click(screen.getByTestId('ce-risk-matrix-cell-crypto-vs-capabilities'));

    expect(screen.getByText('Interaction: Crypto vs Capabilities')).toBeInTheDocument();
    expect(screen.getByText('Agent key custody becomes the governance layer')).toBeInTheDocument();
    expect(screen.getByText('Reasoning agents can accelerate post-quantum migration')).toBeInTheDocument();
    expect(screen.getAllByTestId('ce-risk-matrix-atlas-scenario-card')).toHaveLength(2);
  });

  it('groups aggregate notes into opportunity and risk sections', () => {
    render(<RiskMatrix />);

    fireEvent.click(screen.getByTestId('ce-risk-matrix-cell-capabilities-vs-labor'));

    expect(screen.getByRole('button', { name: /Opportunities/i })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /Risks/i })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('ce-risk-matrix-comment-list-opportunity')).toBeInTheDocument();
    expect(screen.getByTestId('ce-risk-matrix-comment-list-risk')).toBeInTheDocument();
  });

  it('collapses individual aggregate note groups', () => {
    render(<RiskMatrix />);

    fireEvent.click(screen.getByTestId('ce-risk-matrix-cell-capabilities-vs-labor'));

    const opportunitiesToggle = screen.getByRole('button', { name: /Opportunities/i });
    expect(opportunitiesToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('ce-risk-matrix-comment-list-opportunity')).toBeInTheDocument();

    fireEvent.click(opportunitiesToggle);

    expect(opportunitiesToggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('ce-risk-matrix-comment-list-opportunity')).not.toBeInTheDocument();
    expect(screen.getByTestId('ce-risk-matrix-comment-list-risk')).toBeInTheDocument();
  });

  it('hides vague reference buckets when no specific corpus entry is resolved', () => {
    render(<RiskMatrix />);

    fireEvent.click(screen.getByTestId('ce-risk-matrix-cell-capabilities-vs-labor'));

    expect(screen.getAllByText('Franklin D. Roosevelt').length).toBeGreaterThan(0);
    expect(screen.queryByText('Historical figure')).not.toBeInTheDocument();
    expect(screen.queryByText('Corpus references')).not.toBeInTheDocument();
    expect(screen.queryByText(/References:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sources:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/AI Discourse Tweets/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Cross-Corpus Debates/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/William Bryk on knowledge-work compression/i)).not.toBeInTheDocument();
  });

  it('keeps every seeded atlas scenario linked to a real atlas node id', () => {
    const atlasNodeIds = collectAtlasNodeIds(debateMapDemoData as any[]);
    const uniqueScenarioNodeIds = Array.from(
      new Set(
        riskMatrixAtlasScenarioSamples.map((scenario) => String(scenario.atlasNodeId || '').trim()).filter(Boolean),
      ),
    );

    expect(uniqueScenarioNodeIds.length).toBeGreaterThan(0);
    uniqueScenarioNodeIds.forEach((nodeId) => {
      expect(atlasNodeIds.has(nodeId)).toBe(true);
    });
  });

  it('restores an open modal snapshot on mount and notifies the parent once consumed', () => {
    const onRestoreApplied = jest.fn();

    render(
      <RiskMatrix
        restoreState={{
          modal: true,
          selectedCellId: 'Capabilities.Reasoning.Labor.Productivity',
          activeCategoryX: 'Capabilities',
          activeCategoryY: 'Labor',
          activeSubcategoryX: 'Reasoning',
          activeSubcategoryY: 'Productivity',
          comment: 'Carry draft context back from atlas.',
          valence: 'risk',
          intensity: 7,
        }}
        onRestoreApplied={onRestoreApplied}
      />,
    );

    expect(screen.getByTestId('ce-risk-matrix-modal')).toBeInTheDocument();
    expect(screen.getByText('Capabilities / Reasoning vs Labor / Productivity')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Carry draft context back from atlas.')).toBeInTheDocument();
    expect(onRestoreApplied).toHaveBeenCalledTimes(1);
  });

  it('reveals the subgrid and rebalances a subcell after saving a new comment', () => {
    render(<RiskMatrix />);

    fireEvent.click(screen.getByTestId('ce-risk-matrix-header-x-capabilities'));
    fireEvent.click(screen.getByTestId('ce-risk-matrix-header-y-labor'));

    expect(screen.getByTestId('ce-risk-matrix-subgrid')).toBeInTheDocument();

    const subcellTestId = 'ce-risk-matrix-subcell-capabilities-reasoning-vs-labor-productivity';
    expect(screen.getByTestId(subcellTestId)).toHaveTextContent('+2');

    fireEvent.click(screen.getByTestId(subcellTestId));
    fireEvent.change(screen.getByTestId('ce-risk-matrix-comment-input'), {
      target: {
        value: 'Deskilling pressure can surface before firms or governments fund credible retraining pathways.',
      },
    });
    fireEvent.click(screen.getByLabelText('Risk'));
    fireEvent.change(screen.getByTestId('ce-risk-matrix-intensity-input'), {
      target: { value: '3' },
    });
    fireEvent.click(screen.getByTestId('ce-risk-matrix-save-comment'));

    expect(
      screen.getByText(
        'Deskilling pressure can surface before firms or governments fund credible retraining pathways.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId(subcellTestId)).toHaveTextContent('-1');
  });
});
