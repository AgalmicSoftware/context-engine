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

    return navigator.clipboard.writeText(formatted)
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

export const downloadJson = (obj: unknown, filename = 'data.json'): void => {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};
