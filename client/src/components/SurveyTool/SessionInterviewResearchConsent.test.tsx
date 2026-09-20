import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import SessionInterviewResearchConsent from './SessionInterviewResearchConsent';
import type { InterviewPrefillPacket } from './sessionInterview';

const packet: InterviewPrefillPacket = {
  version: 1,
  sessionSlug: 'demo',
  promptVersion: 'ce-interview-brief-v4',
  questionSetHash: 'abc123',
  source: {
    platform: 'chatgpt',
    modelId: 'gpt-example',
    verification: 'self_reported',
  },
  responderContext: {},
};

const renderConsent = (props = {}) =>
  render(
    <SessionInterviewResearchConsent
      packet={packet}
      includeProvenance
      includeComparison={false}
      onProvenanceChange={jest.fn()}
      onComparisonChange={jest.fn()}
      coverageDetails={[]}
      selectedCount={1}
      unselectedCount={2}
      disabled={false}
      {...props}
    />,
  );

describe('SessionInterviewResearchConsent', () => {
  it('describes opt-in research metadata without claiming edits are agreement', () => {
    renderConsent();
    expect(screen.getByText(/Edits are not treated as agreement/i)).toBeInTheDocument();
    expect(screen.getByText(/full interview transcript and imported conversation history/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Predictions, reviewed values, changed fields, and unselected drafts will not be included/i),
    ).toBeInTheDocument();
  });

  it('links to the branch documentation and shows selected/unselected counts when opted in', () => {
    renderConsent({ includeComparison: true, revisionCount: 3 });
    fireEvent.click(screen.getByRole('group', { name: 'AI prefill metadata' }).querySelector('summary')!);
    expect(screen.getByText(/1 selected draft and 2 unselected drafts/i)).toBeInTheDocument();
    expect(screen.getByText(/Reviewed final values and which fields changed/i)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'How research data is handled' });
    expect(link).toHaveAttribute(
      'href',
      'https://github.com/AgalmicSoftware/context-engine/blob/main/client/src/components/SurveyTool/surveyToolResponsePayloadController.ts',
    );
  });
});
