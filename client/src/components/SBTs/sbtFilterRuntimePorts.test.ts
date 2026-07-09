import { bindSbtFilterRuntimePorts } from './sbtFilterRuntimePorts';

describe('sbtFilterRuntimePorts', () => {
  it('binds filter runtime ports through call-time getters', async () => {
    let writeCache = jest.fn().mockResolvedValue(null);
    let contractScripts = { getSbtMintBurnCountsByAddress: jest.fn().mockResolvedValue({ ok: true }) };

    const ports = bindSbtFilterRuntimePorts({
      contractScripts: () => contractScripts,
      writeCache: () => writeCache,
    });

    await expect(ports.writeCache('sbtCache', 'alpha', { ok: true })).resolves.toBeNull();
    await expect(ports.contractScripts.getSbtMintBurnCountsByAddress('none', '0x1')).resolves.toEqual({ ok: true });
    expect(writeCache).toHaveBeenCalledWith('sbtCache', 'alpha', { ok: true });
    expect(contractScripts.getSbtMintBurnCountsByAddress).toHaveBeenCalledWith('none', '0x1');

    writeCache = jest.fn().mockResolvedValue('next');
    contractScripts = { getSbtMintBurnCountsByAddress: jest.fn().mockResolvedValue({ ok: false }) };

    await expect(ports.writeCache('sbtCache', 'beta', { ok: false })).resolves.toBe('next');
    await expect(ports.contractScripts.getSbtMintBurnCountsByAddress('none', '0x2')).resolves.toEqual({ ok: false });
    expect(writeCache).toHaveBeenCalledWith('sbtCache', 'beta', { ok: false });
    expect(contractScripts.getSbtMintBurnCountsByAddress).toHaveBeenCalledWith('none', '0x2');
  });
});
