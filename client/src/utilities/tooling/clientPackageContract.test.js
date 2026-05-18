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
    const eslintConfig = readClientFile('.eslintrc.json');

    expect(pkg.scripts['dev:vite']).toBe('PUBLIC_URL=/ vite --host 0.0.0.0 --port 3000');
    expect(pkg.scripts['build:vite']).toBe('PUBLIC_URL=/ vite build');
    expect(pkg.scripts['preview:vite']).toBe('vite preview --host 0.0.0.0');
    expect(pkg.scripts['dev:cra']).toBeUndefined();
    expect(pkg.scripts['build:cra']).toBeUndefined();
    expect(pkg.scripts.eject).toBeUndefined();
    expect(pkg.scripts.start).not.toContain('vite');
    expect(eslintConfig).not.toContain('react-app');
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

  it('keeps Vite vendor chunk policy explicit', () => {
    const viteConfig = readClientFile('vite.config.mjs');
    const expectedVendorChunks = [
      'vendor-react',
      'vendor-wallet',
      'vendor-lit',
      'vendor-arweave',
      'vendor-visualization',
      'vendor-canvas',
      'vendor-crypto',
      'vendor-media',
      'vendor-ui',
      'vendor-polyfills',
      'vendor-misc',
    ];

    expect(viteConfig).toContain('export const resolveManualChunk');
    expect(viteConfig).toContain('manualChunks: resolveManualChunk');
    expectedVendorChunks.forEach((chunkName) => {
      expect(viteConfig).toContain(chunkName);
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

  it('keeps build, test, lint, analyze, and static serving tools out of production dependencies', () => {
    const pkg = readClientPackageJson();
    const devOnlyPackages = [
      '@babel/core',
      '@babel/preset-env',
      '@babel/preset-react',
      '@babel/preset-typescript',
      '@typescript-eslint/eslint-plugin',
      '@typescript-eslint/parser',
      'babel-jest',
      'eslint',
      'eslint-plugin-import',
      'eslint-plugin-prettier',
      'eslint-plugin-react',
      'eslint-plugin-react-hooks',
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
