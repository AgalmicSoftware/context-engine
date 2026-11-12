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
  counts: { responses: 12, participants: 1 },
};
const older = { id: 'atlas_k1_00000001', builtAt: '2026-11-08T13:00:00.000Z', counts: { responses: 3 } };

const panel = (props: Partial<React.ComponentProps<typeof ResultsBuildPanel>> = {}) => (
  <ResultsBuildPanel
    kind="debate-atlas"
    label="Debate atlas"
    build={build}
    builds={[build]}
    help="What it is."
    onSelectBuild={jest.fn()}
    {...props}
  >
    <p>Body</p>
  </ResultsBuildPanel>
);

it("stamps the build with its time and counts, under its title or the view's name", () => {
  render(panel());
  expect(screen.getByRole('region', { name: 'Debate atlas' })).toHaveAttribute(
    'data-testid',
    'ce-session-debate-atlas',
  );
  expect(screen.getByRole('heading', { name: 'Debate atlas' })).toBeVisible();
  expect(screen.getByText(/^Built .*2026.* · 12 responses · 1 participant$/)).toBeVisible();
  expect(screen.getByText('Body')).toBeVisible();
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
});

it('leaves out a time it cannot read', () => {
  render(panel({ build: { ...build, title: 'Salon atlas', builtAt: 'not a date' } }));
  expect(screen.getByRole('heading', { name: 'Salon atlas' })).toBeVisible();
  expect(screen.getByText('Built 12 responses · 1 participant')).toBeVisible();
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
    expect.stringMatching(/ · 12 responses · 1 participant$/),
    expect.stringMatching(/ · 3 responses$/),
  ]);
  fireEvent.change(picker, { target: { value: older.id } });
  expect(onSelectBuild).toHaveBeenCalledWith(older.id);
});
