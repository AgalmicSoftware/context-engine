import { writeClipboard } from './copyText';
import { notify } from './notify.js';

const COPY_REFUSED = "Copying isn't allowed here, so the JSON could not be copied.";

export const copyJsonToClipboard = (obj: unknown): Promise<void> => {
  let formatted: string;
  try {
    formatted = JSON.stringify(obj, null, 2);
  } catch (error) {
    notify.error('Failed to copy JSON');
    return Promise.reject(error);
  }
  return writeClipboard(formatted).then(
    () => {
      notify.success('JSON copied to clipboard');
    },
    (error: unknown) => {
      notify.error(COPY_REFUSED);
      throw error;
    },
  );
};

export const formatJsonForDisplay = (obj: unknown): string => {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (error) {
    void error;
    return '';
  }
};
