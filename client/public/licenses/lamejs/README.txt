MP3 downloads use @breezystack/lamejs 1.2.7, based on LAME.
Copyright Alex Zhukov and the LAME contributors; individual source files
retain their original notices. Library license: LGPL-3.0. No library changes.
Project-authored application code and integration remain MPL-2.0.

Full license texts: LGPL-3.0.txt and GPL-3.0.txt (beside this file).
Upstream notice: UPSTREAM-NOTICE.txt
LAME: https://lame.sourceforge.net/
Library: https://github.com/shijinyu/lamejs
Exact npm source commit: 1fb0ef5fa177413107e2e107d054a9b994e3f79c
Corresponding source: source-1.2.7.tar.gz (beside this file)
Archive SHA-256: 1f67601fedb538ad30fab0aeb2015c66f75ed3ce2cb4b0918c45836d83b5d087

The source archive includes the preferred JavaScript sources, build scripts,
package.json and pnpm lockfile. Extract it, install its build dependencies,
then run npm run build to rebuild the library. The published package used by
this application is pinned with integrity in client/package-lock.json.

You may modify and replace this library and reverse engineer the combined
work to debug those modifications. To recombine: obtain this application's
MPL source from https://github.com/AgalmicSoftware/context-engine, install
client dependencies with npm ci in client/, replace the installed package's
dist/lamejs.js with your rebuilt library, then npm run build in client/.
Serve the resulting client/build directory with SPA routing. The encoder is
compiled into a dedicated Web Worker and is fetched only for audio export.
The application build scripts and encoder integration source are available
in that repository. No signing key or private credential is needed to rebuild
or run your modified browser client.
