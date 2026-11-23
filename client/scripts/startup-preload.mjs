// The page's first script asks for the app, and the app asks for its main part: three round trips, one after
// another, before anything shows. The built page names those files itself, so they download together from the
// start. Each link carries its file's size, which public/boot-watchdog.js adds up to show how far the load is.
const STARTS = [/\/src\/index\.tsx$/, /\/src\/components\/MainSite\/AppShell\.tsx$/];

export const addStartupPreloads = (html, { bundle, entryFileName }) => {
  const base = (html.match(/<script type="module"[^>]* src="([^"]*\/)assets\//) || [])[1] || '/';
  const files = new Set();
  const styles = new Set();
  const add = (fileName) => {
    const chunk = bundle[fileName];
    if (!chunk || chunk.type !== 'chunk' || files.has(fileName)) return;
    files.add(fileName);
    (chunk.viteMetadata?.importedCss || []).forEach((css) => styles.add(css));
    chunk.imports.forEach(add);
  };
  if (entryFileName) add(entryFileName);
  // The first script's own styles are already a stylesheet link in the page.
  const entryStyles = new Set(styles);
  Object.values(bundle)
    // A chunk is known by the source file it holds: a part loaded on demand has no name of its own here.
    .filter(
      (chunk) =>
        chunk.type === 'chunk' && Object.keys(chunk.modules || {}).some((id) => STARTS.some((start) => start.test(id))),
    )
    .forEach((chunk) => add(chunk.fileName));
  const bytes = (fileName) => Buffer.byteLength(bundle[fileName].code);
  // Vite's own tags for the first script and its imports get their sizes too.
  const sized = html.replace(
    /<(script type="module"|link rel="modulepreload")([^>]*?(?:src|href)="[^"]*\/(assets\/[^"]+)")/g,
    (tag, kind, rest, fileName) => (files.has(fileName) ? `<${kind} data-ce-bytes="${bytes(fileName)}"${rest}` : tag),
  );
  const tags = [
    ...[...files]
      .filter((fileName) => !sized.includes(`${base}${fileName}"`))
      .map(
        (fileName) =>
          `<link rel="modulepreload" data-ce-bytes="${bytes(fileName)}" crossorigin href="${base}${fileName}">`,
      ),
    ...[...styles]
      .filter((css) => !entryStyles.has(css))
      .map((css) => `<link rel="preload" as="style" href="${base}${css}">`),
  ];
  return tags.length ? sized.replace('</head>', `  ${tags.join('\n    ')}\n  </head>`) : sized;
};

export const startupPreloadPlugin = () => ({
  name: 'ce-startup-preload',
  apply: 'build',
  transformIndexHtml: {
    enforce: 'post',
    transform: (html, ctx) =>
      ctx.bundle ? addStartupPreloads(html, { bundle: ctx.bundle, entryFileName: ctx.chunk?.fileName }) : html,
  },
});
