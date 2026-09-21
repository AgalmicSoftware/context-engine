import React, { useState } from 'react';
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

  it('collapses queued groups without losing edited draft fields', () => {
    const Harness = () => {
      const [drafts, setDrafts] = useState([
        createPendingWorkerGroupDraft('Research team', {
          groupId: 'research-team',
          description: 'Initial notes',
        }),
      ]);
      return (
        <SessionWorkerGroupDraftsPanel
          drafts={drafts}
          onAdd={jest.fn()}
          onRemove={jest.fn()}
          onUpdate={(groupId, patch) =>
            setDrafts((current) => current.map((entry) => (entry.groupId === groupId ? { ...entry, ...patch } : entry)))
          }
        />
      );
    };

    render(<Harness />);

    const collapseButton = screen.getByRole('button', { name: 'Collapse Group 1: Research team' });
    const body = screen.getByTestId('ce-new-worker-group-draft-form').parentElement;
    expect(collapseButton).toHaveAttribute('aria-expanded', 'true');
    expect(body).not.toHaveAttribute('hidden');

    fireEvent.change(screen.getByTestId('ce-new-worker-group-draft-description'), {
      target: { value: 'Updated notes' },
    });
    expect(screen.getByTestId('ce-new-worker-group-draft-description')).toHaveValue('Updated notes');

    fireEvent.click(collapseButton);
    expect(screen.getByRole('button', { name: 'Expand Group 1: Research team' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(body).toHaveAttribute('hidden');
    expect(screen.getByRole('button', { name: 'Remove Research team' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Expand Group 1: Research team' }));
    expect(body).not.toHaveAttribute('hidden');
    expect(screen.getByTestId('ce-new-worker-group-draft-description')).toHaveValue('Updated notes');
  });

  it('keeps collapse state keyed by stable group id when drafts reorder', () => {
    const alpha = createPendingWorkerGroupDraft('Alpha team', { groupId: 'alpha' });
    const beta = createPendingWorkerGroupDraft('Beta team', { groupId: 'beta' });
    const onRemove = jest.fn();
    const { rerender } = render(
      <SessionWorkerGroupDraftsPanel
        drafts={[alpha, beta]}
        onAdd={jest.fn()}
        onRemove={onRemove}
        onUpdate={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Collapse Group 2: Beta team' }));
    rerender(
      <SessionWorkerGroupDraftsPanel
        drafts={[beta, alpha]}
        onAdd={jest.fn()}
        onRemove={onRemove}
        onUpdate={jest.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Expand Group 1: Beta team' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'Collapse Group 2: Alpha team' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remove Beta team' }));
    expect(onRemove).toHaveBeenCalledWith('beta');
  });
});
