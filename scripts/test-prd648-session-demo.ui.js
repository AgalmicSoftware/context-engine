'use strict';

const { compactSmokeSummary, runSmoke } = require('./vite-navigation-smoke');

runSmoke({
  routes: ['/session/demo'],
  expectedText: {
    '/session/demo': ['Context Engine', 'View Results'],
  },
})
  .then((summary) => {
    const output = process.env.SMOKE_VERBOSE === '1' || summary.failures.length
      ? summary
      : compactSmokeSummary(summary);
    console.log(JSON.stringify(output, null, 2));
    if (summary.failures.length) {
      process.exitCode = 1;
    }
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
