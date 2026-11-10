import { responseEnvelopeMatchesAudience } from './responseEnvelopeAudience';

const a = {
  chain: 'optimismSepolia',
  accessControlConditions: [
    { contractAddress: '0x01', returnValueTest: { comparator: '>', value: '0' } },
    { operator: 'and' },
    { contractAddress: '0x02' },
  ],
};
const b = { ...a, chain: 'ethereum' };
const envelope = (policies: unknown[]) => ({
  recipients: [{ type: 'self-eip712-v1' }, ...policies.map((lit) => ({ type: 'lit-sbt-v1', lit }))],
});

it('canonicalizes object keys and independent recipient order, ignoring encryption-specific data', () => {
  const reordered = {
    accessControlConditions: [
      { returnValueTest: { value: '0', comparator: '>' }, contractAddress: '0x01' },
      { operator: 'and' },
      { contractAddress: '0x02' },
    ],
    chain: 'optimismSepolia',
    resourceId: 'new-resource',
    ciphertext: 'new-ciphertext',
  };
  expect(responseEnvelopeMatchesAudience(envelope([b, a]), 'gate', { ...a, recipients: [reordered, b] })).toBe(true);
});

it('checks every Lit recipient, chain and logical operator and refuses unresolved policies', () => {
  for (const policy of [
    undefined,
    {},
    { ...a, chain: 'ethereum' },
    { ...a, accessControlConditions: [a.accessControlConditions[0], { operator: 'or' }, a.accessControlConditions[2]] },
    { ...a, recipients: [a, b] },
  ]) {
    expect(responseEnvelopeMatchesAudience(envelope([a]), 'gate', policy)).toBe(false);
  }
  expect(responseEnvelopeMatchesAudience(envelope([a, b]), 'gate', a)).toBe(false);
  expect(responseEnvelopeMatchesAudience(envelope([{}]), 'gate', a)).toBe(false);
  expect(responseEnvelopeMatchesAudience(envelope([a]), undefined, a)).toBe(false);
});
