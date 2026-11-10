type Payload = Record<string, unknown>;

const isRecord = (value: unknown): value is Payload => !!value && typeof value === 'object' && !Array.isArray(value);

export function mergeSurveyResponseSnapshot(stored: unknown, submitted: Payload, changedRows: Payload[]): Payload {
  if (stored !== null && (!isRecord(stored) || !Array.isArray(stored.responses))) {
    throw new Error('The stored survey response is not a complete response container.');
  }
  const rows: Payload[] = [];
  const positions = new Map<string, number>();
  const storedRows = isRecord(stored) ? (stored.responses as unknown[]) : [];
  for (const value of storedRows) {
    if (!isRecord(value) || typeof value.questionID !== 'string' || !value.questionID.trim()) {
      throw new Error('The stored survey response has an invalid answer row.');
    }
    const key = value.questionID.toLowerCase();
    if (positions.has(key)) throw new Error('The stored survey response has duplicate answer rows.');
    positions.set(key, rows.length);
    rows.push(value);
  }
  // These are the final encrypted answers actually sent, not the form's rows.
  // Keep every other stored row untouched, including its ciphertext and envelope.
  for (const value of changedRows) {
    if (typeof value.questionID !== 'string' || !value.questionID.trim()) {
      throw new Error('A submitted answer is missing its question ID.');
    }
    const key = value.questionID.toLowerCase();
    const position = positions.get(key);
    if (position === undefined) {
      positions.set(key, rows.length);
      rows.push(value);
    } else {
      rows[position] = value;
    }
  }
  return { ...(isRecord(stored) ? stored : {}), ...submitted, responses: rows };
}
