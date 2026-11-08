import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import SessionDebateAtlasView from './SessionDebateAtlasView';
import type { DebateAtlasBuild } from '../../domains/debateAtlas/debateAtlasTypes';

const mockDebateMap = jest.fn();
jest.mock('../DebateMap/DebateMap', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockDebateMap(props);
    return <div data-testid="debate-map" />;
  },
}));

const build: DebateAtlasBuild = {
  id: 'atlas_k2_00000002',
  builtAt: '2026-11-08T14:05:00.000Z',
  title: 'Salon atlas',
  counts: { responses: 500, participants: 40, aiResponses: 420 },
  missingTopics: ['Privacy', 'Labor'],
  branches: [{ id: 'b1', label: 'Trust', topics: [] }],
};
const older = { id: 'atlas_k1_00000001', builtAt: '2026-11-08T13:00:00.000Z', counts: { responses: 300 } };

it('draws the build read-only as circles, stamped, and names topics it could not map', () => {
  render(<SessionDebateAtlasView build={build} builds={[build]} onSelectBuild={jest.fn()} sessionSlug="salon" />);
  expect(screen.getByRole('heading', { name: 'Salon atlas' })).toBeVisible();
  expect(screen.getByText(/^Built .*500 responses · 40 participants$/)).toBeVisible();
  expect(screen.getByRole('status')).toHaveTextContent('Not mapped this time: Privacy, Labor.');
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  expect(mockDebateMap).toHaveBeenLastCalledWith(
    expect.objectContaining({
      atlasLayoutMode: 'packed',
      atlasRootLabel: 'Salon atlas',
      hideDemoModeToggle: true,
      readOnly: true,
      treeData: [expect.objectContaining({ id: 'atlas_k2_00000002:b1', name: 'Trust' })],
    }),
  );
});

it('lets viewers open an earlier build', () => {
  const onSelectBuild = jest.fn();
  render(
    <SessionDebateAtlasView build={build} builds={[build, older]} onSelectBuild={onSelectBuild} sessionSlug="salon" />,
  );
  const picker = screen.getByRole('combobox', { name: 'Build' });
  expect(picker).toHaveValue('atlas_k2_00000002');
  fireEvent.change(picker, { target: { value: 'atlas_k1_00000001' } });
  expect(onSelectBuild).toHaveBeenCalledWith('atlas_k1_00000001');
});
