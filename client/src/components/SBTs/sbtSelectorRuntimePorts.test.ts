import {
  bindSbtSelectorRuntimePorts,
  isEnsureLightSbtUniverse,
} from './sbtSelectorRuntimePorts';

describe('sbtSelectorRuntimePorts', () => {
  it('binds selector runtime ports without wrapping call targets', () => {
    const logger = { log: jest.fn(), warn: jest.fn() };
    const hydrateSbtDisplayNameTargeted = jest.fn();
    const warmSbtDisplayNamesTargeted = jest.fn();
    const resolveSbtDisplayLabel = jest.fn();
    const writeCache = jest.fn();
    const contractScripts = { getAllSbtAddressesCached: jest.fn() };

    const ports = bindSbtSelectorRuntimePorts({
      contractScripts,
      hydrateSbtDisplayNameTargeted,
      logger,
      resolveSbtDisplayLabel,
      warmSbtDisplayNamesTargeted,
      writeCache,
    });

    expect(ports.logger).toBe(logger);
    expect(ports.hydrateSbtDisplayNameTargeted).toBe(hydrateSbtDisplayNameTargeted);
    expect(ports.warmSbtDisplayNamesTargeted).toBe(warmSbtDisplayNamesTargeted);
    expect(ports.resolveSbtDisplayLabel).toBe(resolveSbtDisplayLabel);
    expect(ports.writeCache).toBe(writeCache);
    expect(ports.contractScripts).toBe(contractScripts);
  });

  it('recognizes the optional shared light-universe callback boundary', () => {
    expect(isEnsureLightSbtUniverse(() => null)).toBe(true);
    expect(isEnsureLightSbtUniverse(null)).toBe(false);
    expect(isEnsureLightSbtUniverse({ run: jest.fn() })).toBe(false);
  });
});
