import React from 'react';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import { render, screen } from '@testing-library/react';

import Footer from './Footer.jsx';

jest.mock('../../actions/sessionStateActions.js', () => ({
  changeFocusedTab: jest.fn(() => ({ type: 'CHANGE_FOCUSED_TAB' })),
  toggleLoginModal: jest.fn(() => ({ type: 'TOGGLE_LOGIN_MODAL' })),
  toggleSettingsModal: jest.fn(() => ({ type: 'TOGGLE_SETTINGS_MODAL' })),
}));

const buildStore = () => createStore((state = {
  sessionState: {
    focusedTab: 0,
    loginModalToggled: false,
    settingsModalToggled: false,
  },
}) => state);

const renderFooter = () => render(
  <Provider store={buildStore()}>
    <Footer />
  </Provider>
);

describe('Footer', () => {
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
});
