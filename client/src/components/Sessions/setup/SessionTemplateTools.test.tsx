import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import {
  SESSION_TEMPLATE_FORMAT,
  diffSessionTemplates,
  validateSessionTemplate,
  type SessionTemplate,
} from '@ce-shared/sessionTemplate.mjs';
import { decodeSessionTemplateLink, encodeSessionTemplateLink } from '@ce-shared/sessionTemplateLink.mjs';
import { prose } from '../sessionWizardTemplate.testUtils';
import { SessionTemplateActions, SessionTemplateLinkNotice, SetupQuestionsPublisher } from './SessionTemplateTools';

const mockPublishQuestions = jest.fn();
jest.mock('../../../domains/surveys/workerCanonicalAuthoringPort', () => ({
  workerCanonicalAuthoringPort: { publishQuestions: (...args: unknown[]) => mockPublishQuestions(...args) },
}));

const template = (fields: Record<string, unknown> = {}): SessionTemplate => {
  const result = validateSessionTemplate({ format: SESSION_TEMPLATE_FORMAT, ...fields });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.template;
};

const renderActions = (props: Partial<React.ComponentProps<typeof SessionTemplateActions>> = {}) => {
  const onImport = jest.fn();
  const mine = template({ draftId: 'draft-1', sessionName: 'Mine' });
  render(
    <SessionTemplateActions
      buildTemplate={() => ({ ok: true, template: mine })}
      onImport={onImport}
      fromLink={false}
      fileName="salon"
      linkBase="https://contextengine.sh/new"
      {...props}
    />,
  );
  return { onImport, mine };
};

describe('session template tools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('copies a share link that decodes to the draft, and names it for the recipient', async () => {
    const writeText = jest.fn(async () => undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const { mine } = renderActions({ fromLink: true });
    const share = screen.getByTestId('ce-template-share');
    expect(share).toHaveTextContent('Copy link with my changes');
    await act(async () => {
      fireEvent.click(share);
    });
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const link = String((writeText.mock.calls[0] as unknown[])[0]);
    expect(link.startsWith('https://contextengine.sh/new#template=')).toBe(true);
    const decoded = await decodeSessionTemplateLink(new URL(link).hash);
    expect(decoded).toEqual({ ok: true, template: mine });
    expect(screen.getByTestId('ce-template-status')).toHaveTextContent('It carries no keys or tokens.');
  });

  it('offers a .json download when the link would pass 8,000 characters', async () => {
    const long = template({ sessionInfo: prose(9, 30000) });
    const encoded = await encodeSessionTemplateLink(long);
    expect(encoded).toMatchObject({ ok: false, reason: 'too_long' });
    const createObjectURL = jest.fn(() => 'blob:template');
    const revokeObjectURL = jest.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderActions({ buildTemplate: () => ({ ok: true, template: long }) });
    await act(async () => {
      fireEvent.click(screen.getByTestId('ce-template-share'));
    });
    expect(await screen.findByTestId('ce-template-status')).toHaveTextContent('too long for a link');
    fireEvent.click(screen.getByTestId('ce-template-share-download'));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = (createObjectURL.mock.calls[0] as unknown[])[0] as Blob;
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(blob);
    });
    expect(JSON.parse(text)).toEqual(long);
    expect(click).toHaveBeenCalled();
    click.mockRestore();
  });

  it('refuses to share or export a draft holding a secret', async () => {
    renderActions({
      buildTemplate: () =>
        validateSessionTemplate({ format: SESSION_TEMPLATE_FORMAT, sessionInfo: `sk-${'a'.repeat(30)}` }),
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('ce-template-share'));
    });
    expect(screen.getByTestId('ce-template-errors')).toHaveTextContent('looks like a key, token or password');
  });

  it('imports pasted JSON only after showing what it changes', async () => {
    const { onImport } = renderActions();
    fireEvent.click(screen.getByTestId('ce-template-import'));
    const paste = screen.getByTestId('ce-template-paste');
    fireEvent.change(paste, { target: { value: '{"format":"ce.session-template/v1","sessionNmae":"Typo"}' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(screen.getByTestId('ce-template-errors')).toHaveTextContent('Unknown field: sessionNmae.');
    fireEvent.change(paste, { target: { value: '{"__proto__":{"x":1}}' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(screen.getByTestId('ce-template-errors')).toHaveTextContent('not an allowed field name');

    fireEvent.change(paste, {
      target: { value: JSON.stringify({ format: SESSION_TEMPLATE_FORMAT, sessionName: '<script>alert(1)</script>' }) },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    const changes = screen.getByTestId('ce-template-changes');
    expect(changes).toHaveTextContent('sessionName: Mine → <script>alert(1)</script>');
    expect(document.querySelector('script')).toBeNull();
    expect(onImport).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('ce-template-import-apply'));
    expect(onImport).toHaveBeenCalledWith(expect.objectContaining({ sessionName: '<script>alert(1)</script>' }));
  });

  it('imports an uploaded template file after the same check', async () => {
    const { onImport } = renderActions();
    fireEvent.click(screen.getByTestId('ce-template-import'));
    const file = new File([JSON.stringify({ format: SESSION_TEMPLATE_FORMAT, defaultTags: 'parks' })], 'salon.json', {
      type: 'application/json',
    });
    fireEvent.change(screen.getByTestId('ce-template-file'), { target: { files: [file] } });
    expect(await screen.findByTestId('ce-template-changes')).toHaveTextContent('defaultTags: (empty) → parks');
    fireEvent.click(screen.getByTestId('ce-template-import-apply'));
    expect(onImport).toHaveBeenCalledWith(expect.objectContaining({ defaultTags: 'parks' }));
  });

  it('refuses a template file over 256 KB without reading it', () => {
    const readAsText = jest.spyOn(FileReader.prototype, 'readAsText');
    renderActions();
    fireEvent.click(screen.getByTestId('ce-template-import'));
    const file = new File(['x'.repeat(256 * 1024 + 1)], 'huge.json', { type: 'application/json' });
    fireEvent.change(screen.getByTestId('ce-template-file'), { target: { files: [file] } });
    expect(readAsText).not.toHaveBeenCalled();
    expect(screen.getByTestId('ce-template-errors')).toHaveTextContent('larger than 256 KB');
    readAsText.mockRestore();
  });

  it('shows a link draft and its differences before anything is used', () => {
    const mine = template({ draftId: 'draft-1', sessionName: 'Mine' });
    const theirs = template({ draftId: 'draft-1', sessionName: 'Theirs', defaultTags: 'parks' });
    const onAccept = jest.fn();
    const onDismiss = jest.fn();
    render(
      <SessionTemplateLinkNotice
        result={{ ok: true, template: theirs }}
        changes={diffSessionTemplates(mine, theirs)}
        sameDraft
        onAccept={onAccept}
        onDismiss={onDismiss}
      />,
    );
    expect(screen.getByText('This draft came from a link')).toBeInTheDocument();
    expect(screen.getByTestId('ce-template-changes')).toHaveTextContent('sessionName: Mine → Theirs');
    expect(screen.getByTestId('ce-template-changes')).toHaveTextContent('defaultTags: (empty) → parks');
    fireEvent.click(screen.getByTestId('ce-template-link-accept'));
    expect(onAccept).toHaveBeenCalledWith(theirs);
  });

  it('explains a damaged link instead of using it', () => {
    const onDismiss = jest.fn();
    render(
      <SessionTemplateLinkNotice
        result={{
          ok: false,
          errors: [{ path: '', message: 'This link is damaged: its template cannot be unpacked.' }],
        }}
        changes={[]}
        sameDraft={false}
        onAccept={jest.fn()}
        onDismiss={onDismiss}
      />,
    );
    expect(screen.getByTestId('ce-template-errors')).toHaveTextContent('cannot be unpacked');
    expect(screen.queryByTestId('ce-template-link-accept')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('ce-template-link-dismiss'));
    expect(onDismiss).toHaveBeenCalled();
  });

  it('does not add a question that is no longer valid', async () => {
    const questions = [
      { prompt: 'Parks need shade.', type: 'binary' },
      { prompt: ' ', type: 'binary' },
      { prompt: 'Which park?', type: 'multichoice', options: ['North'] },
    ];
    render(
      <SetupQuestionsPublisher
        questions={questions}
        sessionSlug="salon"
        account="0xaa"
        onPublished={jest.fn()}
        sessionConfig={{ slug: 'salon', sessionName: 'Salon' }}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId('ce-setup-questions-publish'));
    });
    const errors = screen.getByTestId('ce-template-errors');
    expect(errors).toHaveTextContent('questions.1.prompt is required.');
    expect(errors).toHaveTextContent('questions.2.options needs at least two options.');
    expect(mockPublishQuestions).not.toHaveBeenCalled();
  });

  it('adds a template’s questions once the session exists', async () => {
    mockPublishQuestions.mockResolvedValue({ uploadedQuestions: [{}, {}] });
    const onPublished = jest.fn();
    const questions = [
      { prompt: 'Parks need shade.', type: 'binary' },
      { prompt: 'How safe?', type: 'rating', scale: { min: 0, max: 10, minLabel: 'Not', maxLabel: 'Very' } },
    ];
    const props = { questions, sessionSlug: 'salon', account: '0xaa', onPublished };
    const { rerender } = render(<SetupQuestionsPublisher {...props} sessionConfig={null} />);
    expect(screen.getByText('These questions are added to the session once it is created.')).toBeInTheDocument();

    const sessionConfig = { slug: 'salon', sessionName: 'Salon' };
    rerender(<SetupQuestionsPublisher {...props} sessionConfig={sessionConfig} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('ce-setup-questions-publish'));
    });
    expect(await screen.findByTestId('ce-setup-questions-status')).toHaveTextContent('Added 2 questions.');
    expect(onPublished).toHaveBeenCalled();
    const [input] = mockPublishQuestions.mock.calls[0] as [Record<string, unknown>];
    expect(input).toMatchObject({ account: '0xaa', sessionConfig, sessionSlug: 'salon' });
    expect(input.questions).toEqual([
      expect.objectContaining({ type: 'binary', prompt: 'Parks need shade.', sessionSlug: 'salon' }),
      expect.objectContaining({ type: 'rating', scale: { min: 0, max: 10, minLabel: 'Not', maxLabel: 'Very' } }),
    ]);
  });
});
