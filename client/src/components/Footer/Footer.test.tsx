// SPDX-License-Identifier: MPL-2.0

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

const buildStore = () =>
  createStore(
    (
      state = {
        sessionState: {
          focusedTab: 0,
          loginModalToggled: false,
        },
      },
    ) => state,
  );

const renderFooter = () =>
  render(
    <Provider store={buildStore()}>
      <Footer />
    </Provider>,
  );
const footerStylesheet = fs.readFileSync(path.join(__dirname, 'Footer.module.scss'), 'utf8');

describe('Footer', () => {
  it('renders a NEW link to /new', () => {
    renderFooter();

    const newLink = screen.getByRole('link', { name: 'NEW' });

    expect(newLink).toHaveAttribute('href', '/new');
    expect(newLink).toHaveTextContent('NEW');
  });

  it('renders POSTS immediately after ABOUT', () => {
    const { container } = renderFooter();
    const navItems = Array.from(container.querySelectorAll('nav li'));

    expect(navItems.map((item) => item.textContent?.trim())).toEqual([
      'NEW',
      'ABOUT',
      'POSTS',
      'SETTINGS',
      'CONTRACTS',
    ]);
    expect(screen.getByRole('link', { name: 'POSTS' })).toHaveAttribute('href', '/posts');
  });

  it('renders internal links under the configured PUBLIC_URL base path', () => {
    const previousPublicUrl = process.env.PUBLIC_URL;
    process.env.PUBLIC_URL = '/ce';
    try {
      renderFooter();

      expect(screen.getByRole('link', { name: 'NEW' })).toHaveAttribute('href', '/ce/new');
      expect(screen.getByRole('link', { name: 'ABOUT' })).toHaveAttribute('href', '/ce/about');
      expect(screen.getByRole('link', { name: 'POSTS' })).toHaveAttribute('href', '/ce/posts');
      expect(screen.getByRole('link', { name: 'CONTRACTS' })).toHaveAttribute('href', '/ce/contracts');
      expect(screen.getByTestId('ce-footer-link-github')).toHaveAttribute(
        'href',
        'https://github.com/AgalmicSoftware/context-engine',
      );
    } finally {
      if (previousPublicUrl === undefined) {
        delete process.env.PUBLIC_URL;
      } else {
        process.env.PUBLIC_URL = previousPublicUrl;
      }
    }
  });

  it('renders the footer attribution text with a separate GitHub icon link', () => {
    renderFooter();

    const attributionLink = screen.getByTestId('ce-footer-brand-attribution');
    const githubLink = screen.getByTestId('ce-footer-link-github');

    expect(attributionLink).toHaveTextContent('Software by Agalmic');
    expect(attributionLink.tagName).toBe('SPAN');
    expect(githubLink).toHaveAttribute('href', 'https://github.com/AgalmicSoftware/context-engine');
    expect(githubLink).toHaveAttribute('target', '_blank');
    expect(githubLink).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.queryByTestId('ce-footer-brand-link')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ce-footer-agalmic-link')).not.toBeInTheDocument();
  });

  it('uses full-width readable footer nav links across the mobile breakpoints', () => {
    [
      { minWidth: 0, maxWidth: 319, columns: 2, fontSize: 'clamp\\(0\\.9rem, 5\\.4vw, 1\\.08rem\\)' },
      { minWidth: 320, maxWidth: 465, columns: 3, fontSize: 'clamp\\(0\\.86rem, 3\\.05vw, 1\\.08rem\\)' },
      { minWidth: 466, maxWidth: 768, columns: 3, fontSize: 'clamp\\(1rem, 2\\.4vw, 1\\.22rem\\)' },
    ].forEach(({ minWidth, maxWidth, columns, fontSize }) => {
      const breakpointRule = new RegExp(
        `@media \\(min-width: ${minWidth}px\\) and \\(max-width: ${maxWidth}px\\) \\{[\\s\\S]*?\\.footer \\{[\\s\\S]*?nav \\{[\\s\\S]*?width: 100%;[\\s\\S]*?ul \\{[\\s\\S]*?display: grid;[\\s\\S]*?grid-template-columns: repeat\\(${columns}, minmax\\(0, 1fr\\)\\);[\\s\\S]*?justify-content: stretch;[\\s\\S]*?width: 100%;[\\s\\S]*?li \\{[\\s\\S]*?width: 100%;[\\s\\S]*?li \\.footerLink \\{[\\s\\S]*?display: flex;[\\s\\S]*?font-size: ${fontSize};[\\s\\S]*?justify-content: center;[\\s\\S]*?width: 100%;`,
      );

      expect(footerStylesheet).toMatch(breakpointRule);
    });
  });

  it('uses larger footer text in the full-screen layout', () => {
    expect(footerStylesheet).toMatch(
      /@media \(min-width:\s*1367px\)\s*{[\s\S]*?\.footer\s*{[\s\S]*?\.copyright\s*{[\s\S]*?font-size:\s*1\.18rem;/,
    );
    expect(footerStylesheet).toMatch(
      /@media \(min-width:\s*1367px\)\s*{[\s\S]*?\.footer\s*{[\s\S]*?nav\s*{[\s\S]*?ul\s*{[\s\S]*?li \.footerLink\s*{[\s\S]*?font-size:\s*1\.18rem;/,
    );
    expect(footerStylesheet).toMatch(
      /@media \(min-width:\s*1367px\)\s*{[\s\S]*?\.footerLink\s*{[\s\S]*?font-size:\s*1\.18rem;/,
    );
  });

  it('keeps desktop footer nav links as large as the attribution text', () => {
    expect(footerStylesheet).toMatch(
      /@media \(min-width:\s*769px\) and \(max-width:\s*1366px\)\s*{[\s\S]*?\.footer\s*{[\s\S]*?\.copyright\s*{[\s\S]*?font-family:\s*inherit;/,
    );
    expect(footerStylesheet).toMatch(
      /@media \(min-width:\s*769px\) and \(max-width:\s*1366px\)\s*{[\s\S]*?\.footer\s*{[\s\S]*?nav\s*{[\s\S]*?ul\s*{[\s\S]*?li \.footerLink\s*{[\s\S]*?font-size:\s*1rem;/,
    );
  });
});
