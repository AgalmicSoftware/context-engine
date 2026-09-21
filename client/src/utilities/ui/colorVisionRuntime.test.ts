import {
  COLOR_VISION_STORAGE_KEY,
  initializeColorVisionRuntime,
  isColorBlindModeEnabled,
  readColorBlindPreference,
  setColorBlindPreference,
  subscribeColorVisionChanges,
} from './colorVisionRuntime';
import { setStoredThemePreference } from './themeRuntime';

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-ce-color-vision');
});

it('persists the accessibility preference independently of the selected theme', () => {
  initializeColorVisionRuntime();
  expect(isColorBlindModeEnabled()).toBe(false);
  setColorBlindPreference(true);
  setStoredThemePreference('classic-95');
  expect(isColorBlindModeEnabled()).toBe(true);
  expect(readColorBlindPreference()).toBe(true);
  document.documentElement.removeAttribute('data-ce-color-vision');
  initializeColorVisionRuntime();
  expect(isColorBlindModeEnabled()).toBe(true);
  setColorBlindPreference(false);
  expect(window.localStorage.getItem(COLOR_VISION_STORAGE_KEY)).toBeNull();
  expect(document.documentElement.dataset.ceTheme).toBe('classic-95');
});

it('updates subscribers and synchronizes preference changes from another tab', () => {
  initializeColorVisionRuntime();
  const listener = jest.fn();
  const unsubscribe = subscribeColorVisionChanges(listener);
  window.localStorage.setItem(COLOR_VISION_STORAGE_KEY, 'color-blind');
  window.dispatchEvent(new StorageEvent('storage', { key: COLOR_VISION_STORAGE_KEY }));
  expect(isColorBlindModeEnabled()).toBe(true);
  expect(listener).toHaveBeenCalledTimes(1);
  window.localStorage.clear();
  window.dispatchEvent(new StorageEvent('storage', { key: null }));
  expect(isColorBlindModeEnabled()).toBe(false);
  unsubscribe();
  setColorBlindPreference(true);
  expect(listener).toHaveBeenCalledTimes(2);
});

it('applies the preference when persistence is unavailable and rejects unknown stored values', () => {
  window.localStorage.setItem(COLOR_VISION_STORAGE_KEY, 'unknown');
  initializeColorVisionRuntime();
  expect(isColorBlindModeEnabled()).toBe(false);
  const store = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  setColorBlindPreference(true);
  expect(isColorBlindModeEnabled()).toBe(true);
  store.mockRestore();
});
