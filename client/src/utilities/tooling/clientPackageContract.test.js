const fs = require('fs');
const path = require('path');

const readClientPackageJson = () => {
  const packageJsonPath = path.resolve(__dirname, '../../../package.json');
  return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
};

describe('client package modernization contract', () => {
  it('keeps canonical commands on the CRA compatibility path', () => {
    const pkg = readClientPackageJson();

    expect(pkg.scripts.dev).toBe('PUBLIC_URL=/ react-app-rewired start');
    expect(pkg.scripts.build).toBe('PUBLIC_URL=/ react-app-rewired build');
    expect(pkg.scripts.start).toBe('serve -s build');
    expect(pkg.scripts.test).toBe('react-app-rewired test');
  });

  it('keeps web3-sensitive dependencies pinned during modernization', () => {
    const pkg = readClientPackageJson();

    expect(pkg.dependencies.ethers).toBe('5.7.2');
    expect(pkg.devDependencies['react-scripts']).toBe('4.0.3');
    expect(pkg.devDependencies.webpack).toBe('4.44.2');
    expect(pkg.overrides.webpack).toBe('4.44.2');
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
});
