import contractScripts, {
  getReadProviderForGroup,
  getSessionConfigBySlug,
} from './contractScripts.js';
import * as contractScriptsModule from './contractScripts.js';
import contractScriptsImpl, {
  getReadProviderForGroup as getReadProviderForGroupImpl,
  getSessionConfigBySlug as getSessionConfigBySlugImpl,
} from './contractScripts.impl.js';

const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const webpack = require('webpack');

const compileWebpack = (config) => new Promise((resolve, reject) => {
  webpack(config, (error, stats) => {
    if (error) {
      reject(error);
      return;
    }
    if (stats.hasErrors()) {
      reject(new Error(stats.toString({ all: false, errors: true, warnings: true })));
      return;
    }
    resolve(stats);
  });
});

describe('contractScripts compatibility barrel', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps the legacy js entrypoint spyable for Jest callers', () => {
    const mocked = { slug: 'mock-session' };
    const spy = jest
      .spyOn(contractScriptsModule, 'getSessionConfigBySlug')
      .mockReturnValue(mocked);

    expect(contractScriptsModule.getSessionConfigBySlug('ignored')).toBe(mocked);
    expect(spy).toHaveBeenCalledWith('ignored');
  });

  it('re-exports the implementation default and named helpers unchanged', () => {
    expect(contractScripts).toBe(contractScriptsImpl);
    expect(getSessionConfigBySlug).toBe(getSessionConfigBySlugImpl);
    expect(getReadProviderForGroup).toBe(getReadProviderForGroupImpl);

    expect(typeof contractScripts.getLatestBlockNumber).toBe('function');
    expect(typeof contractScripts.listenForSurveyEvents).toBe('function');
    expect(typeof contractScripts.getUserActivity).toBe('function');
  });

  it('can load through a browser-targeted Webpack bundle without CommonJS exports', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-contract-scripts-barrel-'));
    const outputDir = path.join(tmpDir, 'dist');
    const entryPath = path.join(tmpDir, 'entry.js');
    const implStubPath = path.join(tmpDir, 'contractScripts.impl.stub.js');
    const barrelPath = path.resolve(__dirname, 'contractScripts.ts');

    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(implStubPath, `
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
    `);
    fs.writeFileSync(entryPath, `
      import contractScripts, {
        __test__contractScriptsErrors,
        getReadProviderForGroup,
        getSessionConfigBySlug,
      } from ${JSON.stringify(barrelPath)};

      window.__contractScriptsBarrelSmoke = {
        defaultMarker: contractScripts.marker,
        errorHelper: __test__contractScriptsErrors.isNonexistentTokenError(new Error('stub')),
        provider: getReadProviderForGroup().provider,
        slug: getSessionConfigBySlug('edge').slug,
      };
    `);

    try {
      await compileWebpack({
        mode: 'development',
        target: 'web',
        devtool: false,
        entry: entryPath,
        output: {
          filename: 'bundle.js',
          hashFunction: 'sha256',
          path: outputDir,
        },
        resolve: {
          extensions: ['.ts', '.tsx', '.js', '.jsx'],
        },
        module: {
          rules: [
            {
              test: /\.(js|jsx|ts|tsx)$/,
              include: [tmpDir, path.resolve(__dirname)],
              use: {
                loader: require.resolve('babel-loader'),
                options: {
                  babelrc: false,
                  configFile: false,
                  envName: 'development',
                  presets: [require.resolve('babel-preset-react-app')],
                },
              },
            },
          ],
        },
        plugins: [
          new webpack.NormalModuleReplacementPlugin(
            /contractScripts\.impl\.js$/,
            implStubPath
          ),
        ],
      });

      const context = { console, window: {} };
      vm.runInNewContext(fs.readFileSync(path.join(outputDir, 'bundle.js'), 'utf8'), context);

      expect(context.window.__contractScriptsBarrelSmoke).toEqual({
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
