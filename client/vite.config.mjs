import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, transformWithEsbuild } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, 'src');
const publicDir = path.resolve(__dirname, 'public');
const postsDir = path.resolve(__dirname, '..', 'posts');
const headers = {
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
  'Cross-Origin-Embedder-Policy': 'unsafe-none',
};

const normalizePublicUrlForHtml = (raw) => {
  const value = String(raw || '').trim();
  if (!value || value === '/') return '';
  return value.replace(/\/+$/, '');
};

const normalizeBase = (raw) => {
  const value = String(raw || '').trim();
  if (!value || value === '/') return '/';
  if (/^[a-z][a-z\d+\-.]*:\/\//i.test(value)) {
    return value.endsWith('/') ? value : `${value}/`;
  }
  return `/${value.replace(/^\/+|\/+$/g, '')}/`;
};

const copyDirectoryExcluding = (sourceDir, outputDir, excludedRelativePaths = new Set()) => {
  if (!fs.existsSync(sourceDir)) return;
  fs.mkdirSync(outputDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const source = path.join(sourceDir, entry.name);
    const target = path.join(outputDir, entry.name);
    const relativePath = path.relative(publicDir, source).split(path.sep).join('/');
    if (excludedRelativePaths.has(relativePath)) continue;
    if (entry.isDirectory()) {
      copyDirectoryExcluding(source, target, excludedRelativePaths);
    } else if (entry.isFile()) {
      fs.copyFileSync(source, target);
    }
  }
};

const publicAssetContentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

const manualChunkGroups = [
  {
    name: 'vendor-react',
    patterns: [
      '/node_modules/@tanstack/query-core/',
      '/node_modules/@tanstack/query-persist-client-core/',
      '/node_modules/@tanstack/query-sync-storage-persister/',
      '/node_modules/@tanstack/react-query/',
      '/node_modules/hoist-non-react-statics/',
      '/node_modules/prop-types/',
      '/node_modules/react/',
      '/node_modules/react-dom/',
      '/node_modules/react-redux/',
      '/node_modules/react-router/',
      '/node_modules/react-router-dom/',
      '/node_modules/redux/',
      '/node_modules/redux-thunk/',
      '/node_modules/scheduler/',
      '/node_modules/use-sync-external-store/',
    ],
  },
  {
    name: 'vendor-ethers',
    patterns: [
      '/node_modules/@ethersproject/',
      '/node_modules/ethers/',
    ],
  },
  {
    name: 'vendor-wallet-core',
    patterns: [
      '/node_modules/@noble/',
      '/node_modules/@wagmi/',
      '/node_modules/viem/',
      '/node_modules/wagmi/',
    ],
  },
  {
    name: 'vendor-wallet-connectors',
    patterns: [
      '/node_modules/@metamask/',
      '/node_modules/@rainbow-me/',
      '/node_modules/@walletconnect/',
    ],
  },
  {
    name: 'vendor-lit',
    patterns: [
      '/node_modules/@lit-protocol/',
    ],
  },
  {
    name: 'vendor-arweave',
    patterns: [
      '/node_modules/arweave/',
      '/node_modules/arbundles/',
    ],
  },
  {
    name: 'vendor-visualization',
    patterns: [
      '/node_modules/d3',
      '/node_modules/delaunator/',
      '/node_modules/dijkstrajs/',
      '/node_modules/internmap/',
      '/node_modules/java-random/',
      '/node_modules/ml-',
      '/node_modules/ml-kmeans/',
      '/node_modules/networkanalysis-ts/',
      '/node_modules/react-simple-maps/',
      '/node_modules/robust-predicates/',
      '/node_modules/topojson-',
      '/node_modules/umap-js/',
    ],
  },
  {
    name: 'vendor-canvas',
    patterns: [
      '/node_modules/canvg/',
      '/node_modules/dompurify/',
      '/node_modules/fast-png/',
      '/node_modules/fflate/',
      '/node_modules/iobuffer/',
      '/node_modules/performance-now/',
      '/node_modules/raf/',
      '/node_modules/rgbcolor/',
      '/node_modules/stackblur-canvas/',
      '/node_modules/svg-pathdata/',
    ],
  },
  {
    name: 'vendor-crypto-core',
    patterns: [
      '/node_modules/aes-js/',
      '/node_modules/bech32/',
      '/node_modules/bignumber.js/',
      '/node_modules/crypto-js/',
      '/node_modules/hash.js/',
      '/node_modules/inherits/',
      '/node_modules/js-sha3/',
      '/node_modules/minimalistic-assert/',
      '/node_modules/scrypt-js/',
    ],
  },
  {
    name: 'vendor-crypto-zk-poseidon-low',
    patterns: [
      '/node_modules/poseidon-lite/constants/1.js',
      '/node_modules/poseidon-lite/constants/2.js',
      '/node_modules/poseidon-lite/constants/3.js',
      '/node_modules/poseidon-lite/constants/4.js',
      '/node_modules/poseidon-lite/constants/5.js',
      '/node_modules/poseidon-lite/constants/6.js',
      '/node_modules/poseidon-lite/constants/7.js',
      '/node_modules/poseidon-lite/constants/8.js',
    ],
  },
  {
    name: 'vendor-crypto-zk-poseidon-high',
    patterns: [
      '/node_modules/poseidon-lite/constants/9.js',
      '/node_modules/poseidon-lite/constants/10.js',
      '/node_modules/poseidon-lite/constants/11.js',
      '/node_modules/poseidon-lite/constants/12.js',
      '/node_modules/poseidon-lite/constants/13.js',
      '/node_modules/poseidon-lite/constants/14.js',
      '/node_modules/poseidon-lite/constants/15.js',
      '/node_modules/poseidon-lite/constants/16.js',
    ],
  },
  {
    name: 'vendor-crypto-zk',
    patterns: [
      '/node_modules/poseidon-lite/',
    ],
  },
  {
    name: 'vendor-media-canvas-export',
    patterns: [
      '/node_modules/html2canvas/',
    ],
  },
  {
    name: 'vendor-media-pdf',
    patterns: [
      '/node_modules/jspdf/',
    ],
  },
  {
    name: 'vendor-media-audio',
    patterns: [
      '/node_modules/hark/',
      '/node_modules/recordrtc/',
    ],
  },
  {
    name: 'vendor-ui',
    patterns: [
      '/node_modules/@dnd-kit/',
      '/node_modules/@fortawesome/',
      '/node_modules/@popperjs/',
      '/node_modules/@vanilla-extract/',
      '/node_modules/bootstrap/',
      '/node_modules/classnames/',
      '/node_modules/clsx/',
      '/node_modules/copy-to-clipboard/',
      '/node_modules/get-nonce/',
      '/node_modules/qrcode/',
      '/node_modules/qrcode.react/',
      '/node_modules/react-fast-compare/',
      '/node_modules/react-popper/',
      '/node_modules/react-remove-scroll',
      '/node_modules/react-style-singleton/',
      '/node_modules/react-transition-group/',
      '/node_modules/reactstrap/',
      '/node_modules/toggle-selection/',
      '/node_modules/use-callback-ref/',
      '/node_modules/use-sidecar/',
      '/node_modules/warning/',
    ],
  },
  {
    name: 'vendor-polyfills',
    patterns: [
      '/node_modules/buffer/',
      '/node_modules/process/',
    ],
  },
];

export const resolveManualChunk = (id) => {
  const normalizedId = String(id || '').split(path.sep).join('/');
  if (!normalizedId.includes('/node_modules/')) return undefined;

  const group = manualChunkGroups.find(({ patterns }) => (
    patterns.some((pattern) => normalizedId.includes(pattern))
  ));

  return group ? group.name : 'vendor-misc';
};

const resolvePublicAssetPath = (requestUrl) => {
  const rawPathname = String(requestUrl || '').split('?')[0].split('#')[0];
  if (!rawPathname || rawPathname === '/') return null;
  let pathname;
  try {
    pathname = decodeURIComponent(rawPathname);
  } catch {
    return null;
  }
  const relativePath = pathname.replace(/^\/+/, '');
  if (!relativePath || relativePath === 'index.html') return null;
  const resolvedPath = path.resolve(publicDir, relativePath);
  if (!resolvedPath.startsWith(`${publicDir}${path.sep}`)) return null;
  return fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile() ? resolvedPath : null;
};

const resolvePostsAssetPath = (requestUrl) => {
  const rawPathname = String(requestUrl || '').split('?')[0].split('#')[0];
  if (!rawPathname || rawPathname === '/' || rawPathname === '/posts') return null;
  let pathname;
  try {
    pathname = decodeURIComponent(rawPathname);
  } catch {
    return null;
  }
  const relativePath = pathname.replace(/^\/+/, '');
  if (!relativePath.startsWith('posts/')) return null;
  const postRelativePath = relativePath.slice('posts/'.length);
  if (!postRelativePath) return null;
  const resolvedPath = path.resolve(postsDir, postRelativePath);
  if (!resolvedPath.startsWith(`${postsDir}${path.sep}`)) return null;
  return fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile() ? resolvedPath : null;
};

const readClientEnv = (mode) => {
  const loadedEnv = loadEnv(mode, __dirname, ['REACT_APP_', 'NEXT_PUBLIC_', 'PUBLIC_URL']);
  const reactAppEnv = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => (
      key.startsWith('REACT_APP_') || key.startsWith('NEXT_PUBLIC_')
    ))
  );
  const publicUrl = process.env.PUBLIC_URL ?? loadedEnv.PUBLIC_URL ?? '/';
  return {
    ...loadedEnv,
    ...reactAppEnv,
    PUBLIC_URL: publicUrl,
    NODE_ENV: mode === 'production' ? 'production' : 'development',
  };
};

const resolveExistingTsSibling = (request, importer) => {
  if (!request.endsWith('.js') || !importer) return null;
  if (importer.includes(`${path.sep}node_modules${path.sep}`)) return null;

  const candidates = [];
  const tsRequest = request.replace(/\.js$/, '.ts');

  if (request.startsWith('./') || request.startsWith('../')) {
    candidates.push(path.resolve(path.dirname(importer), tsRequest));
  } else if (path.isAbsolute(request) && request.startsWith(`${srcDir}${path.sep}`)) {
    candidates.push(tsRequest);
  } else if (request.startsWith('utilities/')) {
    candidates.push(path.resolve(srcDir, tsRequest));
  }

  return candidates.find((candidate) => (
    !candidate.includes(`${path.sep}node_modules${path.sep}`) &&
    fs.existsSync(candidate)
  )) || null;
};

const jsToTsCompatibilityPlugin = () => ({
  name: 'ce-js-to-ts-compatibility',
  enforce: 'pre',
  async resolveId(source, importer, options) {
    const candidate = resolveExistingTsSibling(source, importer);
    if (!candidate) return null;
    return this.resolve(candidate, importer, { ...options, skipSelf: true });
  },
});

const litContractsSubpathShim = () => ({
  name: 'ce-lit-contracts-subpath-shim',
  enforce: 'pre',
  async resolveId(source, importer, options) {
    const match = source.match(/^@lit-protocol\/contracts\/(prod|dev)\/(.+)$/);
    if (!match) return null;

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
    const candidate = path.join(base, 'dist', match[1], match[2]);
    return this.resolve(candidate, importer, { ...options, skipSelf: true });
  },
});

const jsxInJsCompatibilityPlugin = () => ({
  name: 'ce-jsx-in-js-compatibility',
  enforce: 'pre',
  async transform(code, id) {
    const [filePath] = id.split('?');
    if (!filePath.endsWith('.js') || !filePath.startsWith(srcDir)) return null;
    return transformWithEsbuild(code, id, {
      loader: 'jsx',
      jsx: 'automatic',
    });
  },
});

const copyStaticImageAssetsPlugin = () => ({
  name: 'ce-copy-static-image-assets',
  apply: 'build',
  writeBundle(options) {
    const sourceDir = path.resolve(srcDir, 'assets', 'img');
    const outputDir = path.resolve(options.dir || path.resolve(__dirname, 'build'), 'images');
    if (!fs.existsSync(sourceDir)) return;
    fs.cpSync(sourceDir, outputDir, { recursive: true });
  },
});

const publicAssetsCompatibilityPlugin = () => ({
  name: 'ce-public-assets-compatibility',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const assetPath = resolvePublicAssetPath(req.url);
      if (!assetPath) {
        next();
        return;
      }
      const contentType = publicAssetContentTypes[path.extname(assetPath).toLowerCase()];
      if (contentType) res.setHeader('Content-Type', contentType);
      fs.createReadStream(assetPath).pipe(res);
    });
  },
  writeBundle(options) {
    copyDirectoryExcluding(publicDir, options.dir || path.resolve(__dirname, 'build'), new Set(['index.html']));
  },
});

const postsAssetsCompatibilityPlugin = () => ({
  name: 'ce-posts-assets-compatibility',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const assetPath = resolvePostsAssetPath(req.url);
      if (!assetPath) {
        next();
        return;
      }
      const contentType = publicAssetContentTypes[path.extname(assetPath).toLowerCase()];
      if (contentType) res.setHeader('Content-Type', contentType);
      fs.createReadStream(assetPath).pipe(res);
    });
  },
  writeBundle(options) {
    if (!fs.existsSync(postsDir)) return;
    fs.cpSync(postsDir, path.resolve(options.dir || path.resolve(__dirname, 'build'), 'posts'), {
      recursive: true,
    });
  },
});

export default defineConfig(({ mode }) => {
  const clientEnv = readClientEnv(mode);

  return {
    appType: 'spa',
    base: normalizeBase(clientEnv.PUBLIC_URL),
    publicDir: false,
    envPrefix: ['VITE_', 'REACT_APP_', 'NEXT_PUBLIC_'],
    define: {
      'process.env': JSON.stringify(clientEnv),
    },
    plugins: [
      jsxInJsCompatibilityPlugin(),
      react(),
      jsToTsCompatibilityPlugin(),
      litContractsSubpathShim(),
      copyStaticImageAssetsPlugin(),
      publicAssetsCompatibilityPlugin(),
      postsAssetsCompatibilityPlugin(),
      {
        name: 'ce-public-url-html-compatibility',
        transformIndexHtml(html) {
          return html.replace(/__PUBLIC_URL__/g, normalizePublicUrlForHtml(clientEnv.PUBLIC_URL));
        },
      },
    ],
    resolve: {
      alias: [
        { find: 'assets', replacement: path.resolve(srcDir, 'assets') },
        { find: 'components', replacement: path.resolve(srcDir, 'components') },
        { find: 'utilities', replacement: path.resolve(srcDir, 'utilities') },
        { find: 'variables', replacement: path.resolve(srcDir, 'variables') },
        { find: /^@metamask\/superstruct$/, replacement: path.resolve(srcDir, 'shims', 'metamask-superstruct.ts') },
        { find: /^zod-validation-error$/, replacement: path.resolve(__dirname, 'node_modules', 'zod-validation-error', 'dist', 'index.js') },
        { find: /^worker_threads$/, replacement: path.resolve(srcDir, 'shims', 'node-worker-threads.ts') },
        { find: /^node:worker_threads$/, replacement: path.resolve(srcDir, 'shims', 'node-worker-threads.ts') },
        { find: /^source-map-support\/register$/, replacement: path.resolve(srcDir, 'shims', 'source-map-support-register.ts') },
      ],
    },
    server: {
      headers,
    },
    preview: {
      headers,
    },
    css: {
      // Keep PostCSS disabled unless a Vite-specific config is reintroduced.
      // The retired PurgeCSS setup stripped CSS Module selectors before the
      // app could reference their generated class names.
      postcss: { plugins: [] },
      preprocessorOptions: {
        scss: {
          includePaths: [srcDir],
        },
      },
    },
    build: {
      outDir: path.resolve(__dirname, 'build'),
      emptyOutDir: true,
      rollupOptions: {
        input: path.resolve(__dirname, 'index.html'),
        output: {
          manualChunks: resolveManualChunk,
        },
      },
    },
    optimizeDeps: {
      esbuildOptions: {
        loader: {
          '.js': 'jsx',
        },
      },
      include: ['buffer', 'process/browser'],
    },
  };
});
