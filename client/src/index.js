import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { initLogging } from 'utilities/logging.js';
import App from 'components/App';

initLogging({ showGuide: process.env.NODE_ENV !== 'production' });

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
