import {
  bindSbtFilterRuntimePorts,
} from './sbtFilterRuntimePorts';

describe('sbtFilterRuntimePorts', () => {
  it('binds filter runtime ports without wrapping call targets', () => {
    const writeCache = jest.fn();
    const contractScripts = { getSbtMintBurnCountsByAddress: jest.fn() };

    const ports = bindSbtFilterRuntimePorts({
      contractScripts,
      writeCache,
    });

    expect(ports.writeCache).toBe(writeCache);
    expect(ports.contractScripts).toBe(contractScripts);
  });
});
