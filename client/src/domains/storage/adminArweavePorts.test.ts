import {
  bindAdminArweavePorts,
  type AdminArweaveScriptsModule,
  type AdminArweaveUrlsModule,
} from './adminArweavePorts';

describe('admin Arweave ports', () => {
  it('routes balance and upload calls through call-time Arweave script lookup', async () => {
    const firstScripts: AdminArweaveScriptsModule = {
      readArweaveWalletBalance: jest.fn(async () => ({
        address: 'first-address',
        balanceUrl: 'https://arweave.net/wallet/first-address/balance',
        gatewayBase: 'https://arweave.net',
        winston: '1000000000000',
      })),
      formatWinstonToAr: jest.fn(() => '1.000000'),
      uploadDataToArweave: jest.fn(async () => 'first-tx'),
      buildArweaveGatewayUrl: jest.fn(() => 'https://arweave.net/first-tx'),
    };
    const secondScripts: AdminArweaveScriptsModule = {
      readArweaveWalletBalance: jest.fn(async () => ({
        address: 'second-address',
        balanceUrl: 'https://arweave.net/wallet/second-address/balance',
        gatewayBase: 'https://arweave.net',
        winston: '2000000000000',
      })),
      formatWinstonToAr: jest.fn(() => '2.000000'),
      uploadDataToArweave: jest.fn(async () => 'second-tx'),
      buildArweaveGatewayUrl: jest.fn(() => 'https://arweave.net/second-tx'),
    };
    let scripts = firstScripts;
    const ports = bindAdminArweavePorts({
      scripts: () => scripts,
      urls: () => ({ normalizeArweaveUrl: jest.fn(() => '') }),
    });
    const jwk = { kty: 'RSA', n: 'example' };

    await expect(ports.readArweaveWalletBalance(jwk))
      .resolves.toMatchObject({ address: 'first-address' });

    scripts = secondScripts;

    await expect(ports.uploadDataToArweave(
      { type: 'admin-test' },
      'json',
      { sessionSlug: 'edge' }
    )).resolves.toBe('second-tx');
    expect(ports.formatWinstonToAr('2000000000000', 4)).toBe('2.000000');
    expect(ports.buildArweaveGatewayUrl('second-tx')).toBe('https://arweave.net/second-tx');

    expect(firstScripts.readArweaveWalletBalance).toHaveBeenCalledWith(jwk);
    expect(secondScripts.uploadDataToArweave).toHaveBeenCalledWith(
      { type: 'admin-test' },
      'json',
      { sessionSlug: 'edge' }
    );
    expect(secondScripts.formatWinstonToAr).toHaveBeenCalledWith('2000000000000', 4);
    expect(secondScripts.buildArweaveGatewayUrl).toHaveBeenCalledWith('second-tx');
  });

  it('normalizes display URLs through call-time URL helper lookup', () => {
    const firstUrls: AdminArweaveUrlsModule = {
      normalizeArweaveUrl: jest.fn(() => 'https://first.gateway/tx'),
    };
    const secondUrls: AdminArweaveUrlsModule = {
      normalizeArweaveUrl: jest.fn(() => 'https://second.gateway/tx'),
    };
    let urls = firstUrls;
    const ports = bindAdminArweavePorts({
      scripts: () => ({
        readArweaveWalletBalance: jest.fn(),
        formatWinstonToAr: jest.fn(),
        uploadDataToArweave: jest.fn(),
        buildArweaveGatewayUrl: jest.fn(),
      }),
      urls: () => urls,
    });

    expect(ports.normalizeArweaveUrl('ar://abc', { contextLabel: 'session_header_image' }))
      .toBe('https://first.gateway/tx');

    urls = secondUrls;

    expect(ports.normalizeArweaveUrl('ar://def', { gateway: 'https://ar.example' }))
      .toBe('https://second.gateway/tx');
    expect(firstUrls.normalizeArweaveUrl).toHaveBeenCalledWith(
      'ar://abc',
      { contextLabel: 'session_header_image' }
    );
    expect(secondUrls.normalizeArweaveUrl).toHaveBeenCalledWith(
      'ar://def',
      { gateway: 'https://ar.example' }
    );
  });

  it('propagates Arweave upload failures unchanged', async () => {
    const failure = new Error('upload failed');
    const ports = bindAdminArweavePorts({
      scripts: () => ({
        readArweaveWalletBalance: jest.fn(),
        formatWinstonToAr: jest.fn(),
        uploadDataToArweave: jest.fn(async () => {
          throw failure;
        }),
        buildArweaveGatewayUrl: jest.fn(),
      }),
      urls: () => ({ normalizeArweaveUrl: jest.fn() }),
    });

    await expect(ports.uploadDataToArweave({ type: 'admin-test' }, 'json'))
      .rejects.toBe(failure);
  });
});
