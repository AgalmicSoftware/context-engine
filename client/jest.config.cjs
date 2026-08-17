const fs = require('fs');
const path = require('path');

const allowList = ['viem', 'ox', '@noble', '@scure'].join('|');
const nodeModulesPattern = `[/\\\\]node_modules[/\\\\](?!(${allowList})[/\\\\])`;
const oxNestedCjs = path.resolve(__dirname, 'node_modules', 'viem', 'node_modules', 'ox', '_cjs');
const oxCjsBase = fs.existsSync(oxNestedCjs)
  ? '<rootDir>/node_modules/viem/node_modules/ox/_cjs'
  : '<rootDir>/node_modules/ox/_cjs';
const oxScopedPrefixes = '(erc\\d{4}|tempo|trusted-setups|window)';
const babelJestOptions = {
  babelrc: false,
  configFile: false,
  presets: [
    ['@babel/preset-env', {
      modules: 'commonjs',
      targets: {
        node: 'current',
      },
    }],
    ['@babel/preset-react', {
      runtime: 'automatic',
    }],
    '@babel/preset-typescript',
  ],
};

module.exports = {
  roots: ['<rootDir>/src', '<rootDir>/../tests/root'],
  testEnvironment: 'jsdom',
  setupFiles: ['<rootDir>/scripts/jest/jsdomPolyfills.js'],
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  modulePaths: ['<rootDir>/src', '<rootDir>/node_modules', '<rootDir>/../node_modules'],
  moduleFileExtensions: ['web.js', 'js', 'web.ts', 'ts', 'web.tsx', 'tsx', 'json', 'web.jsx', 'jsx', 'node'],
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/*.{spec,test}.{js,jsx,ts,tsx}',
  ],
  transform: {
    '^.+\\.(js|jsx|mjs|cjs|ts|tsx)$': ['babel-jest', babelJestOptions],
  },
  transformIgnorePatterns: [nodeModulesPattern],
  moduleNameMapper: {
    '^@ce-shared\/(.*)$': '<rootDir>/../shared/$1',
    '^.+\\.module\\.(css|sass|scss)$': 'identity-obj-proxy',
    '^.+\\.(css|sass|scss)$': 'identity-obj-proxy',
    '^.+\\.(bmp|gif|jpg|jpeg|png|svg|webp|avif|ico|mp4|webm|wav|mp3|m4a|aac|oga|txt|html)$':
      '<rootDir>/scripts/jest/fileMock.js',
    '^.+\\.sol\\?raw$': '<rootDir>/scripts/jest/fileMock.js',
    '^(\\.{1,2}/.+)\\.js$': '$1',
    '^(utilities/.+)\\.js$': '$1',
    '^node:os$': '<rootDir>/src/shims/node-os.ts',
    '^node:events$': '<rootDir>/src/shims/node-events.ts',
    '^viem$': '<rootDir>/node_modules/viem/_cjs/index.js',
    '^viem\\/(.*)$': '<rootDir>/node_modules/viem/_cjs/$1',
    '^ox$': `${oxCjsBase}/index.js`,
    '^ox\\/index\\.docs$': `${oxCjsBase}/index.docs.js`,
    [`^ox\\/${oxScopedPrefixes}$`]: `${oxCjsBase}/$1/index.js`,
    [`^ox\\/${oxScopedPrefixes}\\/(.*)$`]: `${oxCjsBase}/$1/$2.js`,
    '^ox\\/([A-Z].*)$': `${oxCjsBase}/core/$1.js`,
  },
  watchPathIgnorePatterns: ['<rootDir>/build', '<rootDir>/coverage'],
  // Coverage floors are banked from full-client coverage runs. Move them only
  // upward after large lanes, rounding down to avoid CI flakes.
  coverageThreshold: {
    global: {
      statements: 75.7,
      branches: 61.0,
      functions: 77.0,
      lines: 79.1,
    },
  },
  resetMocks: false,
};
