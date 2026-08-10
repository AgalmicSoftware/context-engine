import {
  classifyUploadGateStatus,
  getGateSnapshotSbtAddresses,
  getUploadCandidateReasonPriority,
  hasSponsoredArweaveKey,
  isTransientWorkerUploadError,
  isWorkerMissingSessionSecretsError,
  normalizeUploadSessionSlug,
  normalizeWorkerBaseUrl,
  resolveUploadSessionSlug,
  shouldFallbackUploadCandidate,
} from './arweaveUploadFallbackPolicy.js';

describe('arweaveUploadFallbackPolicy', () => {
  it('normalizes worker endpoint URLs back to the worker base', () => {
    expect(normalizeWorkerBaseUrl('https://worker.example/arweave/upload')).toBe('https://worker.example');
    expect(normalizeWorkerBaseUrl('https://worker.example/prefix/auth/nonce')).toBe('https://worker.example/prefix');
    expect(normalizeWorkerBaseUrl('https://worker.example/prefix/admin/lit-chipotle-provision')).toBe(
      'https://worker.example/prefix',
    );
    expect(normalizeWorkerBaseUrl('https://worker.example/lit/chipotle-action')).toBe('https://worker.example');
    expect(normalizeWorkerBaseUrl('https://worker.example/prefix')).toBe('https://worker.example/prefix');
  });

  it('normalizes upload session slug inputs', () => {
    expect(normalizeUploadSessionSlug('general')).toBe('');
    expect(normalizeUploadSessionSlug(' group-1 ')).toBe('group-1');
    expect(resolveUploadSessionSlug({ sessionSlug: 'explicit', sessionConfig: { slug: 'config' } })).toBe('explicit');
    expect(resolveUploadSessionSlug({ sessionConfig: { slug: 'config' } })).toBe('config');
  });

  it('classifies fallback and retryable worker upload failures', () => {
    expect(shouldFallbackUploadCandidate({ message: 'On-chain gate data unavailable.' })).toBe(true);
    expect(shouldFallbackUploadCandidate({ message: 'Worker auth nonce route not supported (404).' })).toBe(true);
    expect(shouldFallbackUploadCandidate({ message: 'Arweave key not configured.' })).toBe(true);
    expect(shouldFallbackUploadCandidate({ message: 'Other failure.' })).toBe(false);
    expect(isWorkerMissingSessionSecretsError('Session secrets not configured.')).toBe(true);
    expect(isTransientWorkerUploadError({ message: 'bad gateway' })).toBe(true);
    expect(isTransientWorkerUploadError({ status: 504 })).toBe(true);
    expect(isTransientWorkerUploadError({ status: 400 })).toBe(false);
  });

  it('dedupes gate snapshot addresses and detects sponsored arweave keys', () => {
    expect(getGateSnapshotSbtAddresses({ sbtAddresses: ['0xA', '0xa'], sbtAddress: '0xB' })).toEqual(['0xA', '0xB']);
    expect(hasSponsoredArweaveKey({ sponsoredKeys: { arweave: true } })).toBe(true);
    expect(hasSponsoredArweaveKey({ sponsoredKeys: { arweave: 'yes' } })).toBe(true);
    expect(hasSponsoredArweaveKey({ sponsoredKeys: { arweave: 'no' } })).toBe(false);
  });

  it('prioritizes upload candidate reasons and classifies gate status', () => {
    expect(getUploadCandidateReasonPriority('sponsored-referrer')).toBeLessThan(
      getUploadCandidateReasonPriority('scope-list'),
    );
    expect(
      classifyUploadGateStatus({
        __registry: {
          gateAuthority: 'onchain',
          gatesByResource: {
            arweave: { lookupStatus: 'ok', sbtAddresses: [] },
            default: { lookupStatus: 'ok', sbtAddresses: ['0xgate'] },
          },
        },
      }),
    ).toEqual({
      gateStatus: 'arweave:no-gate|default:restricted',
      allowsArweaveUpload: true,
      preferenceRank: 0,
    });
    expect(classifyUploadGateStatus({ __registry: { gateAuthority: 'offchain' } })).toEqual({
      gateStatus: 'arweave:unknown|default:unknown',
      allowsArweaveUpload: false,
      preferenceRank: 2,
    });
  });
});
