import React from 'react';
import { render, screen } from '@testing-library/react';

import SessionGeneratedResultsViews from './SessionGeneratedResultsViews';
import { SESSION_GENERATED_RESULTS_VIEW_KEYS } from '../../domains/sessionResults/sessionResultsGeneratedViewTypes';
import {
  SESSION_RESULTS_ANALYSIS_ARTIFACT_KIND,
  SESSION_RESULTS_ANALYSIS_ARTIFACT_VERSION,
  type SessionResultsGeneratedAnalysisArtifact,
} from '../../utilities/sessionResultsExport/sessionResultsAnalysisArtifacts';

jest.mock('../../components/DemoViews/DemoAnalysis/DemoAnalysisWorkspace', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: ({
      analysisData,
      emptyReason,
    }: {
      analysisData?: { flatResponses?: unknown[] } | null;
      emptyReason?: string;
    }) =>
      React.createElement(
        'div',
        { 'data-testid': 'demo-analysis-workspace' },
        emptyReason
          ? React.createElement('div', { 'data-testid': 'generated-breakdown-unavailable' }, emptyReason)
          : React.createElement(
              'div',
              { 'data-testid': 'mock-generated-breakdown-counts' },
              `${analysisData?.flatResponses?.length || 0} submitted distribution rows`,
            ),
      ),
  };
});

const validArtifact: SessionResultsGeneratedAnalysisArtifact = {
  generatedAt: '2026-09-17T12:00:00.000Z',
  inputSignature: 'session-results-analysis-v1-wrapper-test',
  kind: SESSION_RESULTS_ANALYSIS_ARTIFACT_KIND,
  model: 'mock-model',
  participants: [],
  sections: {
    argumentMap: { available: false, debates: [], reason: 'not requested' },
    atlas: { available: false, edges: [], nodes: [], reason: 'not requested' },
    breakdown: { available: false, dimensions: [], groups: [], summary: {}, reason: 'not requested' },
    riskMatrix: {
      available: true,
      categories: [
        {
          id: 'risk_rehearsal',
          label: 'Rehearsal Readiness',
          description: 'Late setup changes may reduce rehearsal quality.',
        },
      ],
      comments: [
        {
          categoryId: 'risk_rehearsal',
          summary: 'Participants noted rehearsal risk from late setup changes.',
        },
      ],
      heatmap: {
        risk_rehearsal: { likelihood: 'medium', impact: 'high' },
      },
      scenarioLinks: [],
    },
  },
  source: 'ai-generated',
  version: SESSION_RESULTS_ANALYSIS_ARTIFACT_VERSION,
};

const submittedQuestions = [
  {
    id: 'q-setup-readiness',
    options: ['Ready', 'Blocked'],
    prompt: 'How ready is the setup for rehearsal?',
    tags: ['Readiness'],
    type: 'single-choice',
  },
];

const submittedResponses = [
  {
    answer: 'Ready',
    participantId: 'participant_001',
    questionId: 'q-setup-readiness',
    segments: { submittedMetadata: 'All' },
  },
  {
    answer: 'Blocked',
    participantId: 'participant_002',
    questionId: 'q-setup-readiness',
    segments: { submittedMetadata: 'All' },
  },
];

const breakdownArtifact: SessionResultsGeneratedAnalysisArtifact = {
  ...validArtifact,
  inputSignature: 'session-results-analysis-v1-breakdown-test',
  sections: {
    ...validArtifact.sections,
    breakdown: {
      available: true,
      dimensions: [
        {
          id: 'dimension_timing',
          label: 'Timing risk',
          summary: 'Timing concerns were concentrated around final setup changes.',
          sourceRefs: ['q-setup-readiness'],
        },
      ],
      groups: [
        {
          id: 'group_logistics',
          label: 'Logistics blockers',
          summary: 'Logistics comments focused on setup sequencing.',
          sourceRefs: ['q-setup-readiness'],
        },
      ],
      summary: {
        overview: 'Generated overview says readiness is split between confidence and setup blockers.',
        themes: [
          {
            id: 'theme_rehearsal',
            label: 'Rehearsal readiness',
            summary: 'The generated theme flags rehearsal confidence as fragile.',
            sourceRefs: ['q-setup-readiness'],
          },
        ],
      },
    },
  },
};

describe('SessionGeneratedResultsViews', () => {
  it('renders a valid generated Risk Matrix artifact through the presentation wrapper', async () => {
    render(
      <SessionGeneratedResultsViews
        artifact={validArtifact}
        selectedView={SESSION_GENERATED_RESULTS_VIEW_KEYS.RISK_MATRIX}
        sessionSlug="generated-session"
      />,
    );

    expect(screen.getByText('AI-generated session view')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Risk Matrix' })).toBeInTheDocument();
    expect(await screen.findByTestId('ce-risk-matrix-generated-severity')).toBeInTheDocument();
    expect(screen.getByTestId('ce-risk-matrix-severity-cell-likelihood-medium-impact-high')).toHaveTextContent(
      'Rehearsal Readiness',
    );
    expect(screen.queryByText(/AI-driven productivity gains/i)).not.toBeInTheDocument();
  });

  it('renders generated Breakdown interpretation beside measured submitted distributions', async () => {
    render(
      <SessionGeneratedResultsViews
        artifact={breakdownArtifact}
        questions={submittedQuestions}
        responses={submittedResponses}
        selectedView={SESSION_GENERATED_RESULTS_VIEW_KEYS.BREAKDOWN}
        sessionSlug="generated-session"
      />,
    );

    expect(await screen.findByTestId('ce-session-generated-breakdown-interpretation')).toHaveTextContent(
      'Generated overview says readiness is split between confidence and setup blockers.',
    );
    expect(screen.getByText('Rehearsal readiness')).toBeInTheDocument();
    expect(screen.getByText('Logistics blockers')).toBeInTheDocument();
    expect(screen.getAllByText('q-setup-readiness').length).toBeGreaterThan(0);
    expect(await screen.findByTestId('demo-analysis-workspace')).toBeInTheDocument();
    expect(screen.queryByText(/AI-driven productivity gains/i)).not.toBeInTheDocument();
  });

  it('shows a generated Breakdown unavailable reason while keeping measured counts renderable', async () => {
    const artifactWithUnavailableBreakdown: SessionResultsGeneratedAnalysisArtifact = {
      ...breakdownArtifact,
      sections: {
        ...breakdownArtifact.sections,
        breakdown: {
          available: false,
          dimensions: [],
          groups: [],
          reason: 'Breakdown generation timed out.',
          summary: {},
        },
      },
    };

    render(
      <SessionGeneratedResultsViews
        artifact={artifactWithUnavailableBreakdown}
        questions={submittedQuestions}
        responses={submittedResponses}
        selectedView={SESSION_GENERATED_RESULTS_VIEW_KEYS.BREAKDOWN}
        sessionSlug="generated-session"
      />,
    );

    expect(await screen.findByTestId('ce-session-generated-breakdown-interpretation')).toHaveTextContent(
      'Breakdown generation timed out.',
    );
    expect(await screen.findByTestId('demo-analysis-workspace')).toBeInTheDocument();
    expect(screen.queryByTestId('generated-breakdown-unavailable')).not.toBeInTheDocument();
  });
});
