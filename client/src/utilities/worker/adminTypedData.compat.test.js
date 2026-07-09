describe('adminTypedData compat import shapes', () => {
  afterEach(() => {
    jest.resetModules();
    jest.dontMock('ethers');
  });

  it('hashes admin action bodies when ethers is exposed through a default-wrapped compat shape', () => {
    jest.resetModules();
    jest.doMock('ethers', () => {
      const actual = jest.requireActual('ethers');
      const compat = actual?.ethers || actual;
      return {
        __esModule: true,
        default: {
          ethers: compat,
        },
      };
    });

    const actual = jest.requireActual('ethers');
    const compat = actual?.ethers || actual;
    const { buildAdminActionBodyHash } = require('./adminTypedData.mjs');
    const unsignedBody = {
      slug: 'edge',
      config: {
        allowOrigins: ['https://contextengine.xyz'],
      },
    };

    expect(buildAdminActionBodyHash(unsignedBody)).toBe(
      compat.utils.keccak256(
        compat.utils.toUtf8Bytes(
          JSON.stringify({
            config: {
              allowOrigins: ['https://contextengine.xyz'],
            },
          }),
        ),
      ),
    );
  });

  it('hashes admin action bodies when ethers exposes hashing primitives at the top level without utils', () => {
    jest.resetModules();
    jest.doMock('ethers', () => {
      const actual = jest.requireActual('ethers');
      const compat = actual?.ethers || actual;
      return {
        __esModule: true,
        keccak256: compat.utils.keccak256,
        toUtf8Bytes: compat.utils.toUtf8Bytes,
        default: {
          keccak256: compat.utils.keccak256,
          toUtf8Bytes: compat.utils.toUtf8Bytes,
        },
      };
    });

    const actual = jest.requireActual('ethers');
    const compat = actual?.ethers || actual;
    const { buildAdminActionBodyHash } = require('./adminTypedData.mjs');
    const unsignedBody = {
      slug: 'edge',
      config: {
        allowOrigins: ['https://contextengine.xyz'],
      },
    };

    expect(buildAdminActionBodyHash(unsignedBody)).toBe(
      compat.utils.keccak256(
        compat.utils.toUtf8Bytes(
          JSON.stringify({
            config: {
              allowOrigins: ['https://contextengine.xyz'],
            },
          }),
        ),
      ),
    );
  });
});
