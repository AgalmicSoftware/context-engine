'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

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

test('webpack override copies the known-good dist worker bundle to a raw served path', () => {
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
  const copyPlugin = next.plugins.find((plugin) => plugin?.constructor?.name === 'CopyPlugin');
  assert.ok(copyPlugin, 'expected CopyPlugin to be configured');

  const patterns = copyPlugin.patterns || copyPlugin.options?.patterns || [];
  assert.ok(
    patterns.some((pattern) => (
      pattern?.from === path.resolve(__dirname, '..', 'dist', 'sessionCorsWorker.bundle.js') &&
      pattern?.to === 'worker/sessionCorsWorker.bundle.js'
    )),
    'expected the dist worker bundle to be copied to worker/sessionCorsWorker.bundle.js',
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
