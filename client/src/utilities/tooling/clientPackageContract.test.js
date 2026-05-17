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

describe('client package modernization contract', () => {
  it('keeps canonical commands on the Vite and standalone Jest paths', () => {
    const pkg = readClientPackageJson();

    expect(pkg.scripts.dev).toBe('PUBLIC_URL=/ vite --host 0.0.0.0 --port 3000');
    expect(pkg.scripts.build).toBe('PUBLIC_URL=/ vite build');
    expect(pkg.scripts.start).toBe('serve -s build');
    expect(pkg.scripts.test).toBe('jest');
  });

  it('keeps CRA fallback scripts removed from the client package contract', () => {
    const pkg = readClientPackageJson();

    expect(pkg.scripts['dev:vite']).toBe('PUBLIC_URL=/ vite --host 0.0.0.0 --port 3000');
    expect(pkg.scripts['build:vite']).toBe('PUBLIC_URL=/ vite build');
    expect(pkg.scripts['preview:vite']).toBe('vite preview --host 0.0.0.0');
    expect(pkg.scripts['dev:cra']).toBeUndefined();
    expect(pkg.scripts['build:cra']).toBeUndefined();
    expect(pkg.scripts.eject).toBeUndefined();
    expect(pkg.scripts.start).not.toContain('vite');
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

    expect(viteConfig).toContain("outDir: path.resolve(__dirname, 'build')");
    expect(viteConfig).not.toContain("outDir: path.resolve(__dirname, 'build-vite')");
    expect(viteIndex).toContain('__PUBLIC_URL__');
    expect(viteIndex).toContain('/src/viteEntry.js');
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
      'eslint-plugin-prettier',
      'sass',
      'serve',
      'source-map-explorer',
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

  it('keeps stale webpack and CRA packages out of the client package contract', () => {
    const pkg = readClientPackageJson();
    const staleLoaders = [
      'copy-webpack-plugin',
      'file-loader',
      'node-polyfill-webpack-plugin',
      'raw-loader',
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
