import { toTrimmedString } from './stringCoercion.js';

export const normalizeSecretValue = (value) => {
  if (value == null) return '';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }
  return toTrimmedString(value);
};
