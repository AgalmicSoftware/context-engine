/** @file webpack.js */
/*
   ------------------------------------------------------------------
   Adds raw-loader support for `.txt` so prompt files can be imported
   as plain strings (e.g. `import prompt from './seedGenPrompt.txt'`).
   ------------------------------------------------------------------ */

const solidityLoaderOptions = {};               // customise if needed

module.exports = {
  /* ───────────────── Solidity (.sol) ──────────────────────────── */
  solidityLoader: {
    test: /\.sol$/,
    use: [
      { loader: 'json-loader' },
      {
        loader: '@openzeppelin/solidity-loader',
        options: solidityLoaderOptions,
      },
    ],
  },

  /* ───────────────── HTML templates (.html) ───────────────────── */
  htmlLoader: {
    test: /\.html$/,
    use: 'raw-loader',
  },

  /* ───────────────── Plain-text assets (.txt) ─────────────────── */
  textLoader: {
    test: /\.txt$/i,          // match *.txt case-insensitively
    use: 'raw-loader',        // delivers file contents as a string
  },

  /*  Export shared options (unchanged)  */
  solidityLoaderOptions,
};
