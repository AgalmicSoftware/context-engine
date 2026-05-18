import fs from 'fs';
import path from 'path';
import React from 'react';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import { render, screen } from '@testing-library/react';

import Footer from './Footer';

jest.mock('../../actions/sessionStateActions.js', () => ({
  changeFocusedTab: jest.fn(() => ({ type: 'CHANGE_FOCUSED_TAB' })),
  toggleLoginModal: jest.fn(() => ({ type: 'TOGGLE_LOGIN_MODAL' })),
}));

const buildStore = () => createStore((state = {
  sessionState: {
    focusedTab: 0,
    loginModalToggled: false,
  },
}) => state);

const renderFooter = () => render(
  <Provider store={buildStore()}>
    <Footer />
  </Provider>
);
const footerStylesheet = fs.readFileSync(path.join(__dirname, 'Footer.module.scss'), 'utf8');

describe('Footer', () => {
  it('renders a NEW link to /new', () => {
    renderFooter();

    const newLink = screen.getByRole('link', { name: 'NEW' });

    expect(newLink).toHaveAttribute('href', '/new');
    expect(newLink).toHaveTextContent('NEW');
  });

  it('renders internal links under the configured PUBLIC_URL base path', () => {
    const previousPublicUrl = process.env.PUBLIC_URL;
    process.env.PUBLIC_URL = '/ce';
    try {
      renderFooter();

      expect(screen.getByRole('link', { name: 'NEW' })).toHaveAttribute('href', '/ce/new');
      expect(screen.getByRole('link', { name: 'ABOUT' })).toHaveAttribute('href', '/ce/about');
      expect(screen.getByRole('link', { name: 'CONTRACTS' })).toHaveAttribute('href', '/ce/contracts');
      expect(screen.getByTestId('ce-footer-link-github')).toHaveAttribute(
        'href',
        'https://github.com/AgalmicSoftware/context-engine'
      );
    } finally {
      if (previousPublicUrl === undefined) {
        delete process.env.PUBLIC_URL;
      } else {
        process.env.PUBLIC_URL = previousPublicUrl;
      }
    }
  });

  it('renders the CPAL attribution text with a separate GitHub icon link', () => {
    renderFooter();

    const attributionLink = screen.getByTestId('ce-footer-cpal-attribution');
    const githubLink = screen.getByTestId('ce-footer-link-github');

    expect(attributionLink).toHaveTextContent('Software by Agalmic');
    expect(attributionLink.tagName).toBe('SPAN');
    expect(githubLink).toHaveAttribute(
      'href',
      'https://github.com/AgalmicSoftware/context-engine'
    );
    expect(githubLink).toHaveAttribute('target', '_blank');
    expect(githubLink).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.queryByTestId('ce-footer-cpal-link')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ce-footer-agalmic-link')).not.toBeInTheDocument();
  });

  it('centers the footer nav list across the mobile breakpoints', () => {
    [
      { minWidth: 0, maxWidth: 319 },
      { minWidth: 320, maxWidth: 465 },
      { minWidth: 466, maxWidth: 768 },
    ].forEach(({ minWidth, maxWidth }) => {
      const breakpointRule = new RegExp(
        `@media \\(min-width: ${minWidth}px\\) and \\(max-width: ${maxWidth}px\\) \\{[\\s\\S]*?#footer \\{[\\s\\S]*?nav \\{[\\s\\S]*?width: 100%;[\\s\\S]*?ul \\{[\\s\\S]*?display: flex;[\\s\\S]*?justify-content: center;[\\s\\S]*?align-items: center;[\\s\\S]*?flex-wrap: wrap;[\\s\\S]*?width: 100%;`,
      );

      expect(footerStylesheet).toMatch(breakpointRule);
    });
  });
});
