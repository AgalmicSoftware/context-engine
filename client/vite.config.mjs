import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, transformWithEsbuild } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, 'src');
const publicDir = path.resolve(__dirname, 'public');
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
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
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

const readClientEnv = (mode) => {
  const loadedEnv = loadEnv(mode, __dirname, ['REACT_APP_', 'PUBLIC_URL']);
  const reactAppEnv = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => key.startsWith('REACT_APP_'))
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

const rawLoaderCompatibilityPlugin = () => ({
  name: 'ce-raw-loader-compatibility',
  enforce: 'pre',
  resolveId(source, importer) {
    const prefix = '!!raw-loader!';
    if (!source.startsWith(prefix)) return null;
    const request = source.slice(prefix.length);
    const baseDir = importer ? path.dirname(importer) : __dirname;
    return `\0ce-raw-loader:${path.resolve(baseDir, request)}`;
  },
  load(id) {
    const prefix = '\0ce-raw-loader:';
    if (!id.startsWith(prefix)) return null;
    const filePath = id.slice(prefix.length);
    return `export default ${JSON.stringify(fs.readFileSync(filePath, 'utf8'))};`;
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

export default defineConfig(({ mode }) => {
  const clientEnv = readClientEnv(mode);

  return {
    appType: 'spa',
    base: normalizeBase(clientEnv.PUBLIC_URL),
    publicDir: false,
    envPrefix: ['VITE_', 'REACT_APP_'],
    define: {
      'process.env': JSON.stringify(clientEnv),
    },
    plugins: [
      jsxInJsCompatibilityPlugin(),
      react(),
      jsToTsCompatibilityPlugin(),
      litContractsSubpathShim(),
      rawLoaderCompatibilityPlugin(),
      copyStaticImageAssetsPlugin(),
      publicAssetsCompatibilityPlugin(),
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
        { find: /^@metamask\/superstruct$/, replacement: path.resolve(srcDir, 'shims', 'metamask-superstruct.js') },
        { find: /^zod-validation-error$/, replacement: path.resolve(__dirname, 'node_modules', 'zod-validation-error', 'dist', 'index.js') },
        { find: /^worker_threads$/, replacement: path.resolve(srcDir, 'shims', 'node-worker-threads.js') },
        { find: /^node:worker_threads$/, replacement: path.resolve(srcDir, 'shims', 'node-worker-threads.js') },
        { find: /^source-map-support\/register$/, replacement: path.resolve(srcDir, 'shims', 'source-map-support-register.js') },
      ],
    },
    server: {
      headers,
    },
    preview: {
      headers,
    },
    css: {
      // The legacy PostCSS config runs PurgeCSS. Vite loads it during dev/build,
      // which strips CSS Module selectors before the app can reference their
      // generated class names.
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
