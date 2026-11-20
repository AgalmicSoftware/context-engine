/** @file ParticipantsGraphControls.test.tsx */
import { fireEvent, render, screen } from '@testing-library/react';
import ParticipantsGraphControls from './ParticipantsGraphControls';

const renderControls = (overrides = {}) => {
  const props = {
    clusterCount: '3',
    clustersAutomatic: true,
    onClusterStep: jest.fn(),
    onClusterChange: jest.fn(),
    onClusterBlur: jest.fn(),
    projection: 'UMAP',
    projections: [
      { value: 'UMAP', label: 'UMAP' },
      { value: 'SVD', label: 'SVD/PCA' },
    ],
    onProjectionChange: jest.fn(),
    toggles: ['Statements', 'Participants', 'Outline', 'Axes', 'Radial axes'].map((label) => ({
      label,
      checked: label !== 'Statements',
      onChange: jest.fn(),
    })),
    onReset: jest.fn(),
    ...overrides,
  };
  const onRowClick = jest.fn();
  render(
    // The title line it sits on shows and hides the section when pressed.
    <div onClick={onRowClick}>
      <ParticipantsGraphControls {...props} />
    </div>,
  );
  return { props, onRowClick };
};

it('keeps Clusters on the title line and every other setting behind the gear', () => {
  const { props, onRowClick } = renderControls();
  expect(screen.getByRole('spinbutton', { name: 'Clusters' })).toHaveValue(3);
  fireEvent.click(screen.getByRole('button', { name: 'Increase cluster count' }));
  expect(props.onClusterStep).toHaveBeenCalledWith(1);
  expect(screen.queryByRole('group', { name: 'Graph settings' })).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: 'Graph settings' }));
  expect(screen.getByRole('combobox', { name: /Projection/ })).toHaveValue('UMAP');
  expect(screen.getAllByRole('checkbox').map((box) => box.closest('label')?.textContent)).toEqual([
    'Statements',
    'Participants',
    'Outline',
    'Axes',
    'Radial axes',
  ]);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Outline' }));
  expect(props.toggles[2].onChange).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
  expect(props.onReset).toHaveBeenCalledTimes(1);
  // None of these presses reached the title line, so the section stayed open.
  expect(onRowClick).not.toHaveBeenCalled();
});

it('closes the settings on Escape or a press elsewhere', () => {
  renderControls();
  const gear = screen.getByRole('button', { name: 'Graph settings' });
  fireEvent.click(gear);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(gear).toHaveAttribute('aria-expanded', 'false');
  expect(gear).toHaveFocus();
  fireEvent.click(gear);
  fireEvent.pointerDown(document.body);
  expect(gear).toHaveAttribute('aria-expanded', 'false');
});
