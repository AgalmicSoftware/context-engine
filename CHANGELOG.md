# Changelog

All notable changes to this project will be documented in this file.

## 2026-04-06

### Completed TODOs

- PRD 383: removed unused client dependencies `react-copy-to-clipboard`, `react-iframe`, `react-moment`, `fetchival`, `html-react-parser`, `papaparse`, `react-tooltip`, and `request`; regenerated `client/package-lock.json`; verified the production client build on Node 20.

### Remaining TODOs

- PRD 378 / PRD 382: complete the higher-risk peer-dependency cleanup still needed for clean no-flags `cd client && npm install`, especially `react-rangeslider`, `react-select`, and `reactstrap`.
