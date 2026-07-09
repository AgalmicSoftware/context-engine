import { bindSbtSelectorRuntimePorts, isEnsureLightSbtUniverse } from './sbtSelectorRuntimePorts';

describe('sbtSelectorRuntimePorts', () => {
  it('binds selector runtime ports through call-time getters', async () => {
    const logger = { log: jest.fn(), warn: jest.fn() };
    let hydrateSbtDisplayNameTargeted = jest.fn().mockResolvedValue({ name: 'first' });
    let warmSbtDisplayNamesTargeted = jest.fn().mockResolvedValue([{ name: 'warm' }]);
    let resolveSbtDisplayLabel = jest.fn().mockReturnValue('first label');
    let writeCache = jest.fn().mockResolvedValue(null);
    let contractScripts = { getAllSbtAddressesCached: jest.fn().mockResolvedValue(['0x1']) };

    const ports = bindSbtSelectorRuntimePorts({
      contractScripts: () => contractScripts,
      hydrateSbtDisplayNameTargeted: () => hydrateSbtDisplayNameTargeted,
      logger: () => logger,
      resolveSbtDisplayLabel: () => resolveSbtDisplayLabel,
      warmSbtDisplayNamesTargeted: () => warmSbtDisplayNamesTargeted,
      writeCache: () => writeCache,
    });

    expect(ports.logger).toBe(logger);
    await expect(ports.hydrateSbtDisplayNameTargeted({ address: '0x1' })).resolves.toEqual({ name: 'first' });
    await expect(ports.warmSbtDisplayNamesTargeted({ addresses: ['0x1'] })).resolves.toEqual([{ name: 'warm' }]);
    expect(ports.resolveSbtDisplayLabel({ address: '0x1' })).toBe('first label');
    await expect(ports.writeCache('sbtCache', 'alpha', { ok: true })).resolves.toBeNull();
    await expect(ports.contractScripts.getAllSbtAddressesCached('none', { slug: 'alpha' })).resolves.toEqual(['0x1']);
    expect(hydrateSbtDisplayNameTargeted).toHaveBeenCalledWith({ address: '0x1' });
    expect(writeCache).toHaveBeenCalledWith('sbtCache', 'alpha', { ok: true });

    hydrateSbtDisplayNameTargeted = jest.fn().mockResolvedValue({ name: 'second' });
    writeCache = jest.fn().mockResolvedValue('next');
    contractScripts = { getAllSbtAddressesCached: jest.fn().mockResolvedValue(['0x2']) };

    await expect(ports.hydrateSbtDisplayNameTargeted({ address: '0x2' })).resolves.toEqual({ name: 'second' });
    await expect(ports.writeCache('sbtCache', 'beta', { ok: false })).resolves.toBe('next');
    await expect(ports.contractScripts.getAllSbtAddressesCached('none', { slug: 'beta' })).resolves.toEqual(['0x2']);
    expect(writeCache).toHaveBeenCalledWith('sbtCache', 'beta', { ok: false });
  });

  it('recognizes the optional shared light-universe callback boundary', () => {
    expect(isEnsureLightSbtUniverse(() => null)).toBe(true);
    expect(isEnsureLightSbtUniverse(null)).toBe(false);
    expect(isEnsureLightSbtUniverse({ run: jest.fn() })).toBe(false);
  });
});
