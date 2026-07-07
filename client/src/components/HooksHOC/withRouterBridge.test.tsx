import React from 'react';
import { render, screen } from '@testing-library/react';
import { TestMemoryRouter as MemoryRouter } from 'testUtils/TestMemoryRouter';
import withRouter from './withRouterBridge';

describe('withRouterBridge', () => {
  it('injects router params, location, and navigation props', () => {
    const RouteAwareComponent = withRouter(({ params, location, navigate }: any) => (
      <div
        data-testid="router-props"
        data-params={JSON.stringify(params)}
        data-pathname={location.pathname}
        data-has-navigate={String(typeof navigate === 'function')}
      />
    ));

    render(
      <MemoryRouter initialEntries={['/demo-path']}>
        <RouteAwareComponent />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('router-props')).toHaveAttribute('data-params', '{}');
    expect(screen.getByTestId('router-props')).toHaveAttribute('data-pathname', '/demo-path');
    expect(screen.getByTestId('router-props')).toHaveAttribute('data-has-navigate', 'true');
  });
});
