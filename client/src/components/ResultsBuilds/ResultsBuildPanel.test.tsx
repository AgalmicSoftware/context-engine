import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import ResultsBuildPanel from './ResultsBuildPanel';

jest.mock('../Shared/CETooltip', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div role="tooltip">{children}</div>,
}));

const build = {
  id: 'atlas_k2_00000002',
  builtAt: '2026-11-08T14:05:00.000Z',
  model: 'deep-model',
  counts: { responses: 12, participants: 1 },
};
const older = { id: 'atlas_k1_00000001', builtAt: '2026-11-08T13:00:00.000Z', counts: { responses: 3 } };

const panel = (props: Partial<React.ComponentProps<typeof ResultsBuildPanel>> = {}) => (
  <ResultsBuildPanel
    kind="debate-atlas"
    label="Atlas"
    build={build}
    builds={[build]}
    help="What it is."
    onSelectBuild={jest.fn()}
    {...props}
  >
    <p>Body</p>
  </ResultsBuildPanel>
);

it('heads the build with only its version, model and counts, and no title', () => {
  render(panel({ build: { ...build, title: 'Salon atlas' } }));
  const region = screen.getByRole('region', { name: 'Atlas' });
  expect(region).toHaveAttribute('data-testid', 'ce-session-debate-atlas');
  expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  expect(screen.queryByText(/Salon atlas|Built/)).not.toBeInTheDocument();
  // One build still shows its Version, so the time sits where it does with several.
  expect(screen.getByRole('combobox', { name: 'Version' })).toHaveDisplayValue(/2026/);
  expect(screen.getByText('deep-model · 12 responses · 1 participant')).toBeVisible();
  expect(screen.getByText('Body')).toBeVisible();
});

it('leaves out what the build does not say, and names a version by its id when its time is unreadable', () => {
  const unread = { id: 'atlas_k3_00000003', builtAt: 'not a date', counts: { responses: 1489 } };
  render(panel({ build: unread, builds: [unread] }));
  expect(screen.getByText('1,489 responses')).toBeVisible();
  expect(screen.getByRole('combobox', { name: 'Version' })).toHaveDisplayValue('atlas_k3_00000003');
});

it('says what the view is, and how much of the session the AI read', () => {
  const { rerender } = render(panel());
  expect(screen.getByRole('button', { name: 'About this atlas' })).toBeVisible();
  expect(screen.getByRole('tooltip')).toHaveTextContent(/^What it is\.$/);
  rerender(panel({ build: { ...build, counts: { responses: 500, aiResponses: 420 } } }));
  expect(screen.getByRole('tooltip')).toHaveTextContent(/^What it is\. The AI read 420 of the 500 responses\.$/);
});

it('lets viewers open an earlier build', () => {
  const onSelectBuild = jest.fn();
  render(panel({ builds: [build, older], onSelectBuild }));
  const picker = screen.getByRole('combobox', { name: 'Version' });
  expect(picker).toHaveValue(build.id);
  expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
    expect.stringMatching(/2026/),
    expect.stringMatching(/2026/),
  ]);
  fireEvent.change(picker, { target: { value: older.id } });
  expect(onSelectBuild).toHaveBeenCalledWith(older.id);
});
