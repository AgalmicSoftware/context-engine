import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';

import SessionRiskMatrixView from './SessionRiskMatrixView';
import type { DebateAtlasBuild } from '../../domains/debateAtlas/debateAtlasTypes';
import type { RiskMatrixBuild } from '../../domains/riskMatrix/riskMatrixTypes';

const build: RiskMatrixBuild = {
  id: 'risk_k2_00000002',
  builtAt: '2026-11-08T14:05:00.000Z',
  title: 'Salon risks',
  counts: { responses: 500, participants: 40, aiResponses: 420 },
  areas: [
    { name: 'Trust', subareas: ['Identity', 'Media'] },
    { name: 'Labor', subareas: ['Jobs'] },
  ],
  notes: [
    {
      cell: 'Trust.Identity.Labor.Jobs',
      valence: 'risk',
      intensity: 6,
      comment: 'Weak identity checks invite hiring fraud.',
      participantCount: 2,
      questionIds: ['q1'],
    },
  ],
};
const older = { id: 'risk_k1_00000001', builtAt: '2026-11-08T13:00:00.000Z', counts: { responses: 300 } };

it('draws the build read-only as a matrix of its areas, stamped, with its notes', () => {
  render(<SessionRiskMatrixView build={build} builds={[build]} onSelectBuild={jest.fn()} />);
  const view = screen.getByTestId('ce-session-risk-matrix');
  expect(within(view).getByRole('combobox', { name: 'Version' })).toBeVisible();
  expect(within(view).getByText(/500 responses · 40 participants$/)).toBeVisible();
  expect(within(view).getByRole('button', { name: 'About this risk matrix' })).toBeVisible();
  expect(within(view).getByTestId('ce-risk-matrix-header-x-trust')).toBeVisible();
  expect(within(view).getByTestId('ce-risk-matrix-header-y-labor')).toBeVisible();

  const cell = within(view).getByTestId('ce-risk-matrix-cell-trust-vs-labor');
  expect(cell).toHaveTextContent('-6');
  fireEvent.click(cell);
  expect(screen.getByText('Weak identity checks invite hiring fraud.')).toBeInTheDocument();
  expect(screen.getByText('From 2 participants')).toBeInTheDocument();
  expect(screen.queryByTestId('ce-risk-matrix-comment-input')).not.toBeInTheDocument();
});

describe('with the session’s atlas', () => {
  const atlas: DebateAtlasBuild = {
    id: 'atlas_k3_00000003',
    builtAt: '2026-11-08T15:00:00.000Z',
    branches: [
      {
        id: 'b1',
        label: 'Work',
        topics: [
          { id: 't1', label: 'Pay', questions: [{ id: 'q7', prompt: 'Pay?' }] },
          { id: 't2', label: 'Hiring checks', questions: [{ id: 'q1', prompt: 'Checks?' }] },
        ],
      },
    ],
  };
  const openCell = () => fireEvent.click(screen.getByTestId('ce-risk-matrix-cell-trust-vs-labor'));

  it('opens the atlas topic holding a note’s questions', () => {
    const onOpenAtlasTopic = jest.fn();
    render(
      <SessionRiskMatrixView
        build={build}
        builds={[build]}
        onSelectBuild={jest.fn()}
        atlas={atlas}
        onOpenAtlasTopic={onOpenAtlasTopic}
      />,
    );
    openCell();
    fireEvent.click(screen.getByRole('button', { name: 'Open in the atlas: Hiring checks' }));
    expect(onOpenAtlasTopic).toHaveBeenCalledWith('atlas_k3_00000003:t2');
  });

  it('draws no link without an atlas, or with no way to open it', () => {
    const { unmount } = render(
      <SessionRiskMatrixView build={build} builds={[build]} onSelectBuild={jest.fn()} onOpenAtlasTopic={jest.fn()} />,
    );
    openCell();
    expect(screen.queryByRole('button', { name: /Open in the atlas/ })).not.toBeInTheDocument();
    unmount();

    render(<SessionRiskMatrixView build={build} builds={[build]} onSelectBuild={jest.fn()} atlas={atlas} />);
    openCell();
    expect(screen.queryByRole('button', { name: /Open in the atlas/ })).not.toBeInTheDocument();
  });
});

it('lets viewers open an earlier build', () => {
  const onSelectBuild = jest.fn();
  render(<SessionRiskMatrixView build={build} builds={[build, older]} onSelectBuild={onSelectBuild} />);
  fireEvent.change(screen.getByRole('combobox', { name: 'Version' }), { target: { value: older.id } });
  expect(onSelectBuild).toHaveBeenCalledWith(older.id);
});
