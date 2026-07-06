import React from 'react';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import { render, screen } from '@testing-library/react';

import GreetingModal from './GreetingModal';

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

  const wrap = (Tag = 'div') => ({ children, ...props }: any) => {
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
    Modal: ({ children, isOpen, modalClassName, ...props }: any) => (isOpen ? <div {...props}>{children}</div> : null),
    Input: (props: any) => <input {...props} />,
  };
});

const buildStore = () => createStore((state = {
  profile: {
    account: null,
    provider: null,
  },
}) => state);

const renderGreetingModal = (props: Record<string, unknown> = {}) => render(
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
    expect(screen.getByPlaceholderText('[redacted-email]')).toBeInTheDocument();
    expect(screen.queryByText(/How to own a % of site/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('[redacted-email]')).not.toBeInTheDocument();
  });
});
