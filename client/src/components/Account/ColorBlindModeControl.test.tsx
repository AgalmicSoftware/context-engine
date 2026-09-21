import { act, fireEvent, render, screen } from '@testing-library/react';
import ColorBlindModeControl from './ColorBlindModeControl';
import { COLOR_VISION_STORAGE_KEY, setColorBlindPreference } from '../../utilities/ui/colorVisionRuntime';

beforeEach(() => setColorBlindPreference(false));

it('lets settings enable, restore, and disable the site-wide palette', () => {
  const { unmount } = render(<ColorBlindModeControl />);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Color-blind mode' }));
  expect(document.documentElement.dataset.ceColorVision).toBe('color-blind');
  expect(window.localStorage.getItem(COLOR_VISION_STORAGE_KEY)).toBe('color-blind');
  unmount();
  render(<ColorBlindModeControl />);
  expect(screen.getByRole('checkbox')).toBeChecked();
  act(() => setColorBlindPreference(false));
  expect(screen.getByRole('checkbox')).not.toBeChecked();
});
