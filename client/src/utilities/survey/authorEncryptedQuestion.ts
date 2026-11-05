const AUTHOR_ENCRYPTED_FIELDS = [
  'promptEncrypted',
  'encryptedPrompt',
  'optionsEncrypted',
  'encryptedOptions',
  'tagsEncrypted',
  'encryptedTags',
] as const;

// A question whose author encrypted its text. AI inputs, and the Generated AI views others open, leave its text
// out, even after this reader decrypted it.
export const hasAuthorEncryptedText = (question: unknown): boolean => {
  const record = question && typeof question === 'object' ? (question as Record<string, unknown>) : {};
  return AUTHOR_ENCRYPTED_FIELDS.some((field) => Boolean(record[field]));
};
