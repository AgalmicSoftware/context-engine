import { E2E_TESTIDS } from '../../utilities/e2eTestIds';
import React from 'react';
import fs from 'fs';
import path from 'path';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  it('says in one line what is kept when it offers no choice and nothing is shared', () => {
    const { container, rerender } = renderConsent({ showProvenance: false });
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_NOTHING_SHARED)).toHaveTextContent(
      'Drafted by the session’s AI (gpt-example). Only the answers you submit are saved; Share for research also keeps the AI’s predictions and what you changed.',
    );
    expect(container.querySelectorAll('input, details')).toHaveLength(0);
    // Without a model ID it names no model.
    rerender(
      <SessionInterviewResearchConsent
        packet={{ ...packet, source: { ...packet.source, modelId: '' } }}
        showProvenance={false}
        includeProvenance
        includeComparison={false}
        onProvenanceChange={jest.fn()}
        coverageDetails={[]}
        selectedCount={1}
        unselectedCount={0}
        disabled={false}
      />,
    );
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_NOTHING_SHARED)).toHaveTextContent(
      /^Drafted by the session’s AI\. Only/,
    );
    // Nor for the person's own typed context, which isn't a model.
    rerender(
      <SessionInterviewResearchConsent
        packet={{ ...packet, source: { ...packet.source, modelId: 'direct-user-context' } }}
        showProvenance={false}
        includeProvenance
        includeComparison={false}
        onProvenanceChange={jest.fn()}
        coverageDetails={[]}
        selectedCount={1}
        unselectedCount={0}
        disabled={false}
      />,
    );
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_NOTHING_SHARED)).toHaveTextContent(
      /^Drafted by the session’s AI\. Only/,
    );
  });

  it('leaves the line out when it has something to show', () => {
    renderConsent({ showProvenance: false, includeComparison: true });
    renderConsent({ includeProvenance: false });
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_NOTHING_SHARED)).not.toBeInTheDocument();
  });

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
    // Shown at once: nothing to open first.
    const metadata = screen.getByRole('group', { name: 'AI prefill metadata' });
    expect(metadata.tagName).toBe('DIV');
    expect(metadata.querySelector('details, summary')).toBeNull();
    expect(metadata).toHaveTextContent('gpt-example');
    expect(screen.getByText(/1 selected draft and 2 unselected drafts/i)).toBeInTheDocument();
    expect(screen.getByText(/Reviewed final values and which fields changed/i)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'How research data is handled' });
    expect(link).toHaveAttribute(
      'href',
      'https://github.com/AgalmicSoftware/context-engine/blob/main/docs/research-data.md',
    );
  });

  it('uses compact option copy and shows the model details at once', () => {
    renderConsent();
    expect(screen.getByLabelText(/Include platform\/model provenance/i)).toBeChecked();
    expect(screen.queryByText(/with submitted responses/i)).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'AI prefill metadata' })).toHaveTextContent('gpt-example');
  });

  it('scrolls metadata with the other choices and keeps the help control transparent', () => {
    const scss = readConsentScss();

    expect(scss).toMatch(
      /\.optionGroup\s*\{[\s\S]*?padding:\s*8px;[\s\S]*?border:\s*1px solid color-mix\(in srgb, var\(--ce-text-inverse\) 14%, transparent\);[\s\S]*?background:\s*color-mix\(in srgb, var\(--ce-text-inverse\) 5%, transparent\);/,
    );
    // The submission panel scrolls as one region, so the metadata has no scroll of its own.
    expect(scss).not.toMatch(/\.metadata\s*\{[^}]*max-height/);
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
  it('links to a doc that exists, led by its diagram, with the section the link names', () => {
    // The links open these on GitHub; a renamed file or heading would break them silently.
    const docs = path.join(__dirname, '../../../../docs');
    const doc = fs.readFileSync(path.join(docs, 'research-data.md'), 'utf8');
    expect(doc).toMatch(/^## What is kept$/m);
    const diagram = doc.match(/!\[[^\]]*\]\(([^)]+\.svg)\)/)?.[1];
    expect(diagram && fs.existsSync(path.join(docs, diagram))).toBe(true);
  });

  it('says what it is with one “What’s this?”, whose tooltip links to the research data doc in a new tab', async () => {
    render(
      <SessionInterviewResearchShare included disabled={false} onChange={jest.fn()} dataNote="Funded by Example." />,
    );
    const what = screen.getByRole('button', { name: 'What’s this? About sharing for research' });
    expect(what).toHaveTextContent(/^What’s this\?$/);
    // No separate ? or “What’s kept” saying the same thing again.
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByText('What’s kept')).not.toBeInTheDocument();
    // A tap shows the tooltip with the session's note and the doc's link, whether the browser reports it as
    // focus or, as iOS Safari does, as a hover.
    fireEvent.mouseOver(what);
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('Funded by Example.');
    const link = within(tooltip).getByRole('link', { name: 'How research data is handled' });
    expect(link).toHaveAttribute(
      'href',
      'https://github.com/AgalmicSoftware/context-engine/blob/main/docs/research-data.md',
    );
    expect(link).toHaveAttribute('target', '_blank');
    fireEvent.mouseOut(what);
    fireEvent.focus(what);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Funded by Example.');
  });

  it('names the grant, links to it, and stays open long enough to reach a link', async () => {
    jest.useFakeTimers();
    try {
      render(<SessionInterviewResearchShare included disabled={false} onChange={jest.fn()} />);
      const what = screen.getByRole('button', { name: 'What’s this? About sharing for research' });
      fireEvent.mouseEnter(what);
      const tooltip = await screen.findByRole('tooltip');
      expect(tooltip).toHaveTextContent(
        'Response drafts and changes used for research, funded by grant from the Cosmos Institute and FIRE, about how AI represents people’s preferences. It keeps the AI’s drafted answers and compares them to your final answers. Only the session’s admins see it.',
      );
      expect(within(tooltip).getByRole('link', { name: 'About the grant' })).toHaveAttribute(
        'href',
        'https://www.fire.org/news/fire-and-cosmos-institute-launch-1-million-grant-program-ai-advances-truth-seeking',
      );
      // The pointer leaves for the tooltip: it is still there well after reactstrap's usual 50 ms, and staying
      // over it keeps it.
      fireEvent.mouseLeave(what);
      act(() => jest.advanceTimersByTime(1500));
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      fireEvent.mouseEnter(screen.getByTestId('ce-interview-research-what-tip'));
      act(() => jest.advanceTimersByTime(5000));
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      // Leaving both, it goes after 2 s.
      fireEvent.mouseLeave(screen.getByTestId('ce-interview-research-what-tip'));
      act(() => jest.advanceTimersByTime(2100));
      await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
    } finally {
      jest.useRealTimers();
    }
  });

  it('lets the keyboard reach its links, and Escape close it', async () => {
    // Stands in for the Interview dialog, which closes on Escape and wraps Tab.
    const dialogKeyDown = jest.fn();
    const dialogKeyUp = jest.fn();
    render(
      <div onKeyDown={dialogKeyDown} onKeyUp={dialogKeyUp}>
        <SessionInterviewResearchShare included disabled={false} onChange={jest.fn()} />
        <button type="button" hidden>
          Hidden
        </button>
        <button type="button">After</button>
      </div>,
    );
    const what = screen.getByRole('button', { name: 'What’s this? About sharing for research' });
    act(() => what.focus());
    const tooltip = await screen.findByRole('tooltip');
    fireEvent.keyDown(what, { key: 'Tab' });
    const [doc, grant] = within(tooltip).getAllByRole('link');
    expect(doc).toHaveFocus();
    // Moving between its links keeps it open.
    act(() => grant.focus());
    fireEvent.keyDown(grant, { key: 'Tab' });
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
    act(() => what.focus());
    await screen.findByRole('tooltip');
    fireEvent.keyDown(what, { key: 'Escape' });
    fireEvent.keyUp(what, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
    // None of the keys it handled reached the dialog.
    expect(dialogKeyDown).not.toHaveBeenCalled();
    expect(dialogKeyUp).not.toHaveBeenCalled();
    // With the tooltip closed, Escape is the dialog's again.
    fireEvent.keyDown(what, { key: 'Escape' });
    fireEvent.keyUp(what, { key: 'Escape' });
    expect(dialogKeyUp).toHaveBeenCalledTimes(1);
  });

  it('returns Tab to its button when nothing follows it', async () => {
    render(<SessionInterviewResearchShare included disabled={false} onChange={jest.fn()} />);
    const what = screen.getByRole('button', { name: 'What’s this? About sharing for research' });
    act(() => what.focus());
    const tooltip = await screen.findByRole('tooltip');
    const links = within(tooltip).getAllByRole('link');
    act(() => links[links.length - 1].focus());
    fireEvent.keyDown(links[links.length - 1], { key: 'Tab' });
    expect(what).toHaveFocus();
  });

  it('names itself shortly, with what it shares behind “What’s this?”', () => {
    render(<SessionInterviewResearchShare included disabled={false} onChange={jest.fn()} />);
    expect(screen.getByLabelText('Share for research')).toBeChecked();
    expect(screen.getByRole('button', { name: 'What’s this? About sharing for research' })).toHaveAccessibleDescription(
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

  it('says beside Share for research what the research is, and that it is for admins alone', () => {
    render(<SessionInterviewResearchShare included disabled={false} onChange={jest.fn()} />);
    expect(screen.getByText(/Includes the AI’s predicted answers/)).toHaveTextContent(
      /^Response drafts and changes used for research, funded by grant from the Cosmos Institute and FIRE, .* Only the session’s admins see it\. Includes/,
    );
  });

  it('says so beside Share for research when the session keeps the text', () => {
    const { rerender } = render(<SessionInterviewResearchShare included disabled={false} onChange={jest.fn()} />);
    expect(screen.getByText(/Includes the AI’s predicted answers/)).not.toHaveTextContent(/admins can read/);
    rerender(<SessionInterviewResearchShare included disabled={false} draftTextOffered onChange={jest.fn()} />);
    expect(screen.getByText(/Includes the AI’s predicted answers/)).toHaveTextContent(
      /lets the session’s admins, and nobody else, read the AI’s drafted text; you can turn that off on its own/,
    );
  });
});
