import { buildSponsoredFlagFields, normalizeSponsoredFieldSnapshot, SPONSORED_FIELD_KEYS } from './sponsoredFlags.js';

describe('sponsoredFlags', () => {
  it('does not mark Lit sponsorship active when no Lit runtime secret is present', () => {
    expect(
      buildSponsoredFlagFields({
        secrets: {
          litAccountApiKey: '',
        },
      }),
    ).toEqual(
      expect.objectContaining({
        [SPONSORED_FIELD_KEYS.lit]: '0',
      }),
    );
  });

  it('marks Lit sponsorship active when a Lit account API key is present', () => {
    expect(
      buildSponsoredFlagFields({
        secrets: {
          litAccountApiKey: 'account-secret',
        },
      }),
    ).toEqual(
      expect.objectContaining({
        [SPONSORED_FIELD_KEYS.lit]: '1',
      }),
    );
  });

  it('marks Lit sponsorship active when a Lit usage API key is present', () => {
    expect(
      buildSponsoredFlagFields({
        secrets: {
          litUsageApiKey: 'lit-secret',
        },
      }),
    ).toEqual(
      expect.objectContaining({
        [SPONSORED_FIELD_KEYS.lit]: '1',
      }),
    );
  });

  it('preserves previously provisioned sponsored fields after secrets are cleared', () => {
    expect(
      buildSponsoredFlagFields({
        secrets: {},
        fallbackFields: {
          [SPONSORED_FIELD_KEYS.lit]: '1',
          [SPONSORED_FIELD_KEYS.ai]: '1',
        },
      }),
    ).toEqual(
      expect.objectContaining({
        [SPONSORED_FIELD_KEYS.lit]: '1',
        [SPONSORED_FIELD_KEYS.ai]: '1',
      }),
    );
  });

  it('preserves provisioned sponsored fields when worker secrets are disabled', () => {
    expect(
      buildSponsoredFlagFields({
        secrets: {},
        fallbackFields: {
          [SPONSORED_FIELD_KEYS.lit]: '1',
          [SPONSORED_FIELD_KEYS.ai]: '1',
        },
        workerSecretsEnabled: false,
      }),
    ).toEqual(
      expect.objectContaining({
        [SPONSORED_FIELD_KEYS.lit]: '1',
        [SPONSORED_FIELD_KEYS.ai]: '1',
      }),
    );
  });

  it('normalizes unknown or empty fallback snapshots to disabled flags', () => {
    expect(
      normalizeSponsoredFieldSnapshot({
        [SPONSORED_FIELD_KEYS.lit]: 'yes',
        [SPONSORED_FIELD_KEYS.ai]: '',
      }),
    ).toEqual({
      [SPONSORED_FIELD_KEYS.ai]: '0',
      [SPONSORED_FIELD_KEYS.rpc]: '0',
      [SPONSORED_FIELD_KEYS.faucet]: '0',
      [SPONSORED_FIELD_KEYS.arweave]: '0',
      [SPONSORED_FIELD_KEYS.lit]: '0',
      [SPONSORED_FIELD_KEYS.transcribe]: '0',
    });
  });
});
