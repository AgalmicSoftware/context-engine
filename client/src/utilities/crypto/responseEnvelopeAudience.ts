// Recipient lists describe who can unwrap the actual key. Field metadata alone
// cannot change that policy; edited audiences require fresh encryption.
export const responseEnvelopeMatchesAudience = (envelopeJson: unknown, audience: unknown): boolean | null => {
  const requested = String(audience || '')
    .trim()
    .toLowerCase();
  if (!['self', 'self_admin', 'session', 'gate'].includes(requested)) return null;
  try {
    const envelope = typeof envelopeJson === 'string' ? JSON.parse(envelopeJson) : envelopeJson;
    if (!Array.isArray(envelope?.recipients)) return ['self_admin', 'session'].includes(requested) ? false : null;
    const types = envelope.recipients.map((r: { type?: string }) => r?.type);
    const hasSelf = types.includes('self-eip712-v1');
    if (requested === 'self') return hasSelf && types.every((type: string) => type === 'self-eip712-v1');
    if (requested === 'gate') return types.includes('lit-sbt-v1') && !types.includes('worker-response-field-v1');
    const workers = envelope.recipients.filter((r: { type?: string }) => r?.type === 'worker-response-field-v1');
    return (
      hasSelf &&
      workers.length === 1 &&
      workers[0].policy?.audience === requested &&
      types.every((type: string) => ['self-eip712-v1', 'worker-response-field-v1'].includes(type))
    );
  } catch {
    return ['self_admin', 'session'].includes(requested) ? false : null;
  }
};
