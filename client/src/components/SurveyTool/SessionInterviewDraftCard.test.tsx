import React, { useState } from 'react';
import fs from 'fs';
import path from 'path';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SessionInterviewDraftCard from './SessionInterviewDraftCard';
import QuadraticAllocationInput from './QuadraticAllocationInput';
import type { InterviewDraftResponse } from './sessionInterview';

const readDraftCardScss = () => fs.readFileSync(path.join(__dirname, 'SessionInterviewDraftCard.module.scss'), 'utf8');

describe('SessionInterviewDraftCard sliders', () => {
  it('exposes both modes and preserves their independent values when editing', () => {
    const draft = { questionId: 'q1', answer: 'Agree', conviction: 40, importance: 60 };
    const onEdit = jest.fn();
    function Review() {
      const [edited, setEdited] = useState<InterviewDraftResponse>(draft);
      return (
        <SessionInterviewDraftCard
          draft={draft}
          edited={edited}
          selected
          existing={false}
          disabled={false}
          onSelect={jest.fn()}
          onEdit={(patch) => {
            onEdit(patch);
            setEdited((current) => ({ ...current, ...patch }));
          }}
        />
      );
    }
    render(<Review />);
    fireEvent.click(screen.getByRole('button', { name: 'Conviction / importance' }));
    expect(screen.getByRole('button', { name: /Conviction/ })).toHaveTextContent('4');
    fireEvent.click(screen.getByRole('button', { name: /Importance/ }));
    expect(screen.getByRole('slider')).toHaveValue('6');
    fireEvent.change(screen.getByRole('slider'), { target: { value: '7' } });
    expect(onEdit).toHaveBeenLastCalledWith({ importance: 70, userEditedFields: ['importance'] });
    expect(screen.queryByLabelText('AI-proposed response')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Conviction/ }));
    expect(screen.getByRole('slider')).toHaveValue('4');
    fireEvent.change(screen.getByRole('slider'), { target: { value: '8' } });
    expect(onEdit).toHaveBeenLastCalledWith({ conviction: 80, userEditedFields: ['importance', 'conviction'] });
    fireEvent.click(screen.getByRole('button', { name: /Importance/ }));
    expect(screen.getByRole('slider')).toHaveValue('7');
  });
});

describe('SessionInterviewDraftCard readable draft editors', () => {
  it.each([true, false])('preserves numeric quadratic drafts through review controls (injected: %s)', (injected) => {
    const draft = { questionId: 'q-budget', answer: [3, -4], confidence: 0.6 };
    const question = {
      id: 'q-budget',
      type: 'quadratic',
      prompt: 'Allocate support',
      options: ['Parks', 'Transit'],
      voiceCredits: 25,
    };
    const onEdit = jest.fn();
    const renderAnswerInput = jest.fn((questionId, value, onChange) => (
      <QuadraticAllocationInput
        questionId={questionId}
        options={question.options}
        voiceCredits={question.voiceCredits}
        value={value}
        onChange={onChange}
      />
    ));
    function Review() {
      const [edited, setEdited] = useState<InterviewDraftResponse>(draft);
      return (
        <SessionInterviewDraftCard
          draft={draft}
          edited={edited}
          question={question}
          selected
          existing={false}
          disabled={false}
          onSelect={jest.fn()}
          renderAnswerInput={injected ? renderAnswerInput : undefined}
          onEdit={(patch) => {
            onEdit(patch);
            setEdited((current) => ({ ...current, ...patch }));
          }}
        />
      );
    }
    render(<Review />);
    expect(screen.getByRole('slider', { name: 'Parks' })).toHaveValue('3');
    expect(screen.getByRole('slider', { name: 'Transit' })).toHaveValue('-4');
    expect(screen.queryByRole('button', { name: /Draft answer for/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('slider', { name: 'Transit' }), { target: { value: '-2' } });
    expect(onEdit).toHaveBeenLastCalledWith({ answer: [3, -2], userEditedFields: ['answer'] });
    expect(screen.queryByLabelText('AI-proposed response')).not.toBeInTheDocument();
    if (injected) {
      expect(renderAnswerInput.mock.calls.at(-1)).toEqual([
        'q-budget',
        [3, -2],
        expect.any(Function),
        question,
        [3, -4],
      ]);
    }
  });

  it('undoes quadratic edits to the AI allocation and clears only that edited marker', () => {
    const draft = { questionId: 'q-budget', answer: [3, -4], additionalComments: 'AI note', confidence: 0.6 };
    const question = {
      id: 'q-budget',
      type: 'quadratic',
      prompt: 'Allocate support',
      options: ['Parks', 'Transit'],
      voiceCredits: 25,
    };
    const onEdit = jest.fn();
    function Review() {
      const [edited, setEdited] = useState<InterviewDraftResponse>(draft);
      return (
        <SessionInterviewDraftCard
          draft={draft}
          edited={edited}
          question={question}
          selected
          existing={false}
          disabled={false}
          onSelect={jest.fn()}
          onEdit={(patch) => {
            onEdit(patch);
            setEdited((current) => ({ ...current, ...patch }));
          }}
        />
      );
    }
    render(<Review />);
    const reset = screen.getByRole('button', { name: 'Reset' });
    expect(reset).toHaveAttribute('title', 'Undo answer changes');
    expect(reset).toBeDisabled();

    fireEvent.change(screen.getByRole('slider', { name: 'Transit' }), { target: { value: '-2' } });
    fireEvent.click(screen.getByRole('button', { name: /Additional comments for Allocate support/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /Additional comments for Allocate support/i }), {
      target: { value: 'Human note' },
    });
    expect(onEdit).toHaveBeenLastCalledWith({
      additionalComments: 'Human note',
      userEditedFields: ['answer', 'additionalComments'],
    });

    fireEvent.click(reset);
    expect(onEdit).toHaveBeenLastCalledWith({ answer: [3, -4], userEditedFields: ['additionalComments'] });
    expect(screen.getByRole('slider', { name: 'Transit' })).toHaveValue('-4');
    expect(screen.getByRole('textbox', { name: /Additional comments for Allocate support/i })).toHaveValue(
      'Human note',
    );
    expect(reset).toBeDisabled();
    expect(screen.queryByLabelText('AI-proposed response')).not.toBeInTheDocument();
    const writtenAnswers = onEdit.mock.calls.flatMap(([patch]) => ('answer' in patch ? [patch.answer] : []));
    expect(writtenAnswers).toEqual([
      [3, -2],
      [3, -4],
    ]);
  });

  it('restores an all-zero AI allocation and returns the card to its unedited state', () => {
    const draft = { questionId: 'q-budget', answer: [0, 0], confidence: 0.6 };
    const question = {
      id: 'q-budget',
      type: 'quadratic',
      prompt: 'Allocate support',
      options: ['Parks', 'Transit'],
      voiceCredits: 25,
    };
    const onEdit = jest.fn();
    function Review() {
      const [edited, setEdited] = useState<InterviewDraftResponse>(draft);
      return (
        <SessionInterviewDraftCard
          draft={draft}
          edited={edited}
          question={question}
          selected
          existing={false}
          disabled={false}
          onSelect={jest.fn()}
          onEdit={(patch) => {
            onEdit(patch);
            setEdited((current) => ({ ...current, ...patch }));
          }}
        />
      );
    }
    render(<Review />);
    fireEvent.change(screen.getByRole('slider', { name: 'Parks' }), { target: { value: '2' } });
    expect(screen.queryByLabelText('AI-proposed response')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(onEdit).toHaveBeenLastCalledWith({ answer: [0, 0], userEditedFields: [] });
    expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled();
    expect(screen.getByLabelText('AI-proposed response')).toBeInTheDocument();
  });

  it('shows full prose by default and enters edit mode by keyboard without Agent/User labels', () => {
    const draft = {
      questionId: 'q1',
      answer: 'A complete draft answer that should be readable without opening an inner editor.',
      additionalComments: 'Source-backed note.',
    };
    const onEdit = jest.fn();
    render(
      <SessionInterviewDraftCard
        draft={draft}
        edited={draft}
        selected
        existing={false}
        disabled={false}
        onSelect={jest.fn()}
        onEdit={onEdit}
      />,
    );

    const readableAnswer = screen.getByRole('button', { name: /Draft answer for q1/i });
    expect(readableAnswer).toHaveTextContent('A complete draft answer that should be readable');
    expect(screen.queryByText(/^Agent:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^User:/)).not.toBeInTheDocument();
    fireEvent.keyDown(readableAnswer, { key: 'Enter' });
    expect(screen.getByRole('textbox', { name: /Draft answer for q1/i })).toHaveValue(
      'A complete draft answer that should be readable without opening an inner editor.',
    );
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('marks an untouched AI proposal until the human changes any draft field', () => {
    const draft = { questionId: 'q1', answer: 'Draft', additionalComments: 'Agent: Proposed note' };
    function Review() {
      const [edited, setEdited] = useState<InterviewDraftResponse>(draft);
      return (
        <SessionInterviewDraftCard
          draft={draft}
          edited={edited}
          selected
          existing={false}
          disabled={false}
          onSelect={jest.fn()}
          onEdit={(patch) => setEdited((current) => ({ ...current, ...patch }))}
        />
      );
    }
    render(<Review />);

    expect(screen.getByLabelText('AI-proposed response')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Additional comments for q1/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /Additional comments for q1/i }), {
      target: { value: 'Human revised note' },
    });
    expect(screen.queryByLabelText('AI-proposed response')).not.toBeInTheDocument();
  });

  it('keeps the proposal marker through focus-only editing and restores it after a full revert', () => {
    const draft = { questionId: 'q1', answer: 'Draft', additionalComments: '' };
    function Review() {
      const [edited, setEdited] = useState<InterviewDraftResponse>(draft);
      return (
        <SessionInterviewDraftCard
          draft={draft}
          edited={edited}
          selected
          existing={false}
          disabled={false}
          onSelect={jest.fn()}
          onEdit={(patch) => setEdited((current) => ({ ...current, ...patch }))}
        />
      );
    }
    render(<Review />);

    fireEvent.click(screen.getByRole('button', { name: /Draft answer for q1/i }));
    fireEvent.blur(screen.getByRole('textbox', { name: /Draft answer for q1/i }));
    expect(screen.getByLabelText('AI-proposed response')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Draft answer for q1/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /Draft answer for q1/i }), { target: { value: 'Changed' } });
    expect(screen.queryByLabelText('AI-proposed response')).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: /Draft answer for q1/i }), { target: { value: 'Draft' } });
    expect(screen.getByLabelText('AI-proposed response')).toBeInTheDocument();
  });

  it('keeps a cleared saved comment marked as a human edit', () => {
    // The review shows the saved comment when the AI proposed none.
    const draft = { questionId: 'q1', answer: 'Draft' };
    const onEdit = jest.fn();
    function Review() {
      const [edited, setEdited] = useState<InterviewDraftResponse>({ ...draft, additionalComments: 'Saved note' });
      return (
        <SessionInterviewDraftCard
          draft={draft}
          edited={edited}
          selected
          existing
          savedComment="Saved note"
          disabled={false}
          onSelect={jest.fn()}
          onEdit={(patch) => {
            onEdit(patch);
            setEdited((current) => ({ ...current, ...patch }));
          }}
        />
      );
    }
    render(<Review />);

    fireEvent.click(screen.getByRole('button', { name: /Additional comments for q1/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /Additional comments for q1/i }), {
      target: { value: '' },
    });
    expect(onEdit).toHaveBeenLastCalledWith({ additionalComments: '', userEditedFields: ['additionalComments'] });
    expect(screen.queryByLabelText('AI-proposed response')).not.toBeInTheDocument();
  });

  it('wraps injected prose editors with focus, bounded autosize and a Done editing return path', async () => {
    const renderAnswerInput = jest.fn((_questionId, value, onChange) => (
      <textarea
        aria-label="Injected answer"
        value={String(value)}
        onChange={(event) => onChange(event.target.value)}
        ref={(node) => {
          if (!node) return;
          Object.defineProperty(node, 'scrollHeight', { configurable: true, value: 120 });
        }}
        style={{ boxSizing: 'border-box', borderTopWidth: '3px', borderBottomWidth: '4px', maxHeight: '96px' }}
      />
    ));
    render(
      <SessionInterviewDraftCard
        draft={{ questionId: 'q1', answer: 'Long draft' }}
        edited={{ questionId: 'q1', answer: 'Long draft' }}
        question={{ id: 'q1', type: 'freeform', prompt: 'Explain this', options: [] }}
        selected
        existing={false}
        disabled={false}
        onSelect={jest.fn()}
        onEdit={jest.fn()}
        renderAnswerInput={renderAnswerInput}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Draft answer for Explain this/i }));
    const injected = screen.getByLabelText('Injected answer') as HTMLTextAreaElement;
    expect(injected).toHaveFocus();
    await waitFor(() => expect(injected.style.height).toBe('96px'));
    expect(injected.style.overflow).toBe('hidden');
    expect(injected.style.overflowY).toBe('auto');
    fireEvent.click(screen.getByRole('button', { name: 'Done editing' }));
    expect(screen.getByRole('button', { name: /Draft answer for Explain this/i })).toBeInTheDocument();
  });

  it('uses native controls for structured answers but keeps prose in the readable editor', () => {
    const renderAnswerInput = jest.fn((_questionId, value, onChange) => (
      <button type="button" onClick={() => onChange('7')}>
        Native value {String(value)}
      </button>
    ));
    const onEdit = jest.fn();
    const { rerender } = render(
      <SessionInterviewDraftCard
        draft={{ questionId: 'q1', answer: 5 }}
        edited={{ questionId: 'q1', answer: 5 }}
        question={{ id: 'q1', type: 'rating', prompt: 'Rate this', options: [] }}
        selected
        existing={false}
        disabled={false}
        onSelect={jest.fn()}
        onEdit={onEdit}
        renderAnswerInput={renderAnswerInput}
      />,
    );
    expect(screen.getByRole('button', { name: /Native value 5/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Native value 5/ }));
    expect(onEdit).toHaveBeenLastCalledWith({ answer: '7', userEditedFields: ['answer'] });

    renderAnswerInput.mockClear();
    rerender(
      <SessionInterviewDraftCard
        draft={{ questionId: 'q2', answer: 'Freeform draft' }}
        edited={{ questionId: 'q2', answer: 'Freeform draft' }}
        question={{ id: 'q2', type: 'freeform', prompt: 'Explain this', options: [] }}
        selected
        existing={false}
        disabled={false}
        onSelect={jest.fn()}
        onEdit={onEdit}
        renderAnswerInput={renderAnswerInput}
      />,
    );
    expect(renderAnswerInput).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Draft answer for Explain this/i })).toHaveTextContent('Freeform draft');
  });
});

describe('SessionInterviewDraftCard styles', () => {
  it('keeps long freeform editors scrollable and the AI marker borderless', () => {
    const scss = readDraftCardScss();

    expect(scss).toMatch(/\.autosizeTextArea\s*\{[\s\S]*?max-height:\s*min\(34vh, 320px\);[\s\S]*?overflow:\s*hidden;/);
    expect(scss).toMatch(
      /\.injectedEditorShell textarea\s*\{[\s\S]*?max-height:\s*min\(34vh, 320px\);[\s\S]*?overflow:\s*hidden;[\s\S]*?overflow-y:\s*hidden;/,
    );
    expect(scss).not.toMatch(/\.injectedEditorShell textarea\s*\{[\s\S]*?overflow(?:-y)?:\s*[^;]+!important/);
    expect(scss).toMatch(
      /\.agentCommentMarker\s*\{[\s\S]*?border:\s*0;[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none;/,
    );
  });
});

describe('interview multiple-choice review', () => {
  it.each([false, true])('uses the question selection setting (singleSelect: %s)', (singleSelect) => {
    const question = {
      id: 'choice',
      type: 'multichoice',
      prompt: 'Pick topics',
      options: ['Parks', 'Transit'],
      singleSelect,
    };
    const draft = { questionId: 'choice', answer: ['Parks'], confidence: 0.8 };
    const onEdit = jest.fn();
    function Review() {
      const [edited, setEdited] = useState<InterviewDraftResponse>(draft);
      return (
        <SessionInterviewDraftCard
          draft={draft}
          edited={edited}
          question={question}
          selected
          existing={false}
          disabled={false}
          onSelect={jest.fn()}
          onEdit={(patch) => {
            onEdit(patch);
            setEdited((value) => ({ ...value, ...patch }));
          }}
        />
      );
    }
    render(<Review />);
    expect(screen.getByRole('checkbox', { name: 'Parks' })).toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Transit' }));
    expect(onEdit).toHaveBeenLastCalledWith({
      answer: singleSelect ? ['Transit'] : ['Parks', 'Transit'],
      userEditedFields: ['answer'],
    });
    expect(screen.getByRole('checkbox', { name: 'Transit' })).toBeChecked();
    if (singleSelect) expect(screen.getByRole('checkbox', { name: 'Parks' })).not.toBeChecked();
    else expect(screen.getByRole('checkbox', { name: 'Parks' })).toBeChecked();
  });
});
