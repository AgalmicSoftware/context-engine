import React from 'react';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import { render, screen } from '@testing-library/react';

import GreetingModal from './GreetingModal.jsx';

jest.mock('utilities/logging.js', () => ({
  createLogger: () => ({
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

jest.mock('reactstrap', () => {
  const React = require('react');

  const wrap = (Tag = 'div') => ({ children, ...props }) => {
    const { check, modalClassName, isOpen, ...rest } = props;

    return <Tag {...rest}>{children}</Tag>;
  };

  return {
    __esModule: true,
    Button: wrap('button'),
    Card: wrap('div'),
    CardHeader: wrap('div'),
    CardBody: wrap('div'),
    CardFooter: wrap('div'),
    Form: wrap('form'),
    FormGroup: wrap('div'),
    Label: wrap('label'),
    Modal: ({ children, isOpen, modalClassName, ...props }) => (isOpen ? <div {...props}>{children}</div> : null),
    Input: (props) => <input {...props} />,
  };
});

const buildStore = () => createStore((state = {
  profile: {
    account: null,
    provider: null,
  },
}) => state);

const renderGreetingModal = (props = {}) => render(
  <Provider store={buildStore()}>
    <GreetingModal
      visible
      closeExplainerFunction={jest.fn()}
      {...props}
    />
  </Provider>
);

describe('GreetingModal', () => {
  it('replaces the legacy placeholder and ownership copy with neutral updates copy', () => {
    renderGreetingModal();

    expect(screen.getByText(/Get updates/i)).toBeInTheDocument();
    expect(screen.getByText(/Feature updates/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('name@example.com')).toBeInTheDocument();
    expect(screen.queryByText(/How to own a % of site/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('lol@memewa.rs')).not.toBeInTheDocument();
  });
});
