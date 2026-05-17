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
  it('keeps canonical commands on the CRA compatibility path', () => {
    const pkg = readClientPackageJson();

    expect(pkg.scripts.dev).toBe('PUBLIC_URL=/ react-app-rewired start');
    expect(pkg.scripts.build).toBe('PUBLIC_URL=/ react-app-rewired build');
    expect(pkg.scripts.start).toBe('serve -s build');
    expect(pkg.scripts.test).toBe('react-app-rewired test');
  });

  it('keeps Vite available only as a sidecar command path', () => {
    const pkg = readClientPackageJson();

    expect(pkg.scripts['dev:vite']).toBe('PUBLIC_URL=/ vite --host 0.0.0.0');
    expect(pkg.scripts['build:vite']).toBe('PUBLIC_URL=/ vite build');
    expect(pkg.scripts['preview:vite']).toBe('vite preview --host 0.0.0.0');
    expect(pkg.scripts.dev).not.toContain('vite');
    expect(pkg.scripts.build).not.toContain('vite');
    expect(pkg.scripts.start).not.toContain('vite');
  });

  it('keeps web3-sensitive dependencies pinned during modernization', () => {
    const pkg = readClientPackageJson();

    expect(pkg.dependencies.ethers).toBe('5.7.2');
    expect(pkg.devDependencies['react-scripts']).toBe('4.0.3');
    expect(pkg.devDependencies.webpack).toBe('4.44.2');
    expect(pkg.overrides.webpack).toBe('4.44.2');
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

  it('keeps Vite output and entry wiring separate from CRA', () => {
    const viteConfig = readClientFile('vite.config.mjs');
    const viteIndex = readClientFile('index.html');
    const craIndex = readClientFile('public/index.html');

    expect(viteConfig).toContain("outDir: path.resolve(__dirname, 'build-vite')");
    expect(viteConfig).not.toContain("outDir: path.resolve(__dirname, 'build')");
    expect(viteIndex).toContain('__PUBLIC_URL__');
    expect(viteIndex).toContain('/src/viteEntry.js');
    expect(craIndex).toContain('%PUBLIC_URL%');
    expect(craIndex).not.toContain('/src/viteEntry.js');
  });

  it('keeps Vite browser-loaded compatibility shims free of runtime require calls', () => {
    [
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
      'babel-jest',
      'eslint-plugin-prettier',
      'node-polyfill-webpack-plugin',
      'raw-loader',
      'react-scripts',
      'sass',
      'sass-loader',
      'serve',
      'source-map-explorer',
      'source-map-loader',
      'webpack',
    ];

    devOnlyPackages.forEach((name) => {
      expect(pkg.dependencies[name]).toBeUndefined();
      expect(pkg.devDependencies[name]).toBeDefined();
    });
  });

  it('keeps stale webpack loaders out of the client package contract', () => {
    const pkg = readClientPackageJson();
    const staleLoaders = [
      'worker-loader',
    ];

    staleLoaders.forEach((name) => {
      expect(pkg.dependencies[name]).toBeUndefined();
      expect(pkg.devDependencies[name]).toBeUndefined();
    });
  });
});
