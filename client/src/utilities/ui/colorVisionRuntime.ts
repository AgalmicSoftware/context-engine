export const COLOR_VISION_STORAGE_KEY = 'ce:color-vision';
export const COLOR_VISION_CHANGE_EVENT = 'ce:color-vision-change';

export function readColorBlindPreference(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(COLOR_VISION_STORAGE_KEY) === 'color-blind';
  } catch {
    return false;
  }
}

export function isColorBlindModeEnabled(): boolean {
  return typeof document !== 'undefined'
    ? document.documentElement.dataset.ceColorVision === 'color-blind'
    : readColorBlindPreference();
}

function applyPreference(enabled: boolean): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.ceColorVision = enabled ? 'color-blind' : 'standard';
  window.dispatchEvent(new Event(COLOR_VISION_CHANGE_EVENT));
}

export function setColorBlindPreference(enabled: boolean): void {
  try {
    if (enabled) window.localStorage.setItem(COLOR_VISION_STORAGE_KEY, 'color-blind');
    else window.localStorage.removeItem(COLOR_VISION_STORAGE_KEY);
  } catch {
    // Restricted storage must not prevent the accessibility setting taking effect.
  }
  applyPreference(enabled);
}

let storageListenerInstalled = false;
export function initializeColorVisionRuntime(): void {
  applyPreference(readColorBlindPreference());
  if (typeof window === 'undefined' || storageListenerInstalled) return;
  window.addEventListener('storage', (event) => {
    if (event.key === COLOR_VISION_STORAGE_KEY || event.key === null) applyPreference(readColorBlindPreference());
  });
  storageListenerInstalled = true;
}

export function subscribeColorVisionChanges(listener: () => void): () => void {
  window.addEventListener(COLOR_VISION_CHANGE_EVENT, listener);
  return () => window.removeEventListener(COLOR_VISION_CHANGE_EVENT, listener);
}
