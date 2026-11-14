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
  // One build still shows its Version, so the time sits where it does with several.
  expect(screen.getByRole('combobox', { name: 'Version' })).toHaveDisplayValue(/2026/);
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
  const picker = screen.getByRole('combobox', { name: 'Version' });
  expect(picker).toHaveValue('atlas_k2_00000002');
  fireEvent.change(picker, { target: { value: 'atlas_k1_00000001' } });
  expect(onSelectBuild).toHaveBeenCalledWith('atlas_k1_00000001');
});

it('opens the node a link asked for, first showing the build it belongs to', () => {
  const onSelectBuild = jest.fn();
  const onRequestedNodeClose = jest.fn();
  const view = (shownBuild: DebateAtlasBuild) => (
    <SessionDebateAtlasView
      build={shownBuild}
      builds={[build, older]}
      onSelectBuild={onSelectBuild}
      sessionSlug="salon"
      workerUrl="https://ce-salon.workers.dev"
      requestedNodeId="atlas_k1_00000001:b1t2"
      onRequestedNodeClose={onRequestedNodeClose}
    />
  );
  const { rerender } = render(view(build));
  expect(onSelectBuild).toHaveBeenCalledWith('atlas_k1_00000001');
  expect(mockDebateMap).toHaveBeenLastCalledWith(expect.objectContaining({ requestedModalNodeId: null }));

  rerender(view({ ...older, branches: [] }));
  expect(onSelectBuild).toHaveBeenCalledTimes(1);
  const [props] = mockDebateMap.mock.calls[mockDebateMap.mock.calls.length - 1];
  expect(props).toMatchObject({ requestedModalNodeId: 'atlas_k1_00000001:b1t2', onModalClose: onRequestedNodeClose });
  // A node's copy button shares the session's atlas link.
  expect(props.buildNodeLink('atlas_k1_00000001:b1')).toBe(
    '/atlas/atlas_k1_00000001%3Ab1?session=salon&worker=https%3A%2F%2Fce-salon.workers.dev',
  );
  // A question's card opens its own page, and the levels are named as the atlas has them.
  expect(props.buildQuestionLink('0xABC')).toBe(
    '/question/0xabc?session=salon&worker=https%3A%2F%2Fce-salon.workers.dev',
  );
  expect(props.levelLabels).toEqual(['Category', 'Topic']);

  // Picking another build afterwards is the reader's choice, and leaves the node shut.
  rerender(view(build));
  expect(onSelectBuild).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByRole('combobox', { name: 'Version' }), { target: { value: 'atlas_k1_00000001' } });
  expect(onRequestedNodeClose).toHaveBeenCalledTimes(1);
  expect(onSelectBuild).toHaveBeenLastCalledWith('atlas_k1_00000001');
});
