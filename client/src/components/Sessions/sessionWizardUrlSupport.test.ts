import {
  buildSessionWizardAdminUrl,
  buildSessionWizardSessionUrl,
  extractSessionWizardArweaveTxId,
  getSessionWizardExplorerBaseUrl,
  normalizeSessionWizardArweaveUri,
  normalizeSessionWizardSlug,
  normalizeSessionWizardWorkerUrl,
  parseSessionWizardArweaveTxId,
} from './sessionWizardUrlSupport';

describe('sessionWizardUrlSupport', () => {
  const txId = 'a'.repeat(43);

  it('extracts arweave tx ids from raw ids, ar urls, and gateway urls', () => {
    expect(extractSessionWizardArweaveTxId(txId)).toBe(txId);
    expect(extractSessionWizardArweaveTxId(`ar://${txId}`)).toBe(txId);
    expect(extractSessionWizardArweaveTxId(`https://arweave.net/${txId}`)).toBe(txId);
    expect(parseSessionWizardArweaveTxId(`https://arweave.dev/${txId}`)).toBe(txId);
    expect(extractSessionWizardArweaveTxId('https://example.com/not-arweave')).toBe('');
  });

  it('normalizes arweave uris and session slugs', () => {
    expect(normalizeSessionWizardArweaveUri(txId)).toBe(`ar://${txId}`);
    expect(normalizeSessionWizardArweaveUri(`ar://${txId}`)).toBe(`ar://${txId}`);
    expect(normalizeSessionWizardArweaveUri(' https://example.com/file.json ')).toBe('https://example.com/file.json');
    expect(normalizeSessionWizardSlug(' Demo Space ')).toBe('Demo Space');
  });

  it('builds session and admin urls from explicit origins', () => {
    expect(
      buildSessionWizardSessionUrl({
        slug: ' Demo Space ',
        origin: 'https://app.example',
      }),
    ).toBe('https://app.example/session/Demo%20Space');
    expect(
      buildSessionWizardAdminUrl({
        sessionId: 'abc-123',
        chainId: 84532,
        origin: 'https://app.example',
      }),
    ).toBe('https://app.example/admin?sessionId=abc-123&chainId=84532');
  });

  it('normalizes worker urls and resolves explorer bases', () => {
    expect(normalizeSessionWizardWorkerUrl(' https://worker.example/path/ ')).toBe('https://worker.example/path');
    expect(getSessionWizardExplorerBaseUrl(0)).toBe('');
    expect(getSessionWizardExplorerBaseUrl(84532)).toMatch(/^https?:\/\//);
  });
});
