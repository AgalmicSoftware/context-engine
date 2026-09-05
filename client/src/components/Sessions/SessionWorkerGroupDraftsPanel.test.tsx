import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import SessionWorkerGroupDraftsPanel from './SessionWorkerGroupDraftsPanel';
import { createPendingWorkerGroupDraft } from './sessionWizardPendingWorkerGroups';

describe('SessionWorkerGroupDraftsPanel', () => {
  it('queues a named group and exposes editable access defaults', () => {
    const onAdd = jest.fn();
    render(<SessionWorkerGroupDraftsPanel drafts={[]} onAdd={onAdd} onRemove={jest.fn()} onUpdate={jest.fn()} />);

    fireEvent.change(screen.getByTestId('ce-new-worker-group-name'), { target: { value: 'Research team' } });
    fireEvent.click(screen.getByTestId('ce-new-worker-group-add'));

    expect(onAdd).toHaveBeenCalledWith('Research team');
    expect(screen.getByTestId('ce-new-worker-group-name')).toHaveValue('');
    expect(screen.getByText(/created after this session/i)).toBeInTheDocument();
  });

  it('offers the normal Worker Group metadata and image controls for queued drafts', () => {
    const draft = createPendingWorkerGroupDraft('Research team', { groupId: 'research-team' });
    const onUpdate = jest.fn();
    render(
      <SessionWorkerGroupDraftsPanel drafts={[draft]} onAdd={jest.fn()} onRemove={jest.fn()} onUpdate={onUpdate} />,
    );

    expect(screen.getByLabelText('Image URL')).toBeInTheDocument();
    expect(screen.getByTestId('ce-new-worker-group-draft-image-upload')).toBeInTheDocument();
    expect(screen.getByLabelText('Reference URL')).toBeInTheDocument();
    expect(screen.getByLabelText('Tag')).toBeInTheDocument();
    expect(screen.getByLabelText('Member limit')).toBeInTheDocument();
    expect(screen.getByLabelText('Join deadline')).toBeInTheDocument();
    expect(screen.getByLabelText('Group admin address')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Tag'), { target: { value: 'research' } });
    fireEvent.click(screen.getByLabelText('Add tag'));
    expect(onUpdate).toHaveBeenCalledWith('research-team', { tags: ['research'] });

    fireEvent.change(screen.getByLabelText('Reference URL'), {
      target: { value: 'https://docs.example.test/brief' },
    });
    fireEvent.click(screen.getByLabelText('Add reference URL'));
    expect(onUpdate).toHaveBeenCalledWith('research-team', {
      documentURLs: ['https://docs.example.test/brief'],
    });
  });
});
