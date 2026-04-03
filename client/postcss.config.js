module.exports = {
    plugins: [
      // ...your other plugins,
      require('@fullhuman/postcss-purgecss')({
        content: [
          './src/**/*.js',
          './src/**/*.jsx',
          './src/**/*.ts',
          './src/**/*.tsx',
          './public/**/*.html',
        ],
        defaultExtractor: content => content.match(/[\w-/:]+(?<!:)/g) || []
      })
    ]
  };
  