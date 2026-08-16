// SPDX-License-Identifier: MPL-2.0

import fs from 'fs';
import path from 'path';
import React from 'react';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import { fireEvent, render, screen } from '@testing-library/react';

import Footer from './Footer';
import styles from './Footer.module.scss';
import { applyResolvedTheme } from '../../utilities/ui/themeRuntime';

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

const renderFooter = ({ flowAtDocumentEnd = false }: { flowAtDocumentEnd?: boolean } = {}) =>
  render(
    <Provider store={buildStore()}>
      <Footer flowAtDocumentEnd={flowAtDocumentEnd} />
    </Provider>,
  );
const footerStylesheet = fs.readFileSync(path.join(__dirname, 'Footer.module.scss'), 'utf8');

describe('Footer', () => {
  afterEach(() => {
    applyResolvedTheme({ id: 'context-engine', source: 'default' });
  });

  it('renders a NEW link to /new', () => {
    renderFooter();

    const newLink = screen.getByRole('link', { name: 'NEW' });

    expect(newLink).toHaveAttribute('href', '/new');
    expect(newLink).toHaveTextContent('NEW');
  });

  it('renders POSTS immediately after ABOUT', () => {
    const { container } = renderFooter();
    const navItems = Array.from(container.querySelectorAll('nav li'));

    expect(navItems.map((item) => item.textContent?.trim())).toEqual(['NEW', 'ABOUT', 'POSTS', 'SETTINGS', 'DOCS']);
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
      expect(screen.getByRole('link', { name: 'DOCS' })).toHaveAttribute('href', '/ce/docs');
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
      { minWidth: 0, maxWidth: 319, fontSize: 'clamp\\(0\\.56rem, 2\\.75vw, 0\\.68rem\\)' },
      { minWidth: 320, maxWidth: 465, fontSize: 'clamp\\(0\\.62rem, 2\\.45vw, 0\\.78rem\\)' },
      { minWidth: 466, maxWidth: 768, fontSize: 'clamp\\(0\\.9rem, 2\\.25vw, 1\\.08rem\\)' },
    ].forEach(({ minWidth, maxWidth, fontSize }) => {
      const breakpointRule = new RegExp(
        `@media \\(min-width: ${minWidth}px\\) and \\(max-width: ${maxWidth}px\\) \\{[\\s\\S]*?\\.footer \\{[\\s\\S]*?nav \\{[\\s\\S]*?width: 100%;[\\s\\S]*?ul \\{[\\s\\S]*?display: grid;[\\s\\S]*?grid-template-columns: repeat\\(${columns}, minmax\\(0, 1fr\\)\\);[\\s\\S]*?justify-content: stretch;[\\s\\S]*?width: 100%;[\\s\\S]*?li \\{[\\s\\S]*?width: 100%;[\\s\\S]*?li \\.footerLink \\{[\\s\\S]*?display: flex;[\\s\\S]*?font-size: ${fontSize};[\\s\\S]*?justify-content: center;[\\s\\S]*?width: 100%;`,
      );

      expect(footerStylesheet).toMatch(breakpointRule);
    });
  });

  it('uses theme-owned footer text density in the full-screen layout', () => {
    expect(footerStylesheet).toMatch(
      /@media \(min-width:\s*1367px\)\s*{[\s\S]*?\.footer\s*{[\s\S]*?\.copyright\s*{[\s\S]*?font-size:\s*var\(--ce-footer-copyright-font-size-wide\);/,
    );
    expect(footerStylesheet).toMatch(
      /@media \(min-width:\s*1367px\)\s*{[\s\S]*?\.footer\s*{[\s\S]*?nav\s*{[\s\S]*?ul\s*{[\s\S]*?li \.footerLink\s*{[\s\S]*?font-size:\s*var\(--ce-footer-link-font-size-wide\);/,
    );
    expect(footerStylesheet).toMatch(
      /@media \(min-width:\s*1367px\)\s*{[\s\S]*?\.footerLink\s*{[\s\S]*?font-size:\s*var\(--ce-footer-link-font-size-wide\);/,
    );
  });

  it('keeps desktop footer nav links as large as the attribution text', () => {
    expect(footerStylesheet).toMatch(
      /@media \(min-width:\s*769px\) and \(max-width:\s*1366px\)\s*{[\s\S]*?\.footer\s*{[\s\S]*?\.copyright\s*{[\s\S]*?font-family:\s*inherit;/,
    );
    expect(footerStylesheet).toMatch(
      /@media \(min-width:\s*769px\) and \(max-width:\s*1366px\)\s*{[\s\S]*?\.footer\s*{[\s\S]*?nav\s*{[\s\S]*?ul\s*{[\s\S]*?li \.footerLink\s*{[\s\S]*?font-size:\s*var\(--ce-footer-link-font-size\);/,
    );
  });

  it('uses theme-owned button chrome for footer navigation links', () => {
    expect(footerStylesheet).toMatch(
      /\.footer \.footerLink\s*{[\s\S]*?background:\s*var\(--ce-footer-link-bg\);[\s\S]*?border-color:\s*var\(--ce-footer-link-border\);[\s\S]*?border-width:\s*var\(--ce-footer-link-border-width\);[\s\S]*?box-shadow:\s*var\(--ce-footer-link-shadow\);[\s\S]*?color:\s*var\(--ce-footer-link-text\);/,
    );
    expect(footerStylesheet).toMatch(
      /\.footer \.footerLink:hover,[\s\S]*?\.footer \.footerLink:focus-visible\s*{[\s\S]*?background:\s*var\(--ce-footer-link-hover-bg\);[\s\S]*?box-shadow:\s*var\(--ce-footer-link-hover-shadow\);/,
    );
    expect(footerStylesheet).toMatch(
      /\.footer \.footerLink:active\s*{[\s\S]*?border-color:\s*var\(--ce-footer-link-active-border\);[\s\S]*?box-shadow:\s*var\(--ce-footer-link-active-shadow\);/,
    );
  });

  it('uses theme-owned desktop taskbar density and left alignment', () => {
    const themeContract = fs.readFileSync(path.resolve(__dirname, '../../scss/themes/_contract.scss'), 'utf8');
    const contextTheme = fs.readFileSync(path.resolve(__dirname, '../../scss/themes/_context-engine.scss'), 'utf8');
    const classicTheme = fs.readFileSync(path.resolve(__dirname, '../../scss/themes/_classic-95.scss'), 'utf8');

    expect(footerStylesheet).toMatch(
      /@media \(min-width:\s*769px\) and \(max-width:\s*1366px\)\s*{[\s\S]*?\.footer\s*{[\s\S]*?padding:\s*var\(--ce-footer-bar-padding\);[\s\S]*?nav\s*{[\s\S]*?ul\s*{[\s\S]*?display:\s*flex;[\s\S]*?gap:\s*var\(--ce-footer-link-gap\);[\s\S]*?line-height:\s*1;[\s\S]*?li \.footerLink\s*{[\s\S]*?min-height:\s*var\(--ce-footer-link-height\);[\s\S]*?margin:\s*0 var\(--ce-footer-link-margin-x\) !important;[\s\S]*?padding:\s*0 var\(--ce-footer-link-padding-x\);/,
    );
    expect(themeContract).toContain('footer-bar-padding,');
    expect(themeContract).toContain('footer-link-height,');
    expect(contextTheme).toContain('footer-bar-padding: 0 1.5em,');
    expect(contextTheme).toContain('footer-link-height: 50px,');
    expect(classicTheme).toContain('footer-bar-padding: 2px 0,');
    expect(classicTheme).toContain('footer-link-height: 32px,');
    expect(classicTheme).toContain('footer-link-margin-x: 0,');
    expect(classicTheme).toContain('footer-link-font-size: 0.78rem,');
  });

  it('keeps the classic taskbar at the document end instead of overlaying page content', () => {
    expect(footerStylesheet).toContain('@container ce-theme style(--ce-layout-profile: desktop-window)');
    expect(footerStylesheet).not.toContain('data-ce-theme');
    expect(footerStylesheet).toMatch(
      /:global\(#root\)\s*{[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*column;[\s\S]*?min-height:\s*100vh;/,
    );
    expect(footerStylesheet).toMatch(
      /\.footer\s*{[\s\S]*?position:\s*relative;[\s\S]*?width:\s*100%;[\s\S]*?margin-top:\s*auto;[\s\S]*?background:\s*var\(--ce-control-face\);/,
    );
    expect(footerStylesheet).not.toMatch(/@container ce-theme style\(--ce-layout-profile:\s*desktop-window\)[\s\S]*?position:\s*fixed;/);
    expect(footerStylesheet).not.toMatch(/:global\(body\)\s*{[\s\S]*?padding-bottom:\s*42px;/);
  });

  it('places the session footer at the document end with the same non-overlaying classic taskbar', () => {
    const { container } = renderFooter({ flowAtDocumentEnd: true });
    const footer = container.querySelector('footer');

    expect(footer).toHaveAttribute('data-ce-footer-placement', 'document-end');
    expect(footer).toHaveClass(styles.footerDocumentEnd);
    expect(footerStylesheet).toMatch(
      /\.footer\.footerDocumentEnd\s*{[\s\S]*?position:\s*relative;[\s\S]*?width:\s*100%;[\s\S]*?margin-top:\s*auto;/,
    );
  });

  it('moves classic footer routes behind an accessible Start menu while preserving default navigation', () => {
    applyResolvedTheme({ id: 'classic-95', source: 'user' });
    renderFooter();

    const startButton = screen.getByTestId('ce-footer-start-button');
    const startMenu = screen.getByTestId('ce-footer-start-menu');

    expect(startButton).toBeVisible();
    expect(startButton).toHaveAccessibleName('Open Start menu');
    expect(startButton).not.toHaveTextContent('Start');
    expect(startButton).toHaveAttribute('aria-expanded', 'false');
    expect(startMenu).not.toBeVisible();

    expect(footerStylesheet).toMatch(
      /\.startButton\s*{[\s\S]*?width:\s*36px;[\s\S]*?min-width:\s*36px;[\s\S]*?padding:\s*0;/,
    );

    fireEvent.click(startButton);

    expect(startButton).toHaveAttribute('aria-expanded', 'true');
    expect(startMenu).toBeVisible();
    expect(screen.getByRole('menuitem', { name: 'NEW' })).toHaveAttribute('href', '/new');
    expect(screen.getByRole('menuitem', { name: 'ABOUT' })).toHaveAttribute('href', '/about');
    expect(screen.getByRole('menuitem', { name: 'POSTS' })).toHaveAttribute('href', '/posts');
    expect(screen.getByRole('menuitem', { name: 'SETTINGS' })).toBeVisible();
    expect(screen.getByRole('menuitem', { name: 'DOCS' })).toHaveAttribute('href', '/docs');

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(startButton).toHaveAttribute('aria-expanded', 'false');
    expect(startMenu).not.toBeVisible();
    expect(startButton).toHaveFocus();
  });

  it('keeps the default Context Engine footer links visible without exposing the Start control', () => {
    renderFooter();

    expect(screen.getByTestId('ce-footer-start-button')).not.toBeVisible();
    expect(screen.getByTestId('ce-footer-start-menu')).toBeVisible();
    expect(screen.getByRole('link', { name: 'NEW' })).toHaveAttribute('href', '/new');
  });

  it('reduces classic footer branding to a larger GitHub icon without changing the default attribution', () => {
    expect(footerStylesheet).toMatch(
      /@container ce-theme style\(--ce-layout-profile:\s*desktop-window\)\s*{[\s\S]*?\.copyrightText\s*{[\s\S]*?display:\s*none;/,
    );
    expect(footerStylesheet).toMatch(
      /@container ce-theme style\(--ce-layout-profile:\s*desktop-window\)\s*{[\s\S]*?\.githubLink\s*{[\s\S]*?font-size:\s*1\.5rem;[\s\S]*?opacity:\s*1;/,
    );
    expect(footerStylesheet).not.toMatch(/^\.copyrightText\s*{[\s\S]*?display:\s*none;/m);
  });
});
