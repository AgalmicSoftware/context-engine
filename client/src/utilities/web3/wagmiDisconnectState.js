/** @file wagmiDisconnectState.js */


import { createLogger } from '../logging.js';

const log = createLogger('wagmiDisconnectState');
export const USER_DISCONNECTED_STORAGE_KEY = 'ce:userDisconnected';

const getStorage = () => {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch (_) {
    return null;
  }
};

export const wasUserExplicitlyDisconnected = (storage = getStorage()) => {
  try {
    return storage?.getItem(USER_DISCONNECTED_STORAGE_KEY) === 'true';
  } catch (_) {
    return false;
  }
};

export const markUserExplicitlyDisconnected = (storage = getStorage()) => {
  try {
    storage?.setItem(USER_DISCONNECTED_STORAGE_KEY, 'true');
  } catch (e) { log.warn('wagmiDisconnectState: fallback', e); }
};

export const clearUserExplicitlyDisconnected = (storage = getStorage()) => {
  try {
    storage?.removeItem(USER_DISCONNECTED_STORAGE_KEY);
  } catch (e) { log.warn('wagmiDisconnectState: fallback', e); }
};
