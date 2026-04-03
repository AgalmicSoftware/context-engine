import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter } from 'react-router-dom';
import { initLogging } from 'utilities/logging.js';

// styles
import "assets/css/contextEngine.scss";

// views
import App from 'components/App.jsx';

initLogging({ showGuide: process.env.NODE_ENV !== 'production' });

ReactDOM.render(
  <BrowserRouter>
   <App />
  </BrowserRouter>,
  document.getElementById('root'),
);
