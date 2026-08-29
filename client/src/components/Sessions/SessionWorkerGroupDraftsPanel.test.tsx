import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import SessionWorkerGroupDraftsPanel from './SessionWorkerGroupDraftsPanel';

describe('SessionWorkerGroupDraftsPanel', () => {
  it('queues a named group and exposes editable access defaults', () => {
    const onAdd = jest.fn();
    render(
      <SessionWorkerGroupDraftsPanel
        drafts={[]}
        onAdd={onAdd}
        onRemove={jest.fn()}
        onUpdate={jest.fn()}
      />,
    );

    fireEvent.change(screen.getByTestId('ce-new-worker-group-name'), { target: { value: 'Research team' } });
    fireEvent.click(screen.getByTestId('ce-new-worker-group-add'));

    expect(onAdd).toHaveBeenCalledWith('Research team');
    expect(screen.getByTestId('ce-new-worker-group-name')).toHaveValue('');
    expect(screen.getByText(/created after this session/i)).toBeInTheDocument();
  });
});
