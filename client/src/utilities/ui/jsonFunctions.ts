import { notify } from './notify.js';

export const copyJsonToClipboard = (obj: unknown): Promise<void> => {
  try {
    const formatted = JSON.stringify(obj, null, 2);
    if (
      typeof navigator === 'undefined' ||
      !navigator.clipboard ||
      typeof navigator.clipboard.writeText !== 'function'
    ) {
      const error = new Error('Clipboard API unavailable');
      notify.error('Failed to copy JSON');
      return Promise.reject(error);
    }

    return navigator.clipboard
      .writeText(formatted)
      .then(() => {
        notify.success('JSON copied to clipboard');
      })
      .catch((error) => {
        notify.error('Failed to copy JSON');
        throw error;
      });
  } catch (error) {
    notify.error('Failed to copy JSON');
    return Promise.reject(error);
  }
};

export const formatJsonForDisplay = (obj: unknown): string => {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (error) {
    void error;
    return '';
  }
};
