import { ethers } from 'ethers';

import {
  ADMIN_ACTION_DOMAIN,
  ADMIN_ACTION_TYPES,
  buildAdminActionBodyHash,
  buildAdminActionTypedData,
} from './adminTypedData.mjs';

describe('adminTypedData', () => {
  it('builds typed data with trimmed fields and numeric expiration', () => {
    expect(
      buildAdminActionTypedData({
        action: ' set-config ',
        slug: ' edge ',
        bodyHash: ' 0xabc ',
        nonce: ' nonce-1 ',
        audience: ' https://contextengine.xyz ',
        expiration: '123',
      }),
    ).toEqual({
      domain: ADMIN_ACTION_DOMAIN,
      primaryType: 'AdminAction',
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
        ],
        ...ADMIN_ACTION_TYPES,
      },
      message: {
        action: 'set-config',
        slug: 'edge',
        bodyHash: '0xabc',
        nonce: 'nonce-1',
        audience: 'https://contextengine.xyz',
        expiration: 123,
      },
    });
  });

  it('hashes the unsigned body payload and ignores auth wrapper fields', () => {
    const unsignedBody = {
      slug: 'edge',
      config: {
        allowOrigins: ['https://contextengine.xyz'],
      },
    };
    const wrappedBody = {
      ...unsignedBody,
      address: '0x0000000000000000000000000000000000000001',
      signature: '0xsig',
      action: 'set-config',
      bodyHash: '0xold',
      nonce: 'nonce-1',
      audience: 'https://contextengine.xyz',
      expiration: 123,
    };

    const expectedUnsignedPayload = {
      config: {
        allowOrigins: ['https://contextengine.xyz'],
      },
    };
    const expectedHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(JSON.stringify(expectedUnsignedPayload)));

    expect(buildAdminActionBodyHash(unsignedBody)).toBe(expectedHash);
    expect(buildAdminActionBodyHash(wrappedBody)).toBe(expectedHash);
  });
});
