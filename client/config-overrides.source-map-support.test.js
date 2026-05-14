'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { execFileSync } = require('node:child_process');

const override = require('./config-overrides.js');

test('webpack override aliases source-map-support/register to the browser shim', () => {
  const config = {
    resolve: {
      plugins: [],
      alias: {},
    },
    module: {
      rules: [{}, {}],
    },
    plugins: [],
    optimization: {
      minimizer: [],
    },
  };

  const next = override(config, 'development');

  assert.equal(
    next.resolve.alias['source-map-support/register$'],
    path.resolve(__dirname, 'src', 'shims', 'source-map-support-register.js'),
  );
});

test('webpack override does not copy generated worker bundles into the client build', () => {
  const patterns = override.getStaticCopyPatterns();

  assert.ok(
    !patterns.some((pattern) => pattern?.to === 'worker/sessionCorsWorker.bundle.js'),
    'expected no raw served worker bundle asset copy in the client build',
  );
});

test('webpack override no longer injects the legacy global .sol/.html/.txt loaders', () => {
  const config = {
    resolve: {
      plugins: [],
      alias: {},
    },
    module: {
      rules: [{}, {}],
    },
    plugins: [],
    optimization: {
      minimizer: [],
    },
  };

  const next = override(config, 'development');

  assert.ok(
    !next.module.rules.some((rule) => String(rule?.test) === '/\\.sol$/'),
    'expected no global Solidity loader rule in the webpack override',
  );
  assert.ok(
    !next.module.rules.some((rule) => String(rule?.test) === '/\\.html$/'),
    'expected no global HTML raw-loader rule in the webpack override',
  );
  assert.ok(
    !next.module.rules.some((rule) => String(rule?.test) === '/\\.txt$/i'),
    'expected no global text raw-loader rule in the webpack override',
  );
});

test('webpack override no longer injects the legacy worker-loader rule', () => {
  const config = {
    resolve: {
      plugins: [],
      alias: {},
    },
    module: {
      rules: [{}, {}],
    },
    plugins: [],
    optimization: {
      minimizer: [],
    },
  };

  const next = override(config, 'development');

  assert.ok(
    !next.module.rules.some((rule) => String(rule?.test) === '/\\.worker\\.js$/'),
    'expected no global worker-loader rule in the webpack override',
  );
});

test('webpack override no longer redirects permissionless imports to a shim', () => {
  const config = {
    resolve: {
      plugins: [],
      alias: {},
    },
    module: {
      rules: [{}, {}],
    },
    plugins: [],
    optimization: {
      minimizer: [],
    },
  };

  const next = override(config, 'development');

  assert.ok(
    !next.plugins.some((plugin) => (
      plugin?.constructor?.name === 'NormalModuleReplacementPlugin' &&
      String(plugin.resourceRegExp) === '/^permissionless(\\/.*)?$/'
    )),
    'expected no permissionless NormalModuleReplacementPlugin',
  );
});

test('webpack override no longer aliases unused MetaMask delegation utilities', () => {
  const config = {
    resolve: {
      plugins: [],
      alias: {},
    },
    module: {
      rules: [{}, {}],
    },
    plugins: [],
    optimization: {
      minimizer: [],
    },
  };

  const next = override(config, 'development');

  assert.equal(next.resolve.alias['@metamask/delegation-utils'], undefined);
});

test('webpack override no longer aliases an absent ffmpeg mock', () => {
  const config = {
    resolve: {
      plugins: [],
      alias: {},
    },
    module: {
      rules: [{}, {}],
    },
    plugins: [],
    optimization: {
      minimizer: [],
    },
  };

  const next = override(config, 'development');

  assert.equal(next.resolve.alias['@ffmpeg/ffmpeg'], undefined);
});

test('webpack and Jest overrides no longer alias absent OpenTelemetry subpaths', () => {
  const config = {
    resolve: {
      plugins: [],
      alias: {},
    },
    module: {
      rules: [{}, {}],
    },
    plugins: [],
    optimization: {
      minimizer: [],
    },
  };

  const next = override(config, 'development');

  assert.equal(next.resolve.alias['@opentelemetry/otlp-exporter-base/browser-http$'], undefined);
  assert.equal(next.resolve.alias['@opentelemetry/otlp-exporter-base/node-http$'], undefined);

  const jestConfig = override.jest({ moduleNameMapper: {} });

  assert.equal(jestConfig.moduleNameMapper['^@opentelemetry/otlp-exporter-base/browser-http$'], undefined);
  assert.equal(jestConfig.moduleNameMapper['^@opentelemetry/otlp-exporter-base/node-http$'], undefined);
});

test('webpack override no longer redirects CRA away from tsconfig.json', () => {
  assert.equal(override.paths, undefined);
});

test('webpack override does not rewrite temp env vars during test bootstrap', () => {
  const result = JSON.parse(execFileSync(
    process.execPath,
    [
      '-e',
      `
        process.env.NODE_ENV = 'test';
        const before = {
          TMPDIR: process.env.TMPDIR ?? null,
          TMP: process.env.TMP ?? null,
          TEMP: process.env.TEMP ?? null,
        };
        require('./config-overrides.js');
        const after = {
          TMPDIR: process.env.TMPDIR ?? null,
          TMP: process.env.TMP ?? null,
          TEMP: process.env.TEMP ?? null,
        };
        process.stdout.write(JSON.stringify({ before, after }));
      `,
    ],
    {
      cwd: __dirname,
      encoding: 'utf8',
    },
  ));

  assert.deepEqual(result.after, result.before);
});
