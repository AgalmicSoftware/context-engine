/** @file wagmiDisconnectState.js */

import { createLogger } from '../logging.js';

const log = createLogger('wagmiDisconnectState');
export const USER_DISCONNECTED_STORAGE_KEY = 'ce:userDisconnected';

const getStorage = (): Storage | null => {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch (_) {
    return null;
  }
};

export const wasUserExplicitlyDisconnected = (storage: Storage | null = getStorage()): boolean => {
  try {
    return storage?.getItem(USER_DISCONNECTED_STORAGE_KEY) === 'true';
  } catch (_) {
    return false;
  }
};

export const markUserExplicitlyDisconnected = (storage: Storage | null = getStorage()): void => {
  try {
    storage?.setItem(USER_DISCONNECTED_STORAGE_KEY, 'true');
  } catch (e) {
    log.warn('wagmiDisconnectState: fallback', e);
  }
};

export const clearUserExplicitlyDisconnected = (storage: Storage | null = getStorage()): void => {
  try {
    storage?.removeItem(USER_DISCONNECTED_STORAGE_KEY);
  } catch (e) {
    log.warn('wagmiDisconnectState: fallback', e);
  }
};
