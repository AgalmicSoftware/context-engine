import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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
    expect(onEdit).toHaveBeenLastCalledWith({ importance: 70 });
    fireEvent.click(screen.getByRole('button', { name: /Conviction/ }));
    expect(screen.getByRole('slider')).toHaveValue('4');
    fireEvent.change(screen.getByRole('slider'), { target: { value: '8' } });
    expect(onEdit).toHaveBeenLastCalledWith({ conviction: 80 });
    fireEvent.click(screen.getByRole('button', { name: /Importance/ }));
    expect(screen.getByRole('slider')).toHaveValue('7');
  });
});
