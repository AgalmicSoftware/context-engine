const SAFE_IDENTIFIER_PATTERN = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/i;

export const isSafeIdentifier = (value) => (
  typeof value === 'string'
  && SAFE_IDENTIFIER_PATTERN.test(value)
  && !value.includes('..')
);

export const validateSafeIdentifier = (errors, value, path) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    errors.push(`${path} must be a non-empty string`);
    return;
  }
  if (!isSafeIdentifier(value)) {
    errors.push(`${path} must start and end with a letter or number and use only letters, numbers, dots, underscores, and hyphens`);
  }
};

export const registerCaseFoldedIdentifier = (errors, seen, value, path) => {
  const normalized = String(value || '').toLowerCase();
  if (seen.has(normalized)) errors.push(`${path} duplicates ${value} after case normalization`);
  seen.add(normalized);
};

export const assertSafeUniqueIdentifiers = (values, label) => {
  const seen = new Set();
  for (const value of values) {
    if (!isSafeIdentifier(value)) throw new Error(`${label} contains unsafe identifier ${String(value)}`);
    const normalized = value.toLowerCase();
    if (seen.has(normalized)) throw new Error(`${label} contains case-colliding identifier ${value}`);
    seen.add(normalized);
  }
};
