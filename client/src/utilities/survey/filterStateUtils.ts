/**
 * @file filterStateUtils.js
 * @module filterStateUtils
 * @description Survey filter state management — serializes/deserializes filter state to URL
 *              search params and provides empty-state detection for filter UIs.
 *
 * Key exports: serializeFilterState, deserializeFilterState
 */

/**
 * Default structure for an empty filter state.
 * Used for deserialization fallbacks and for checking if a state is "effectively empty".
 */

import { createLogger } from '../logging.js';

const cacheLog = createLogger('cache');

type FilterStateResponseStatus = {
  responded: boolean;
  notResponded: boolean;
} | null;

export type SurveyFilterState = {
  topQuestions: number | null;
  questionTypes: string[];
  sbtFilter: unknown;
  aiFilter: string | null;
  aiTopN: number | null;
  aiCombine: boolean;
  selectedTags: string[];
  responseStatus: FilterStateResponseStatus;
};

type FilterStateRecord = Record<string, unknown>;

const hasOwn = (value: FilterStateRecord, key: keyof SurveyFilterState | string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const isRecord = (value: unknown): value is FilterStateRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const defaultEmptyFilterState: SurveyFilterState = {
  topQuestions: null,
  questionTypes: [],
  sbtFilter: null,
  aiFilter: null,
  aiTopN: null,
  aiCombine: false,
  selectedTags: [],
  responseStatus: null,
};

/**
 * Checks if a given filter state object is "effectively empty".
 * An object is effectively empty if it's an empty object `{}`, or if all its
 * properties match the values in defaultEmptyFilterState (implicitly or explicitly),
 * and it does not contain any extraneous properties not defined in defaultEmptyFilterState.
 * @param {object} filterStateObj - The filter state object to check. Assumed to be non-null.
 * @returns {boolean} True if the object is effectively empty, false otherwise.
 */
function isEffectivelyEmpty(filterStateObj: FilterStateRecord): boolean {
  // This function assumes filterStateObj is a non-null, actual object,
  // as serializeFilterState handles null/undefined checks before calling this.

  if (Object.keys(filterStateObj).length === 0) {
    return true; // An empty object {} is effectively empty.
  }

  // Check if all properties present in filterStateObj match their default values,
  // and that properties defined in defaultEmptyFilterState but missing in filterStateObj
  // are consistent with their defaults (e.g., a missing 'topQuestions' is fine if default is null).
  for (const key in defaultEmptyFilterState) {
    if (hasOwn(defaultEmptyFilterState as unknown as FilterStateRecord, key)) {
      const valueInObj = filterStateObj[key];
      const defaultValue = defaultEmptyFilterState[key as keyof SurveyFilterState];

      if (hasOwn(filterStateObj, key)) {
        // If the key exists in filterStateObj, its value must match the default.
        // JSON.stringify is used for simple deep comparison of values.
        if (JSON.stringify(valueInObj) !== JSON.stringify(defaultValue)) {
          return false;
        }
      } else {
        // If key is not in filterStateObj, it's implicitly default. This is fine.
        // For example, if defaultEmptyFilterState.topQuestions is null,
        // and filterStateObj doesn't have 'topQuestions', it's considered matching default.
      }
    }
  }

  // Check for any keys in filterStateObj that are not part of the default structure.
  for (const key in filterStateObj) {
    if (hasOwn(filterStateObj, key) && !hasOwn(defaultEmptyFilterState as unknown as FilterStateRecord, key)) {
      return false; // Found an extraneous key not in defaultEmptyFilterState
    }
  }

  return true;
}

/**
 * Serializes a filter state object into a URL-safe Base64 string.
 * Handles UTF-8 characters correctly during Base64 encoding.
 * @param {object} filterStateObj - The filter state JavaScript object.
 * @returns {string} The Base64URL encoded string, or an empty string if
 *                   filterStateObj is null, undefined, or effectively empty.
 */
export function serializeFilterState(filterStateObj: FilterStateRecord | null | undefined): string {
  if (filterStateObj === null || filterStateObj === undefined) {
    return '';
  }
  // Check for effectively empty only if it's an object.
  if (typeof filterStateObj === 'object' && isEffectivelyEmpty(filterStateObj)) {
    return '';
  }

  try {
    const jsonString = JSON.stringify(filterStateObj);

    // Standard pattern for UTF-8 safety with btoa:
    // 1. encodeURIComponent to handle multi-byte UTF-8 characters into %xx sequences.
    // 2. unescape to convert %xx sequences into single-byte characters that btoa can process.
    const base64String = window.btoa(unescape(encodeURIComponent(jsonString)));

    // Convert to Base64URL format
    const base64UrlString = base64String
      .replace(/\+/g, '-') // Replace '+' with '-'
      .replace(/\//g, '_') // Replace '/' with '_'
      .replace(/=+$/, ''); // Remove trailing '=' padding

    return base64UrlString;
  } catch (error) {
    cacheLog.error('Error serializing filter state:', error);
    return ''; // Return empty string on error as a fallback
  }
}

/**
 * Deserializes a Base64URL encoded string back into a filter state object.
 * Handles UTF-8 characters correctly during Base64 decoding.
 * @param {string} base64UrlString - The Base64URL encoded string.
 * @returns {object} The filter state object. Returns a new instance of the default
 *                   empty filter state if the string is invalid or an error occurs.
 */
export function deserializeFilterState(base64UrlString: string | null | undefined): SurveyFilterState {
  // Create a new instance of the default state for fallback, ensuring arrays are new instances.
  const newDefaultStateInstance: SurveyFilterState = {
    ...defaultEmptyFilterState,
    questionTypes: [...defaultEmptyFilterState.questionTypes],
    selectedTags: [...defaultEmptyFilterState.selectedTags],
  };

  if (base64UrlString === null || base64UrlString === undefined || base64UrlString.trim() === '') {
    return newDefaultStateInstance;
  }

  try {
    // Convert Base64URL back to standard Base64
    let base64String = base64UrlString
      .replace(/-/g, '+') // Replace '-' with '+'
      .replace(/_/g, '/'); // Replace '_' with '/'

    // Add Base64 padding if necessary. Standard Base64 decoders might require it.
    // The length of a Base64 string (sans padding) must be a multiple of 4 when padded.
    const paddingLength = base64String.length % 4;
    if (paddingLength === 2) {
      base64String += '==';
    } else if (paddingLength === 3) {
      base64String += '=';
    }
    // If paddingLength is 1, the Base64 string is malformed. window.atob will throw.

    // Standard pattern for UTF-8 safety with atob:
    // 1. window.atob to decode Base64 string into a (potentially multi-byte) Latin1 string.
    // 2. escape to convert Latin1 string (with multi-byte chars as single chars) to %xx sequences.
    // 3. decodeURIComponent to correctly interpret these %xx sequences as UTF-8.
    const jsonString = decodeURIComponent(escape(window.atob(base64String)));
    const parsedValue: unknown = JSON.parse(jsonString);
    if (!isRecord(parsedValue)) {
      return newDefaultStateInstance;
    }
    const parsedObj = parsedValue;

    const aiFilter =
      hasOwn(parsedObj, 'aiFilter') && typeof parsedObj.aiFilter === 'string'
        ? parsedObj.aiFilter
        : defaultEmptyFilterState.aiFilter;
    const parsedAiTopN = Number.parseInt(String(hasOwn(parsedObj, 'aiTopN') ? parsedObj.aiTopN : ''), 10);
    const normalizedAiTopN = Number.isFinite(parsedAiTopN) && parsedAiTopN > 0 ? parsedAiTopN : null;
    const aiTopN = typeof aiFilter === 'string' && aiFilter.trim() !== '' ? normalizedAiTopN : null;
    const aiCombine = typeof aiFilter === 'string' && aiFilter.trim() !== '' ? parsedObj.aiCombine === true : false;

    // Ensure the parsed object conforms to the filterState structure by merging with defaults.
    // This provides defaults for any missing keys and ensures correct types (e.g., arrays).
    const finalState: SurveyFilterState = {
      topQuestions: hasOwn(parsedObj, 'topQuestions')
        ? (parsedObj.topQuestions as number | null)
        : defaultEmptyFilterState.topQuestions,
      questionTypes:
        hasOwn(parsedObj, 'questionTypes') && Array.isArray(parsedObj.questionTypes)
          ? (parsedObj.questionTypes as string[])
          : [...defaultEmptyFilterState.questionTypes],
      sbtFilter: hasOwn(parsedObj, 'sbtFilter') ? parsedObj.sbtFilter : defaultEmptyFilterState.sbtFilter,
      aiFilter,
      aiTopN,
      aiCombine,
      selectedTags:
        hasOwn(parsedObj, 'selectedTags') && Array.isArray(parsedObj.selectedTags)
          ? (parsedObj.selectedTags as string[])
          : [...defaultEmptyFilterState.selectedTags],
      responseStatus:
        hasOwn(parsedObj, 'responseStatus') && isRecord(parsedObj.responseStatus)
          ? {
              responded: !!parsedObj.responseStatus.responded,
              notResponded: !!parsedObj.responseStatus.notResponded,
            }
          : defaultEmptyFilterState.responseStatus,
    };

    // Ensure no extraneous keys are carried over if not part of defaultEmptyFilterState
    for (const key in finalState) {
      if (!hasOwn(defaultEmptyFilterState as unknown as FilterStateRecord, key)) {
        delete (finalState as FilterStateRecord)[key];
      }
    }

    return finalState;
  } catch (error) {
    cacheLog.error('Error deserializing filter state:', error);
    return newDefaultStateInstance;
  }
}

export function deserializeFilterStateStrict(base64UrlString: string | null | undefined): SurveyFilterState {
  if (base64UrlString === null || base64UrlString === undefined || base64UrlString.trim() === '') {
    throw new Error('Filter state string is empty.');
  }

  let base64String = base64UrlString.replace(/-/g, '+').replace(/_/g, '/');
  const paddingLength = base64String.length % 4;
  if (paddingLength === 1) {
    throw new Error('Filter state string is malformed.');
  }
  if (paddingLength === 2) {
    base64String += '==';
  } else if (paddingLength === 3) {
    base64String += '=';
  }

  const jsonString = decodeURIComponent(escape(window.atob(base64String)));
  const parsedValue: unknown = JSON.parse(jsonString);
  if (!isRecord(parsedValue)) {
    throw new Error('Filter state must decode to an object.');
  }

  return deserializeFilterState(base64UrlString);
}
