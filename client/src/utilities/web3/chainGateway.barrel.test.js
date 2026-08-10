import contractScripts, { getReadProviderForGroup, getSessionConfigBySlug } from './contractScripts.js';
import * as contractScriptsModule from './contractScripts.js';
import chainGateway, {
  getReadProviderForGroup as getReadProviderForGroupGateway,
  getSessionConfigBySlug as getSessionConfigBySlugGateway,
} from './chainGateway.js';
import * as chainGatewayModule from './chainGateway.js';
import chainGatewayImpl, {
  getReadProviderForGroup as getReadProviderForGroupImpl,
  getSessionConfigBySlug as getSessionConfigBySlugImpl,
} from './contractScripts.impl.js';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

describe('contractScripts compatibility barrel', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps the legacy js entrypoint spyable for Jest callers', () => {
    const mocked = { slug: 'mock-session' };
    const spy = jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockReturnValue(mocked);

    expect(contractScriptsModule.getSessionConfigBySlug('ignored')).toBe(mocked);
    expect(spy).toHaveBeenCalledWith('ignored');
  });

  it('keeps the canonical chainGateway entrypoint spyable for Jest callers', () => {
    const mocked = { slug: 'gateway-session' };
    const spy = jest.spyOn(chainGatewayModule, 'getSessionConfigBySlug').mockReturnValue(mocked);

    expect(chainGatewayModule.getSessionConfigBySlug('ignored')).toBe(mocked);
    expect(spy).toHaveBeenCalledWith('ignored');
  });

  it('re-exports the implementation default and named helpers unchanged', () => {
    expect(chainGateway).toBe(chainGatewayImpl);
    expect(getSessionConfigBySlug).toBe(getSessionConfigBySlugImpl);
    expect(getReadProviderForGroup).toBe(getReadProviderForGroupImpl);

    expect(typeof chainGateway.getLatestBlockNumber).toBe('function');
    expect(typeof chainGateway.listenForSurveyEvents).toBe('function');
    expect(typeof chainGateway.getUserActivity).toBe('function');
  });

  it('exposes only the canonical native balance reader', () => {
    expect(chainGatewayModule.getNativeBalance).toBe(chainGatewayImpl.getNativeBalance);
    expect(chainGatewayModule).not.toHaveProperty('getETHBalance');
    expect(chainGateway).not.toHaveProperty('getETHBalance');
  });

  it('can load through a browser-targeted Vite bundle without CommonJS exports', () => {
    const clientRoot = path.resolve(__dirname, '../../..');
    const tmpDir = fs.mkdtempSync(path.join(clientRoot, '.tmp-contract-scripts-barrel-'));
    const outputDir = path.join(tmpDir, 'dist');
    const entryPath = path.join(tmpDir, 'entry.js');
    const implStubPath = path.join(tmpDir, 'contractScripts.impl.stub.js');
    const viteConfigPath = path.join(tmpDir, 'vite.config.mjs');
    const viteBinPath = path.join(clientRoot, 'node_modules/vite/bin/vite.js');
    const barrelPath = path.resolve(__dirname, 'contractScripts.ts');

    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(
      implStubPath,
      `
      const contractScripts = {
        marker: 'stub-default',
        getProviderLocation: () => 'stub-provider',
        getNativeBalance: () => '1',
        getLatestBlockNumber: () => 1,
        listenForSurveyEvents: () => {},
        getUserActivity: () => {},
      };

      export const normalizeSessionSlug = (slug) => slug;
      export const getDefaultSessionConfig = () => ({ slug: '' });
      export const getSessionConfigBySlug = (slug) => ({ slug });
      export const getDemoSessionConfigBySlug = (slug) => ({ slug });
      export const getSessionConfigBySlugOrDefault = (slug) => ({ slug });
      export const getAllSessionEntries = () => [];
      export const getAllSessionSlugs = () => [];
      export const getSessionConfigByName = (name) => ({ name });
      export const getSessionSlugByName = (name) => name;
      export const getSessionLists = () => ({});
      export const getSessionChainId = () => 1;
      export const getSessionNetwork = () => 'stubnet';
      export const getChainLabelById = () => 'Stubnet';
      export const getReadProviderForGroup = () => ({ provider: 'group' });
      export const getReadProviderForSession = () => ({ provider: 'session' });
      export const __test__contractScriptsArweaveCache = {};
      export const __test__contractScriptsArweaveUploads = {};
      export const __test__contractScriptsSessionNameFields = {};
      export const __test__contractScriptsSbtMemo = {};
      export const __test__contractScriptsSbtProgress = {};
      export const __test__contractScriptsSbtHistory = {};
      export const __test__contractScriptsErrors = {
        isNonexistentTokenError: () => true,
      };
      export default contractScripts;
    `,
    );
    fs.writeFileSync(
      entryPath,
      `
      import contractScripts, {
        __test__contractScriptsErrors,
        getReadProviderForGroup,
        getSessionConfigBySlug,
      } from ${JSON.stringify(barrelPath)};

      window.__chainGatewayBarrelSmoke = {
        defaultMarker: chainGateway.marker,
        errorHelper: __test__contractScriptsErrors.isNonexistentTokenError(new Error('stub')),
        provider: getReadProviderForGroup().provider,
        slug: getSessionConfigBySlug('edge').slug,
      };
    `,
    );
    fs.writeFileSync(
      viteConfigPath,
      `
      export default {
        logLevel: 'silent',
        resolve: {
          alias: [
            {
              find: /^\\.\\/contractScripts\\.impl\\.js$/,
              replacement: ${JSON.stringify(implStubPath)},
            },
          ],
        },
        build: {
          target: 'es2020',
          outDir: ${JSON.stringify(outputDir)},
          emptyOutDir: true,
          write: true,
          rollupOptions: {
            input: ${JSON.stringify(entryPath)},
            output: {
              entryFileNames: 'bundle.js',
              format: 'iife',
              name: 'ContractScriptsBarrelSmoke',
              inlineDynamicImports: true,
            },
          },
        },
      };
    `,
    );

    try {
      try {
        execFileSync(process.execPath, [viteBinPath, 'build', '--config', viteConfigPath], {
          cwd: clientRoot,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        });
      } catch (error) {
        const stdout = error.stdout ? `\nstdout:\n${error.stdout}` : '';
        const stderr = error.stderr ? `\nstderr:\n${error.stderr}` : '';
        throw new Error(`Vite barrel smoke build failed.${stdout}${stderr}`);
      }

      const context = { console, window: {} };
      vm.runInNewContext(fs.readFileSync(path.join(outputDir, 'bundle.js'), 'utf8'), context);

      expect(context.window.__chainGatewayBarrelSmoke).toEqual({
        defaultMarker: 'stub-default',
        errorHelper: true,
        provider: 'group',
        slug: 'edge',
      });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }, 30000);
});
