import React from 'react';
import fs from 'fs';
import path from 'path';
import { fireEvent, render, screen } from '@testing-library/react';
import SessionInterviewResearchConsent from './SessionInterviewResearchConsent';
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

  it('keeps metadata expansion bounded and the help control transparent', () => {
    const scss = readConsentScss();

    expect(scss).toMatch(
      /\.optionGroup\s*\{[\s\S]*?padding:\s*8px;[\s\S]*?border:\s*1px solid color-mix\(in srgb, var\(--ce-text-inverse\) 14%, transparent\);[\s\S]*?background:\s*color-mix\(in srgb, var\(--ce-text-inverse\) 5%, transparent\);/,
    );
    expect(scss).toMatch(
      /\.metadata\[open\]\s*\{[\s\S]*?max-height:\s*min\(28vh, 300px\);[\s\S]*?overflow:\s*auto;/,
    );
    expect(scss).toMatch(
      /\.metadata\[open\] summary\s*\{[\s\S]*?position:\s*sticky;[\s\S]*?background:\s*color-mix\(in srgb, var\(--ce-surface-sunken, #171941\) 92%, transparent\);/,
    );
    expect(scss).toMatch(
      /\.researchHelp\s*\{[\s\S]*?border:\s*0;[\s\S]*?background:\s*transparent;[\s\S]*?cursor:\s*help;/,
    );
  });
});
