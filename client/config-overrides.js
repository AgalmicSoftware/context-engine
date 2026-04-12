
/** @file config-overrides.js */

const fs = require('fs');
const path = require('path');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');

const override = function override(config, env) {
  const noMinify = process.env.NO_MINIFY === 'true';
  // allow importing from outside of app/src folder
  const scope = config.resolve.plugins.findIndex(o => o.constructor.name === 'ModuleScopePlugin');
  if (scope > -1) config.resolve.plugins.splice(scope, 1);

  // Contract sources use explicit raw-loader imports, and the worker bundle is
  // served via CopyPlugin, so the repo no longer injects global .sol/.html/.txt rules.
  // Web Workers
  config.module.rules.push({ test: /\.worker\.js$/, use: { loader: 'worker-loader' } });

  // ESM tweak for webpack 4 (.mjs in node_modules)
  config.module.rules.push({ test: /\.mjs$/, include: /node_modules/, type: 'javascript/auto' });

  // Ensure plugins array exists
  config.plugins = config.plugins || [];

  // CRA4/webpack4 terser can overflow call stack on very large chunks with aggressive inlining.
  // Keep minification enabled, but use safer compression settings.
  if (env === 'production' && config.optimization && noMinify) {
    config.optimization.minimize = false;
    config.optimization.minimizer = [];
  }

  if (
    env === 'production' &&
    config.optimization &&
    !noMinify &&
    Array.isArray(config.optimization.minimizer)
  ) {
    const terserMinimizer = config.optimization.minimizer.find(
      (plugin) => plugin && plugin.constructor && plugin.constructor.name === 'TerserPlugin'
    );
    const compress = terserMinimizer?.options?.terserOptions?.compress;
    if (compress && typeof compress === 'object') {
      compress.inline = 1;
      compress.reduce_funcs = false;
      compress.reduce_vars = false;
      compress.collapse_vars = false;
      compress.passes = 1;
    }
  }

  // CSS modules in async chunks can appear in different import orders without
  // behavior changes, but mini-css-extract-plugin still warns by default.
  const miniCssExtractPlugin = (config.plugins || []).find(
    (plugin) => plugin && plugin.constructor && plugin.constructor.name === 'MiniCssExtractPlugin'
  );
  if (miniCssExtractPlugin && miniCssExtractPlugin.options) {
    miniCssExtractPlugin.options.ignoreOrder = true;
  }

  config.plugins.push(
    new CopyPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, 'src', 'assets/img'),
          to: path.resolve(__dirname, 'build', 'images'),
          filter: async () => true,
        },
        {
          // Serve the known-good dist bundle as a raw static asset so the
          // wizard can fetch exact worker bytes without webpack loader wrappers.
          from: path.resolve(__dirname, '..', 'dist', 'sessionCorsWorker.bundle.js'),
          to: 'worker/sessionCorsWorker.bundle.js',
        },
      ],
      options: { concurrency: 100 },
    }),
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer/', 'Buffer'],
    }),

    // 🔁 One-file shim for *all* `permissionless` imports
    new webpack.NormalModuleReplacementPlugin(/^permissionless(\/.*)?$/, (resource) => {
      resource.request = path.resolve(__dirname, 'src/shims/permissionless-all.js');
    }),

    // 🔁 Lit contracts subpath shim for webpack 4 (no "exports" support)
    new webpack.NormalModuleReplacementPlugin(/^@lit-protocol\/contracts\/(prod|dev)\/(.+)$/, (resource) => {
      const nestedBase = path.resolve(
        __dirname,
        'node_modules',
        '@lit-protocol',
        'access-control-conditions',
        'node_modules',
        '@lit-protocol',
        'contracts'
      );
      const rootBase = path.resolve(__dirname, 'node_modules', '@lit-protocol', 'contracts');
      const base = fs.existsSync(path.join(nestedBase, 'dist')) ? nestedBase : rootBase;
      const match = resource.request.match(/^@lit-protocol\/contracts\/(prod|dev)\/(.+)$/);
      if (!match) return;
      const env = match[1];
      const subpath = match[2];
      resource.request = path.join(base, 'dist', env, subpath);
    }),

    // 🔁 Lit contracts custom-network-signatures subpath shim for webpack 4 (no "exports" support)
    new webpack.NormalModuleReplacementPlugin(/^@lit-protocol\/contracts\/custom-network-signatures$/, (resource) => {
      const rootBase = path.resolve(__dirname, 'node_modules', '@lit-protocol', 'contracts');
      resource.request = path.join(rootBase, 'dist', 'custom-network-signatures.browser.js');
    })
  );

  // --- SHIMS / ALIASES ---
  config.resolve = config.resolve || {};
  config.resolve.alias = config.resolve.alias || {};

  // Lit contracts subpath alias for webpack 4 exports gaps
  // Force modern buffer implementation (node-libs-browser@buffer@4 lacks writeBigUInt64BE).
  config.resolve.alias.buffer = require.resolve('buffer/');

  const litNestedBase = path.resolve(
    __dirname,
    'node_modules',
    '@lit-protocol',
    'access-control-conditions',
    'node_modules',
    '@lit-protocol',
    'contracts'
  );
  const litRootBase = path.resolve(__dirname, 'node_modules', '@lit-protocol', 'contracts');
  const litBase = fs.existsSync(path.join(litNestedBase, 'dist')) ? litNestedBase : litRootBase;
  config.resolve.alias['@lit-protocol/contracts/prod'] = path.join(litBase, 'dist', 'prod');
  config.resolve.alias['@lit-protocol/contracts/dev'] = path.join(litBase, 'dist', 'dev');
  config.resolve.alias['@lit-protocol/contracts/custom-network-signatures'] = path.join(
    litBase,
    'dist',
    'custom-network-signatures.browser.js'
  );

  // ⛔️ Do NOT set config.resolve.alias['permissionless'] — we use the replacement plugin above.

  // MetaMask shims
  config.resolve.alias['@metamask/superstruct'] = path.resolve(
    __dirname, 'src', 'shims', 'metamask-superstruct.js'
  );
  config.resolve.alias['@metamask/delegation-utils'] = path.resolve(
    __dirname, 'src', 'shims', 'metamask-delegation-utils.js'
  );

  // ✅ React 17 polyfill for React 18's 'react-dom/client' (required by @web3auth/modal v10)
  config.resolve.alias['react-dom/client'] = path.resolve(
    __dirname, 'src', 'shims', 'react-dom-client-shim.js'
  );

  // existing ffmpeg mock
  config.resolve.alias['@ffmpeg/ffmpeg'] = path.join(
    __dirname,
    '__mocks__',
    '@ffmpeg',
    'ffmpeg'
  );

  // Force CJS build to avoid webpack 4 named-export checks against ESM-only entry
  config.resolve.alias['zod-validation-error$'] = path.resolve(
    __dirname,
    'node_modules',
    'zod-validation-error',
    'dist',
    'index.js'
  );

  // Browser bundles do not provide Node worker_threads. This shim avoids optional
  // node-localstorage imports in Lit auth from emitting compile-time module warnings.
  config.resolve.alias['worker_threads$'] = path.resolve(
    __dirname,
    'src',
    'shims',
    'node-worker-threads.js'
  );
  config.resolve.alias['node:worker_threads$'] = path.resolve(
    __dirname,
    'src',
    'shims',
    'node-worker-threads.js'
  );

  // OpenTelemetry exporter subpath shims for webpack 4 (no package "exports" subpath support).
  config.resolve.alias['@opentelemetry/otlp-exporter-base/browser-http$'] = path.resolve(
    __dirname,
    'node_modules',
    '@opentelemetry',
    'otlp-exporter-base',
    'build',
    'esm',
    'index-browser-http.js'
  );
  config.resolve.alias['@opentelemetry/otlp-exporter-base/node-http$'] = path.resolve(
    __dirname,
    'node_modules',
    '@opentelemetry',
    'otlp-exporter-base',
    'build',
    'esm',
    'index-node-http.js'
  );
  config.resolve.alias['source-map-support/register$'] = path.resolve(
    __dirname,
    'src',
    'shims',
    'source-map-support-register.js'
  );

  return config;
};

override.jest = (config) => {
  const allowList = ['viem', 'ox', '@noble', '@scure'].join('|');
  const nodeModulesPattern = `[/\\\\]node_modules[/\\\\](?!(${allowList})[/\\\\])`;
  const next = { ...config };
  const roots = new Set(next.roots || []);
  roots.add('<rootDir>/src');
  roots.add('<rootDir>/../test');
  next.roots = Array.from(roots);
  const modulePaths = new Set(next.modulePaths || []);
  modulePaths.add(path.join(__dirname, 'node_modules'));
  modulePaths.add(path.resolve(__dirname, '..', 'node_modules'));
  next.modulePaths = Array.from(modulePaths);
  const patterns = [...(next.transformIgnorePatterns || [])];
  const index = patterns.findIndex((pattern) => pattern.includes('node_modules'));
  const oxNestedCjs = path.resolve(__dirname, 'node_modules', 'viem', 'node_modules', 'ox', '_cjs');
  const oxRootCjs = path.resolve(__dirname, 'node_modules', 'ox', '_cjs');
  const oxCjsBase = fs.existsSync(oxNestedCjs)
    ? path.join('<rootDir>', 'node_modules', 'viem', 'node_modules', 'ox', '_cjs')
    : path.join('<rootDir>', 'node_modules', 'ox', '_cjs');

  if (index === -1) {
    patterns.unshift(nodeModulesPattern);
  } else {
    patterns[index] = nodeModulesPattern;
  }

  next.transformIgnorePatterns = patterns;
  const oxScopedPrefixes = '(erc\\d{4}|tempo|trusted-setups|window)';
  next.moduleNameMapper = {
    ...(next.moduleNameMapper || {}),
    '^node:os$': path.join('<rootDir>', 'src', 'shims', 'node-os.js'),
    '^node:events$': path.join('<rootDir>', 'src', 'shims', 'node-events.js'),
    '^@lit-protocol/contracts/(prod|dev)/(.*)$': path.join(
      '<rootDir>',
      'src',
      'shims',
      'lit-contracts-stub.js'
    ),
    '^@lit-protocol/contracts/(prod|dev)$': path.join(
      '<rootDir>',
      'src',
      'shims',
      'lit-contracts-stub.js'
    ),
    '^@lit-protocol/contracts$': path.join(
      '<rootDir>',
      'src',
      'shims',
      'lit-contracts-stub.js'
    ),
    '^@lit-protocol/contracts/custom-network-signatures$': path.join(
      '<rootDir>',
      'src',
      'shims',
      'lit-custom-network-signatures-stub.js'
    ),
    '^viem$': path.join('<rootDir>', 'node_modules', 'viem', '_cjs', 'index.js'),
    '^viem\\/(.*)$': path.join('<rootDir>', 'node_modules', 'viem', '_cjs', '$1'),
    '^ox$': `${oxCjsBase}/index.js`,
    '^ox\\/index\\.docs$': `${oxCjsBase}/index.docs.js`,
    [`^ox\\/${oxScopedPrefixes}$`]: `${oxCjsBase}/$1/index.js`,
    [`^ox\\/${oxScopedPrefixes}\\/(.*)$`]: `${oxCjsBase}/$1/$2.js`,
    '^ox\\/([A-Z].*)$': `${oxCjsBase}/core/$1.js`,
    '^@opentelemetry/otlp-exporter-base/browser-http$': path.join(
      '<rootDir>',
      'node_modules',
      '@opentelemetry',
      'otlp-exporter-base',
      'build',
      'esm',
      'index-browser-http.js'
    ),
    '^@opentelemetry/otlp-exporter-base/node-http$': path.join(
      '<rootDir>',
      'node_modules',
      '@opentelemetry',
      'otlp-exporter-base',
      'build',
      'esm',
      'index-node-http.js'
    ),
  };
  return next;
};

module.exports = override;

// --- Dev server headers to allow Web3Auth/Google popup handshake ---
// Keeps window.opener available (avoids "reading 'loginWithSessionId'" / COOP errors)
module.exports.devServer = (configFunction) => {
  return (proxy, allowedHost) => {
    const config = configFunction(proxy, allowedHost);
    config.headers = {
      ...(config.headers || {}),
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      'Cross-Origin-Embedder-Policy': 'unsafe-none',
    };
    return config;
  };
};
