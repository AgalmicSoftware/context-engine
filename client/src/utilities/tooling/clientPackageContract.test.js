const fs = require('fs');
const path = require('path');

const readClientPackageJson = () => {
  const packageJsonPath = path.resolve(__dirname, '../../../package.json');
  return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
};

const readClientFile = (relativePath) => {
  const filePath = path.resolve(__dirname, '../../..', relativePath);
  return fs.readFileSync(filePath, 'utf8');
};

const expectedLintCommand = [
  'eslint src/',
  '"src/domains/**/*.{ts,tsx}"',
  '"src/utilities/session/**/*.{ts,tsx}"',
  '"src/utilities/worker/**/*.{ts,tsx}"',
  '"src/utilities/arweave/**/*.{ts,tsx}"',
  '"src/utilities/web3/**/*.{ts,tsx}"',
  '"src/utilities/cache/**/*.{ts,tsx}"',
  '"src/utilities/survey/**/*.{ts,tsx}"',
  '"src/utilities/sbt/**/*.{ts,tsx}"',
  '"src/utilities/user/**/*.{ts,tsx}"',
  '"src/utilities/sponsor/**/*.{ts,tsx}"',
  '"src/utilities/tags/**/*.{ts,tsx}"',
  '"src/utilities/contracts/**/*.{ts,tsx}"',
  '"src/utilities/shared/**/*.{ts,tsx}"',
  '"src/utilities/ui/**/*.{ts,tsx}"',
  '"src/components/Shared/**/*.{ts,tsx}"',
  '"src/components/About/**/*.{ts,tsx}"',
  '"src/components/Footer/**/*.{ts,tsx}"',
  '"src/components/InformationModals/**/*.{ts,tsx}"',
  '"src/components/Onboarding/**/*.{ts,tsx}"',
  '"src/components/MainContent/**/*.{ts,tsx}"',
  '"src/components/Agent/**/*.{ts,tsx}"',
  '"src/components/Bookmarks/**/*.{ts,tsx}"',
  '"src/components/Sponsor/**/*.{ts,tsx}"',
  '"src/components/ErrorBoundary/**/*.{ts,tsx}"',
  '"src/components/RightSidebar/**/*.{ts,tsx}"',
  '"src/components/E2E/**/*.{ts,tsx}"',
  '"src/components/Gates/**/*.{ts,tsx}"',
  '"src/components/CommunityTab/**/*.{ts,tsx}"',
  '"src/components/PolisReport/**/*.{ts,tsx}"',
  '"src/components/DebateMap/**/*.{ts,tsx}"',
  '"src/components/Navbar/**/*.{ts,tsx}"',
  '"src/components/ContractPage/**/*.{ts,tsx}"',
  '"src/components/OnePageSession/**/*.{ts,tsx}"',
  '"src/components/TagPage/**/*.{ts,tsx}"',
  '"src/components/DocumentLibrary/**/*.{ts,tsx}"',
  '"src/components/DemoViews/**/*.{ts,tsx}"',
].join(' ');

describe('client package modernization contract', () => {
  it('keeps canonical commands on the Vite and standalone Jest paths', () => {
    const pkg = readClientPackageJson();

    expect(pkg.scripts.dev).toBe('PUBLIC_URL=/ vite --host 0.0.0.0 --port 3000');
    expect(pkg.scripts.prebuild).toBe('node scripts/clean-legacy-vite-output.mjs');
    expect(pkg.scripts.build).toBe('PUBLIC_URL=/ vite build');
    expect(pkg.scripts['prebuild:vite']).toBe('node scripts/clean-legacy-vite-output.mjs');
    expect(pkg.scripts.start).toBe('serve -s build');
    expect(pkg.scripts.test).toBe('jest');
    expect(pkg.scripts.lint).toBe(expectedLintCommand);
  });

  it('keeps CRA fallback scripts removed from the client package contract', () => {
    const pkg = readClientPackageJson();
    const eslintConfig = readClientFile('eslint.config.mjs');

    expect(pkg.scripts['dev:vite']).toBe('PUBLIC_URL=/ vite --host 0.0.0.0 --port 3000');
    expect(pkg.scripts['build:vite']).toBe('PUBLIC_URL=/ vite build');
    expect(pkg.scripts['preview:vite']).toBe('vite preview --host 0.0.0.0');
    expect(pkg.scripts['dev:cra']).toBeUndefined();
    expect(pkg.scripts['build:cra']).toBeUndefined();
    expect(pkg.scripts.eject).toBeUndefined();
    expect(pkg.scripts.start).not.toContain('vite');
    expect(eslintConfig).not.toContain('react-app');
    expect(eslintConfig).toContain("const typedDomainFiles = ['src/domains/**/*.{ts,tsx}']");
    expect(eslintConfig).toContain("const typedSessionUtilityFiles = ['src/utilities/session/**/*.{ts,tsx}']");
    expect(eslintConfig).toContain("const typedWorkerUtilityFiles = ['src/utilities/worker/**/*.{ts,tsx}']");
    expect(eslintConfig).toContain("const typedArweaveUtilityFiles = ['src/utilities/arweave/**/*.{ts,tsx}']");
    expect(eslintConfig).toContain("const typedWeb3UtilityFiles = ['src/utilities/web3/**/*.{ts,tsx}']");
    expect(eslintConfig).toContain("const typedCacheUtilityFiles = ['src/utilities/cache/**/*.{ts,tsx}']");
    expect(eslintConfig).toContain("const typedSurveyUtilityFiles = ['src/utilities/survey/**/*.{ts,tsx}']");
    expect(eslintConfig).toContain("const typedSbtUtilityFiles = ['src/utilities/sbt/**/*.{ts,tsx}']");
    expect(eslintConfig).toContain("const typedUserUtilityFiles = ['src/utilities/user/**/*.{ts,tsx}']");
    expect(eslintConfig).toContain("const typedSponsorUtilityFiles = ['src/utilities/sponsor/**/*.{ts,tsx}']");
    expect(eslintConfig).toContain("const typedTagsUtilityFiles = ['src/utilities/tags/**/*.{ts,tsx}']");
    expect(eslintConfig).toContain("const typedContractsUtilityFiles = ['src/utilities/contracts/**/*.{ts,tsx}']");
    expect(eslintConfig).toContain("const typedSharedUtilityFiles = ['src/utilities/shared/**/*.{ts,tsx}']");
    expect(eslintConfig).toContain("const typedGateComponentFiles = ['src/components/Gates/**/*.{ts,tsx}']");
    expect(eslintConfig).toContain("const typedCommunityTabComponentFiles = ['src/components/CommunityTab/**/*.{ts,tsx}']");
    expect(eslintConfig).toContain("const typedPolisReportComponentFiles = ['src/components/PolisReport/**/*.{ts,tsx}']");
    expect(eslintConfig).toContain("const typedDebateMapComponentFiles = ['src/components/DebateMap/**/*.{ts,tsx}']");
    expect(eslintConfig).toContain("const typedNavbarComponentFiles = ['src/components/Navbar/**/*.{ts,tsx}']");
    expect(eslintConfig).toContain("const typedContractPageComponentFiles = ['src/components/ContractPage/**/*.{ts,tsx}']");
    expect(eslintConfig).toContain("const typedOnePageSessionComponentFiles = ['src/components/OnePageSession/**/*.{ts,tsx}']");
    expect(eslintConfig).toContain("const typedTagPageComponentFiles = ['src/components/TagPage/**/*.{ts,tsx}']");
    expect(eslintConfig).toContain("const typedDocumentLibraryComponentFiles = ['src/components/DocumentLibrary/**/*.{ts,tsx}']");
    expect(eslintConfig).toContain("const typedDemoViewsComponentFiles = ['src/components/DemoViews/**/*.{ts,tsx}']");
  });

  it('keeps web3-sensitive dependencies pinned during modernization', () => {
    const pkg = readClientPackageJson();

    expect(pkg.dependencies.ethers).toBe('5.7.2');
    expect(pkg.devDependencies['react-scripts']).toBeUndefined();
    expect(pkg.devDependencies.webpack).toBeUndefined();
    expect(pkg.overrides.webpack).toBeUndefined();
  });

  it('keeps stale dependency overrides out of the client package contract', () => {
    const pkg = readClientPackageJson();

    expect(pkg.overrides['@solana/web3.js']).toBeUndefined();
  });

  it('keeps Vite tooling scoped to development dependencies', () => {
    const pkg = readClientPackageJson();
    const vitePackages = [
      '@vitejs/plugin-react',
      'vite',
    ];

    vitePackages.forEach((name) => {
      expect(pkg.dependencies[name]).toBeUndefined();
      expect(pkg.devDependencies[name]).toBeDefined();
    });
  });

  it('keeps Vite output and entry wiring canonical', () => {
    const viteConfig = readClientFile('vite.config.mjs');
    const viteIndex = readClientFile('index.html');
    const viteEntry = readClientFile('src/viteEntry.js');
    const appEntry = readClientFile('src/index.js');
    const legacyOutputCleaner = readClientFile('scripts/clean-legacy-vite-output.mjs');
    const contractSourceLoader = readClientFile('src/components/ContractPage/contractSourceLoader.ts');

    expect(viteConfig).toContain("outDir: path.resolve(__dirname, 'build')");
    expect(viteConfig).not.toContain("outDir: path.resolve(__dirname, 'build-vite')");
    expect(viteConfig).not.toContain('ce-raw-loader-compatibility');
    expect(viteConfig).not.toContain('!!raw-loader!');
    expect(viteIndex).toContain('__PUBLIC_URL__');
    expect(viteIndex).toContain('/src/viteEntry.js');
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
      'vendor-crypto-zk-poseidon-low',
      'vendor-crypto-zk-poseidon-high',
      'vendor-crypto-zk',
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
    expect(viteConfig).toContain("'/node_modules/hash.js/'");
    expect(viteConfig).toContain("'/node_modules/inherits/'");
    expect(viteConfig).toContain("'/node_modules/minimalistic-assert/'");
  });

  it('keeps Vite browser polyfill dependencies limited to imported runtime shims', () => {
    const pkg = readClientPackageJson();
    const viteConfig = readClientFile('vite.config.mjs');
    const retainedBrowserShims = [
      'buffer',
      'process',
    ];
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

    expect(pkg.babel).toBeUndefined();
    expect(jestConfig).toContain('@babel/preset-env');
    expect(jestConfig).toContain('@babel/preset-react');
    expect(jestConfig).toContain("modules: 'commonjs'");
    expect(jestConfig).toContain('@babel/preset-typescript');
    expect(jestConfig).toContain('scripts/jest/jsdomPolyfills.js');
    expect(jestConfig).not.toContain('react-app-polyfill');
    expect(jsdomPolyfills).toContain("require('node-fetch')");
    expect(jsdomPolyfills).toContain('class JestResponse');
    expect(jsdomPolyfills).toContain('FileReader');
    expect(jsdomPolyfills).toContain('process.env.PUBLIC_URL');
  });

  it('keeps stale direct Babel syntax plugin wiring out of the client contract', () => {
    const pkg = readClientPackageJson();
    const jestConfig = readClientFile('jest.config.cjs');

    expect(pkg.devDependencies['@babel/plugin-proposal-private-property-in-object']).toBeUndefined();
    expect(pkg.devDependencies['@babel/plugin-syntax-import-meta']).toBeUndefined();
    expect(pkg.babel).toBeUndefined();
    expect(jestConfig).not.toContain('@babel/plugin-syntax-import-meta');
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

  it('keeps build, test, lint, analyze, and static serving tools out of production dependencies', () => {
    const pkg = readClientPackageJson();
    const devOnlyPackages = [
      '@babel/core',
      '@babel/preset-env',
      '@babel/preset-react',
      '@babel/preset-typescript',
      '@eslint/js',
      '@typescript-eslint/parser',
      'babel-jest',
      'eslint',
      'eslint-plugin-react',
      'eslint-plugin-react-hooks',
      'globals',
      'sass',
      'serve',
      'source-map-explorer',
      'vite',
    ];

    devOnlyPackages.forEach((name) => {
      expect(pkg.dependencies[name]).toBeUndefined();
      expect(pkg.devDependencies[name]).toBeDefined();
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
    expect(eslintConfig).toContain("const typedUiUtilityFiles = ['src/utilities/ui/**/*.{ts,tsx}']");
    expect(eslintConfig).toContain("const typedSharedComponentFiles = ['src/components/Shared/**/*.{ts,tsx}']");
    expect(eslintConfig).toContain('const typedInformationalComponentFiles = [');
    expect(eslintConfig).toContain("'src/components/About/**/*.{ts,tsx}'");
    expect(eslintConfig).toContain("'src/components/Footer/**/*.{ts,tsx}'");
    expect(eslintConfig).toContain("'src/components/InformationModals/**/*.{ts,tsx}'");
    expect(eslintConfig).toContain("'src/components/Onboarding/**/*.{ts,tsx}'");
    expect(eslintConfig).toContain("const typedMainContentComponentFiles = ['src/components/MainContent/**/*.{ts,tsx}']");
    expect(eslintConfig).toContain('const typedAuxiliaryPageComponentFiles = [');
    expect(eslintConfig).toContain("'src/components/Agent/**/*.{ts,tsx}'");
    expect(eslintConfig).toContain("'src/components/Bookmarks/**/*.{ts,tsx}'");
    expect(eslintConfig).toContain("'src/components/Sponsor/**/*.{ts,tsx}'");
    expect(eslintConfig).toContain('const typedShellSupportComponentFiles = [');
    expect(eslintConfig).toContain("'src/components/ErrorBoundary/**/*.{ts,tsx}'");
    expect(eslintConfig).toContain("'src/components/RightSidebar/**/*.{ts,tsx}'");
    expect(eslintConfig).toContain("const typedDevSupportComponentFiles = ['src/components/E2E/**/*.{ts,tsx}']");
    expect(eslintConfig).toContain("const typedGateComponentFiles = ['src/components/Gates/**/*.{ts,tsx}']");
    expect(eslintConfig).toContain("const typedCommunityTabComponentFiles = ['src/components/CommunityTab/**/*.{ts,tsx}']");
    expect(eslintConfig).toContain("const typedPolisReportComponentFiles = ['src/components/PolisReport/**/*.{ts,tsx}']");
    expect(eslintConfig).toContain("const typedDebateMapComponentFiles = ['src/components/DebateMap/**/*.{ts,tsx}']");
    expect(eslintConfig).toContain("const typedNavbarComponentFiles = ['src/components/Navbar/**/*.{ts,tsx}']");
    expect(eslintConfig).toContain("const typedContractPageComponentFiles = ['src/components/ContractPage/**/*.{ts,tsx}']");
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
