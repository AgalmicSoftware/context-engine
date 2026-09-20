import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SessionInterviewDraftCard from './SessionInterviewDraftCard';
import type { InterviewDraftResponse } from './sessionInterview';

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

  it('keeps the proposal marker through focus-only editing and hides it after a restored edit', () => {
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
    fireEvent.change(screen.getByRole('textbox', { name: /Draft answer for q1/i }), { target: { value: 'Draft' } });
    expect(screen.queryByLabelText('AI-proposed response')).not.toBeInTheDocument();
  });

  it('wraps injected prose editors with focus, border-aware autosize and a Done editing return path', async () => {
    const renderAnswerInput = jest.fn((_questionId, value, onChange) => (
      <textarea
        aria-label="Injected answer"
        value={String(value)}
        onChange={(event) => onChange(event.target.value)}
        ref={(node) => {
          if (!node) return;
          Object.defineProperty(node, 'scrollHeight', { configurable: true, value: 120 });
        }}
        style={{ boxSizing: 'border-box', borderTopWidth: '3px', borderBottomWidth: '4px' }}
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
    await waitFor(() => expect(injected.style.height).toBe('127px'));
    expect(injected.style.overflow).toBe('hidden');
    expect(injected.style.overflowY).toBe('hidden');
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
