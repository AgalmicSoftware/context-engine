const AUTHOR_ENCRYPTED_FIELDS = [
  'promptEncrypted',
  'encryptedPrompt',
  'optionsEncrypted',
  'encryptedOptions',
  'tagsEncrypted',
  'encryptedTags',
] as const;

// A question whose author encrypted its text. Reports and AI inputs that others can read leave its text out,
// even after this reader decrypted it.
export const hasAuthorEncryptedText = (question: unknown): boolean => {
  const record = question && typeof question === 'object' ? (question as Record<string, unknown>) : {};
  return AUTHOR_ENCRYPTED_FIELDS.some((field) => Boolean(record[field]));
};
