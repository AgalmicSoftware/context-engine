import { E2E_TESTIDS } from '../../utilities/e2eTestIds';
import React from 'react';
import fs from 'fs';
import path from 'path';
import { fireEvent, render, screen } from '@testing-library/react';
import SessionInterviewResearchConsent, { SessionInterviewResearchShare } from './SessionInterviewResearchConsent';
import type { InterviewPrefillPacket } from './sessionInterview';

const readConsentScss = () =>
  fs.readFileSync(path.join(__dirname, 'SessionInterviewResearchConsent.module.scss'), 'utf8');

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
      coverageDetails={[]}
      selectedCount={1}
      unselectedCount={2}
      disabled={false}
      {...props}
    />,
  );

describe('SessionInterviewResearchConsent', () => {
  it('describes opt-in research metadata without claiming edits are agreement', () => {
    renderConsent({ researchDetail: 'full' });
    render(
      <SessionInterviewResearchShare included={false} disabled={false} researchDetail="full" onChange={jest.fn()} />,
    );
    expect(screen.getByText(/Edits are not treated as agreement/i)).toBeInTheDocument();
    expect(screen.getByText(/full interview transcript and imported conversation history/i)).toBeInTheDocument();
    // An unticked box says what is left out, so the metadata doesn't repeat it.
    expect(screen.queryByText(/will not be included/i)).not.toBeInTheDocument();
  });

  it('leaves the metadata out when nothing is shared', () => {
    renderConsent({ includeProvenance: false });
    expect(screen.queryByRole('group', { name: 'AI prefill metadata' })).not.toBeInTheDocument();
  });

  it('links to the branch documentation and shows selected/unselected counts when opted in', () => {
    renderConsent({ includeComparison: true, revisionCount: 3, researchDetail: 'full' });
    fireEvent.click(screen.getByRole('group', { name: 'AI prefill metadata' }).querySelector('summary')!);
    expect(screen.getByRole('group', { name: 'AI prefill metadata' }).querySelector('summary')).toHaveTextContent(
      'AI prefill metadata',
    );
    expect(screen.getByRole('group', { name: 'AI prefill metadata' }).querySelector('summary')).not.toHaveTextContent(
      'gpt-example',
    );
    expect(screen.getByText(/1 selected draft and 2 unselected drafts/i)).toBeInTheDocument();
    expect(screen.getByText(/Reviewed final values and which fields changed/i)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'How research data is handled' });
    expect(link).toHaveAttribute(
      'href',
      'https://github.com/AgalmicSoftware/context-engine/blob/main/docs/session-interview-research.md',
    );
  });

  it('uses compact option copy and keeps model details inside the expandable metadata', () => {
    renderConsent();
    expect(screen.getByLabelText(/Include platform\/model provenance/i)).toBeChecked();
    expect(screen.queryByText(/with submitted responses/i)).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'AI prefill metadata' }).querySelector('summary')).not.toHaveTextContent(
      'gpt-example',
    );
  });

  it('scrolls metadata with the other choices and keeps the help control transparent', () => {
    const scss = readConsentScss();

    expect(scss).toMatch(
      /\.optionGroup\s*\{[\s\S]*?padding:\s*8px;[\s\S]*?border:\s*1px solid color-mix\(in srgb, var\(--ce-text-inverse\) 14%, transparent\);[\s\S]*?background:\s*color-mix\(in srgb, var\(--ce-text-inverse\) 5%, transparent\);/,
    );
    // The submission panel scrolls as one region, so the metadata has no scroll of its own.
    expect(scss).not.toMatch(/\.metadata\[open\]\s*\{[^}]*max-height/);
    expect(scss).toMatch(
      /\.metadata\[open\] summary\s*\{[\s\S]*?position:\s*sticky;[\s\S]*?background:\s*color-mix\(in srgb, var\(--ce-surface-sunken\) 92%, transparent\);/,
    );
    expect(scss).toMatch(
      /\.researchHelp\s*\{[\s\S]*?border:\s*0;[\s\S]*?background:\s*transparent;[\s\S]*?cursor:\s*help;/,
    );
  });
});

it('shows mixed saved consent and lets an explicit click choose for all selected questions', () => {
  const change = jest.fn();
  const share = jest.fn();
  renderConsent({ provenanceMixed: true, onProvenanceChange: change });
  render(<SessionInterviewResearchShare included mixed disabled={false} onChange={share} />);
  const provenance = screen.getByLabelText(/Include platform\/model provenance/i);
  const comparison = screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_INCLUDE_PREDICTION_COMPARISON);
  expect(provenance).toHaveAttribute('aria-checked', 'mixed');
  expect(comparison).toHaveAttribute('aria-checked', 'mixed');
  expect(comparison).not.toBeChecked();
  fireEvent.click(provenance);
  expect(change).toHaveBeenCalledWith(true);
  fireEvent.click(comparison);
  expect(share).toHaveBeenCalledWith(true);
});

describe('SessionInterviewResearchShare', () => {
  it('names itself shortly, with what it shares behind its ?', () => {
    render(<SessionInterviewResearchShare included disabled={false} onChange={jest.fn()} />);
    expect(screen.getByLabelText('Share for research')).toBeChecked();
    expect(screen.getByRole('button', { name: 'About sharing for research' })).toHaveAccessibleDescription(
      /predicted answers, ratings and confidence/,
    );
  });

  it('reports a change and stays put while disabled', () => {
    const change = jest.fn();
    const { rerender } = render(<SessionInterviewResearchShare included disabled={false} onChange={change} />);
    fireEvent.click(screen.getByLabelText('Share for research'));
    expect(change).toHaveBeenCalledWith(false);
    rerender(<SessionInterviewResearchShare included disabled onChange={change} />);
    expect(screen.getByLabelText('Share for research')).toBeDisabled();
  });
});

it('explains that current drafts use current attribution while preserving consent', () => {
  renderConsent({ preserveSavedProvenance: true });
  fireEvent.click(screen.getByText('AI prefill metadata', { selector: 'summary' }));
  expect(screen.getByText(/Selected AI drafts use this interview’s source metadata/i)).toBeInTheDocument();
});

describe('research detail wording', () => {
  const base = {
    packet,
    includeProvenance: true,
    includeComparison: true,
    onProvenanceChange: () => undefined,
    coverageDetails: [],
    selectedCount: 2,
    unselectedCount: 1,
    disabled: false,
  };

  it('describes the minimal record by default', () => {
    render(<SessionInterviewResearchConsent {...base} />);
    expect(screen.getByText(/drafts for questions you skipped are not included/)).toBeInTheDocument();
    expect(screen.queryByText(/Unselected drafts, including original and edited values/)).not.toBeInTheDocument();
  });

  it('describes the full record when the session keeps full detail', () => {
    render(<SessionInterviewResearchConsent {...base} researchDetail="full" />);
    expect(screen.getByText(/Unselected drafts, including original and edited values/)).toBeInTheDocument();
  });
});

describe('AI draft text for admins', () => {
  const draftTextBox = () => screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_INCLUDE_DRAFT_TEXT);

  it('offers its own choice inside the details only where the session keeps the text', () => {
    const onDraftTextChange = jest.fn();
    const { rerender } = renderConsent({
      includeComparison: true,
      draftText: { checked: true, mixed: false },
      onDraftTextChange,
    });
    expect(draftTextBox()).toBeChecked();
    expect(
      screen.getByText(/The session’s admins can read the text of the AI’s drafts.*nobody else can/),
    ).toBeInTheDocument();
    expect(screen.getByText(/turn this off on its own/)).toBeInTheDocument();
    expect(screen.queryByText(/Drafted text is not kept/)).not.toBeInTheDocument();
    fireEvent.click(draftTextBox()!);
    expect(onDraftTextChange).toHaveBeenCalledWith(false);
    rerender(
      <SessionInterviewResearchConsent
        packet={packet}
        includeProvenance
        includeComparison
        onProvenanceChange={jest.fn()}
        coverageDetails={[]}
        selectedCount={1}
        unselectedCount={2}
        disabled={false}
      />,
    );
    expect(draftTextBox()).not.toBeInTheDocument();
    expect(screen.getByText(/Drafted text is not kept/)).toBeInTheDocument();
  });

  it('says so beside Share for research when the session keeps the text', () => {
    const { rerender } = render(<SessionInterviewResearchShare included disabled={false} onChange={jest.fn()} />);
    expect(screen.getByText(/Includes the AI’s predicted answers/)).not.toHaveTextContent(/admins can read/);
    rerender(<SessionInterviewResearchShare included disabled={false} draftTextOffered onChange={jest.fn()} />);
    expect(screen.getByText(/Includes the AI’s predicted answers/)).toHaveTextContent(
      /the session’s admins can read the AI’s drafted text, and nobody else can/,
    );
  });
});
