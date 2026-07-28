const fs = require('fs');
const path = require('path');

const readClientPackageJson = () => {
  const packageJsonPath = path.resolve(__dirname, '../../../package.json');
  return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
};

const readRootJson = (relativePath) => {
  const filePath = path.resolve(__dirname, '../../../..', relativePath);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
};

const readClientFile = (relativePath) => {
  const filePath = path.resolve(__dirname, '../../..', relativePath);
  return fs.readFileSync(filePath, 'utf8');
};

const readClientJestConfig = () => require(path.resolve(__dirname, '../../../jest.config.cjs'));

const expectedLintCommand = 'eslint --no-error-on-unmatched-pattern "src/**/*.{js,jsx,mjs,cjs,ts,tsx}"';

describe('client package modernization contract', () => {
  it('keeps canonical commands on the Vite and standalone Jest paths', () => {
    const pkg = readClientPackageJson();

    expect(pkg.scripts.dev).toBe('PUBLIC_URL=/ vite --host 0.0.0.0 --port 3000');
    expect(pkg.scripts.build).toBe('PUBLIC_URL=/ vite build');
    expect(pkg.scripts.preview).toBe('vite preview --host 0.0.0.0');
    expect(pkg.scripts.start).toBe('npm run preview');
    expect(pkg.scripts.test).toBe('jest');
  });

  it('makes bundle analysis use the local Vite reporter without publishing sourcemaps', () => {
    const pkg = readClientPackageJson();
    const eslintConfig = readClientFile('.eslintrc.json');

    expect(pkg.scripts.build).not.toContain('sourcemap');
    expect(pkg.scripts.analyze).toBe('CE_BUNDLE_REPORT=1 npm run build');
    expect(pkg.scripts.analyze).not.toContain('source-map-explorer');
    expect(pkg.scripts.analyze).not.toContain('sourcemap');
  });

  it('keeps legacy Vite aliases and CRA fallback scripts removed from the client package contract', () => {
    const pkg = readClientPackageJson();
    const eslintConfig = readClientFile('eslint.config.mjs');

    expect(pkg.scripts['dev:vite']).toBeUndefined();
    expect(pkg.scripts['build:vite']).toBeUndefined();
    expect(pkg.scripts['prebuild:vite']).toBeUndefined();
    expect(pkg.scripts['preview:vite']).toBeUndefined();
    expect(pkg.scripts['dev:cra']).toBeUndefined();
    expect(pkg.scripts['build:cra']).toBeUndefined();
    expect(pkg.scripts.eject).toBeUndefined();
    expect(pkg.scripts.start).toBe('npm run preview');
    expect(eslintConfig).not.toContain('react-app');
    expect(eslintConfig).toContain("const typedGateComponentFiles = ['src/components/Gates/**/*.{ts,tsx}']");
    expect(eslintConfig).toContain(
      "const typedCommunityTabComponentFiles = ['src/components/CommunityTab/**/*.{ts,tsx}']",
    );
    expect(eslintConfig).toContain(
      "const typedPolisReportComponentFiles = ['src/components/PolisReport/**/*.{ts,tsx}']",
    );
    expect(eslintConfig).toContain("const typedDebateMapComponentFiles = ['src/components/DebateMap/**/*.{ts,tsx}']");
    expect(eslintConfig).toContain("const typedNavbarComponentFiles = ['src/components/Navbar/**/*.{ts,tsx}']");
    expect(eslintConfig).toContain(
      "const typedContractPageComponentFiles = ['src/components/ContractPage/**/*.{ts,tsx}']",
    );
    expect(eslintConfig).toContain(
      "const typedOnePageSessionComponentFiles = ['src/components/OnePageSession/**/*.{ts,tsx}']",
    );
    expect(eslintConfig).toContain("const typedTagPageComponentFiles = ['src/components/TagPage/**/*.{ts,tsx}']");
    expect(eslintConfig).toContain(
      "const typedDocumentLibraryComponentFiles = ['src/components/DocumentLibrary/**/*.{ts,tsx}']",
    );
    expect(eslintConfig).toContain("const typedDemoViewsComponentFiles = ['src/components/DemoViews/**/*.{ts,tsx}']");
    expect(eslintConfig).toContain("const typedAccountComponentFiles = ['src/components/Account/**/*.{ts,tsx}']");
    expect(eslintConfig).toContain("const typedAdminComponentFiles = ['src/components/Admin/**/*.{ts,tsx}']");
    expect(eslintConfig).toContain("const typedMainSiteComponentFiles = ['src/components/MainSite/**/*.{ts,tsx}']");
    expect(eslintConfig).toContain("const typedUserPageComponentFiles = ['src/components/UserPage/**/*.{ts,tsx}']");
    expect(eslintConfig).toContain("const typedSessionsComponentFiles = ['src/components/Sessions/**/*.{ts,tsx}']");
    expect(eslintConfig).toContain("const typedSbtComponentFiles = ['src/components/SBTs/**/*.{ts,tsx}']");
    expect(eslintConfig).toContain("const typedSurveyToolComponentFiles = ['src/components/SurveyTool/**/*.{ts,tsx}']");
  });

  it('keeps web3-sensitive dependencies pinned during modernization', () => {
    const pkg = readClientPackageJson();

    expect(pkg.dependencies.ethers).toBe('5.7.2');
    expect(pkg.devDependencies['react-scripts']).toBeUndefined();
    expect(pkg.devDependencies.webpack).toBeUndefined();
    expect(pkg.overrides.webpack).toBeUndefined();
  });

  it('keeps the client coverage floor pinned to the measured ratchet baseline', () => {
    const jestConfig = readClientJestConfig();
    const coverageBaseline = readRootJson('scripts/coverage-baseline.json');

    expect(jestConfig.coverageThreshold).toEqual({
      global: coverageBaseline.global,
    });
  });

  it('keeps stale dependency overrides out of the client package contract', () => {
    const pkg = readClientPackageJson();

    expect(pkg.overrides['@solana/web3.js']).toBeUndefined();
  });

  it('keeps Vite tooling scoped to development dependencies', () => {
    const pkg = readClientPackageJson();
    const vitePackages = ['@vitejs/plugin-react', 'vite'];

    vitePackages.forEach((name) => {
      expect(pkg.dependencies[name]).toBeUndefined();
      expect(pkg.devDependencies[name]).toBeDefined();
    });
  });

  it('keeps Vite output and entry wiring canonical', () => {
    const viteConfig = readClientFile('vite.config.mjs');
    const viteIndex = readClientFile('index.html');

    expect(viteConfig).toContain("outDir: path.resolve(__dirname, 'build')");
    expect(viteConfig).toContain("manifest: 'vite-bundle-manifest.json'");
    expect(viteConfig).not.toContain("outDir: path.resolve(__dirname, 'build-vite')");
    expect(viteConfig).not.toContain('copyStaticImageAssetsPlugin');
    expect(viteConfig).not.toContain('ce-copy-static-image-assets');
    expect(viteConfig).not.toContain('ce-raw-loader-compatibility');
    expect(viteConfig).not.toContain('!!raw-loader!');
    expect(viteIndex).toContain('__PUBLIC_URL__');
    expect(viteIndex).toContain('/src/viteEntry.ts');
    expect(viteIndex).toContain('https://contextengine.sh/assets/img/context-engine-social-preview-square.png');
    expect(
      fs.existsSync(path.resolve(__dirname, '../../../public/assets/img/context-engine-social-preview-square.png')),
    ).toBe(true);
    expect(viteEntry).toContain("import 'assets/css/contextEngine.scss';");
    expect(viteEntry).toContain("import('./index.js')");
    expect(appEntry).not.toContain("import 'assets/css/contextEngine.scss';");
    expect(legacyOutputCleaner).toContain("const legacyOutputDirs = ['build-vite', 'vite-build']");
    expect(legacyOutputCleaner).toContain('fs.rmSync(targetDir, { recursive: true, force: true })');
    expect(contractSourceLoader).toContain('.sol?raw');
    expect(contractSourceLoader).not.toContain('!!raw-loader!');
  });

  it('keeps Vite vendor chunk policy explicit', () => {
    const viteConfig = readClientFile('vite.config.mjs');
    const expectedVendorChunks = [
      'vendor-react',
      'vendor-ethers',
      'vendor-wallet-core',
      'vendor-wallet-connectors',
      'vendor-lit',
      'vendor-arweave',
      'vendor-visualization',
      'vendor-canvas',
      'vendor-crypto-core',
      'vendor-crypto-zk-poseidon',
      'vendor-media-canvas-export',
      'vendor-media-pdf',
      'vendor-media-audio',
      'vendor-ui',
      'vendor-polyfills',
      'vendor-misc',
    ];

    expect(viteConfig).toContain('export const resolveManualChunk');
    expect(viteConfig).toContain('manualChunks: resolveManualChunk');
    expectedVendorChunks.forEach((chunkName) => {
      expect(viteConfig).toContain(chunkName);
    });
    expect(viteConfig).not.toContain('vendor-crypto-zk-poseidon-low');
    expect(viteConfig).not.toContain('vendor-crypto-zk-poseidon-high');
    expect(viteConfig).not.toContain("'/node_modules/poseidon-lite/constants/1.js'");
    expect(viteConfig).not.toContain("'/node_modules/poseidon-lite/constants/4.js'");
    expect(viteConfig).not.toContain("'/node_modules/poseidon-lite/constants/16.js'");
    expect(viteConfig).not.toContain('vendor-lit');
    expect(viteConfig).toContain("'/node_modules/hash.js/'");
    expect(viteConfig).toContain("'/node_modules/inherits/'");
    expect(viteConfig).toContain("'/node_modules/minimalistic-assert/'");
  });

  it('loads only the Poseidon arities used by survey commitments', () => {
    const runtimeMethods = readClientFile('src/components/SurveyTool/surveyQuestionsRuntimeMethods.tsx');
    const poseidonAdapter = readClientFile('src/utilities/crypto/poseidonHasher.ts');

    expect(runtimeMethods).toContain("import { loadPoseidonHasher } from '../../utilities/crypto/poseidonHasher.js'");
    expect(runtimeMethods).toContain('const poseidonHasher = await loadPoseidonHasher()');
    expect(runtimeMethods).not.toContain("import('poseidon-lite')");
    expect(runtimeMethods).not.toMatch(/\{\s*poseidon\s*\}/);
    expect(poseidonAdapter).toContain("import('poseidon-lite/poseidon2')");
    expect(poseidonAdapter).toContain("import('poseidon-lite/poseidon3')");
    expect(poseidonAdapter).not.toMatch(/poseidon(?:1|[4-9]|1[0-6])['"]/);
  });

  it('keeps the default passkey-only wallet profile and its bundle verifier wired', () => {
    const pkg = readClientPackageJson();
    const viteConfig = readClientFile('vite.config.mjs');

    expect(pkg.scripts['verify:passkey-only-bundle']).toBe('node scripts/verify-passkey-only-bundle.mjs');
    expect(viteConfig).toContain('REACT_APP_CE_ENABLE_METAMASK_CONNECTOR');
    expect(viteConfig).toContain("'walletConnectorProfile.ts'");
    expect(viteConfig).toContain("'walletConnectorProfile.metamask.ts'");
    expect(viteConfig).toContain("fileName: 'ce-wallet-profile.json'");
    expect(viteConfig).toContain('findPasskeyOnlyForbiddenModules(moduleIds)');
    expect(viteConfig).not.toContain('metamask_icon_white.png');
  });

  it('keeps Vite browser polyfill dependencies limited to imported runtime shims', () => {
    const pkg = readClientPackageJson();
    const viteConfig = readClientFile('vite.config.mjs');
    const retainedBrowserShims = ['buffer', 'process'];
    const staleBrowserPolyfills = [
      'assert',
      'crypto-browserify',
      'https-browserify',
      'os-browserify',
      'stream-browserify',
      'stream-http',
      'url',
    ];

    retainedBrowserShims.forEach((name) => {
      expect(pkg.dependencies[name]).toBeUndefined();
      expect(pkg.devDependencies[name]).toBeDefined();
      expect(viteConfig).toContain(`/node_modules/${name}/`);
    });
    expect(viteConfig).toContain("include: ['buffer', 'process/browser']");

    staleBrowserPolyfills.forEach((name) => {
      expect(pkg.dependencies[name]).toBeUndefined();
      expect(pkg.devDependencies[name]).toBeUndefined();
      expect(viteConfig).not.toContain(`/node_modules/${name}/`);
    });
  });

  it('keeps standalone Jest on explicit Babel and jsdom setup', () => {
    const pkg = readClientPackageJson();
    const jestConfig = readClientFile('jest.config.cjs');
    const jsdomPolyfills = readClientFile('scripts/jest/jsdomPolyfills.js');

    expect(pkg.babel.presets).toEqual([
      [
        '@babel/preset-env',
        {
          targets: {
            node: 'current',
          },
        },
      ],
      [
        '@babel/preset-react',
        {
          runtime: 'automatic',
        },
      ],
      '@babel/preset-typescript',
    ]);
    expect(jestConfig).toContain("modules: 'commonjs'");
    expect(jestConfig).toContain('@babel/preset-typescript');
    expect(jestConfig).toContain('scripts/jest/jsdomPolyfills.js');
    expect(jestConfig).not.toContain('react-app-polyfill');
    expect(jsdomPolyfills).toContain("require('node-fetch')");
    expect(jsdomPolyfills).toContain('class JestResponse');
    expect(jsdomPolyfills).toContain('FileReader');
    expect(jsdomPolyfills).toContain('process.env.PUBLIC_URL');
  });

  it('keeps Vite browser-loaded compatibility shims free of runtime require calls', () => {
    [
      'src/components/DebateMap/DebateMap.tsx',
      'src/components/SurveyTool/CreateQuestionsAndSurveys.tsx',
      'src/components/ContractPage/contractSourceLoader.ts',
      'src/utilities/web3/contractScripts.ts',
    ].forEach((relativePath) => {
      expect(readClientFile(relativePath)).not.toMatch(/\brequire\(/);
    });
  });

  it('keeps build, test, lint, and analysis tools out of production dependencies', () => {
    const pkg = readClientPackageJson();
    const devOnlyPackages = [
      '@babel/core',
      '@babel/preset-env',
      '@babel/preset-react',
      '@babel/preset-typescript',
      '@typescript-eslint/parser',
      'babel-jest',
      'eslint',
      'eslint-plugin-react',
      'eslint-plugin-react-hooks',
      'sass',
      'vite',
    ];

    devOnlyPackages.forEach((name) => {
      expect(pkg.dependencies[name]).toBeUndefined();
      expect(pkg.devDependencies[name]).toBeDefined();
    });

    ['serve', 'source-map-explorer'].forEach((name) => {
      expect(pkg.dependencies[name]).toBeUndefined();
      expect(pkg.devDependencies[name]).toBeUndefined();
    });
  });

  it('keeps verified-unused packages out of the direct client dependency contract', () => {
    const pkg = readClientPackageJson();
    const removedDirectPackages = [
      '@babel/runtime',
      '@dnd-kit/core',
      '@dnd-kit/sortable',
      '@metamask/eth-sig-util',
      '@noble/secp256k1',
      'd3-scale',
      'react-router',
      'zod',
    ];

    removedDirectPackages.forEach((name) => {
      expect(pkg.dependencies[name]).toBeUndefined();
      expect(pkg.devDependencies[name]).toBeUndefined();
    });
  });

  it('keeps unused lint plugin wiring out of the ESLint contract', () => {
    const pkg = readClientPackageJson();
    const eslintConfig = readClientFile('eslint.config.mjs');

    expect(pkg.devDependencies['eslint-plugin-prettier']).toBeUndefined();
    expect(pkg.devDependencies['@typescript-eslint/eslint-plugin']).toBeUndefined();
    expect(pkg.devDependencies['eslint-plugin-import']).toBeUndefined();
    expect(eslintConfig).toContain("import js from '@eslint/js'");
    expect(eslintConfig).toContain("import tsParser from '@typescript-eslint/parser'");
    expect(eslintConfig).toContain("import reactHooksPlugin from 'eslint-plugin-react-hooks'");
    expect(eslintConfig).toContain("const javascriptFiles = ['src/**/*.{js,jsx,mjs,cjs}']");
    expect(eslintConfig).toContain("const typedFiles = ['src/**/*.{ts,tsx}']");
    expect(eslintConfig).toContain("const typedReactFiles = ['src/**/*.tsx']");
    expect(eslintConfig).toContain('files: typedFiles');
    expect(eslintConfig).toContain('files: typedReactFiles');
    expect(eslintConfig).toContain("reportUnusedDisableDirectives: 'error'");
    expect(eslintConfig).toContain("const typedUiUtilityFiles = ['src/utilities/ui/**/*.{ts,tsx}']");
    expect(eslintConfig).toContain("const typedSharedComponentFiles = ['src/components/Shared/**/*.{ts,tsx}']");
    expect(eslintConfig).toContain('const typedInformationalComponentFiles = [');
    expect(eslintConfig).toContain("'src/components/About/**/*.{ts,tsx}'");
    expect(eslintConfig).toContain("'src/components/Footer/**/*.{ts,tsx}'");
    expect(eslintConfig).toContain("'src/components/InformationModals/**/*.{ts,tsx}'");
    expect(eslintConfig).toContain("'src/components/Onboarding/**/*.{ts,tsx}'");
    expect(eslintConfig).toContain(
      "const typedMainContentComponentFiles = ['src/components/MainContent/**/*.{ts,tsx}']",
    );
    expect(eslintConfig).toContain('const typedAuxiliaryPageComponentFiles = [');
    expect(eslintConfig).toContain("'src/components/Agent/**/*.{ts,tsx}'");
    expect(eslintConfig).toContain("'src/components/Bookmarks/**/*.{ts,tsx}'");
    expect(eslintConfig).toContain("'src/components/Sponsor/**/*.{ts,tsx}'");
    expect(eslintConfig).toContain('const typedShellSupportComponentFiles = [');
    expect(eslintConfig).toContain("'src/components/ErrorBoundary/**/*.{ts,tsx}'");
    expect(eslintConfig).toContain("'src/components/RightSidebar/**/*.{ts,tsx}'");
    expect(eslintConfig).toContain("const typedDevSupportComponentFiles = ['src/components/E2E/**/*.{ts,tsx}']");
    expect(eslintConfig).toContain("const typedGateComponentFiles = ['src/components/Gates/**/*.{ts,tsx}']");
    expect(eslintConfig).toContain(
      "const typedCommunityTabComponentFiles = ['src/components/CommunityTab/**/*.{ts,tsx}']",
    );
    expect(eslintConfig).toContain(
      "const typedPolisReportComponentFiles = ['src/components/PolisReport/**/*.{ts,tsx}']",
    );
    expect(eslintConfig).toContain("const typedDebateMapComponentFiles = ['src/components/DebateMap/**/*.{ts,tsx}']");
    expect(eslintConfig).toContain("const typedNavbarComponentFiles = ['src/components/Navbar/**/*.{ts,tsx}']");
    expect(eslintConfig).toContain(
      "const typedContractPageComponentFiles = ['src/components/ContractPage/**/*.{ts,tsx}']",
    );
    expect(eslintConfig).toContain("'react-hooks': reactHooksPlugin");
    expect(eslintConfig).not.toContain("import importPlugin from 'eslint-plugin-import'");
    expect(eslintConfig).not.toContain("import prettierPlugin from 'eslint-plugin-prettier'");
    expect(eslintConfig).not.toContain('@typescript-eslint/no-unused-vars');
    expect(eslintConfig).not.toContain('prettier/prettier');
  });

  it('keeps stale webpack and CRA packages out of the client package contract', () => {
    const pkg = readClientPackageJson();
    const staleLoaders = [
      'babel-eslint',
      'babel-preset-react-app',
      'copy-webpack-plugin',
      'file-loader',
      'node-polyfill-webpack-plugin',
      'raw-loader',
      'react-app-polyfill',
      'react-app-rewired',
      'react-scripts',
      'sass-loader',
      'source-map-loader',
      'webpack',
      'worker-loader',
    ];

    staleLoaders.forEach((name) => {
      expect(pkg.dependencies[name]).toBeUndefined();
      expect(pkg.devDependencies[name]).toBeUndefined();
    });
  });
});
