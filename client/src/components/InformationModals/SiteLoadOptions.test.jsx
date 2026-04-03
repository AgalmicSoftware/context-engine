import React from 'react';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import { fireEvent, render, screen } from '@testing-library/react';

import SiteLoadOptions from './SiteLoadOptions.jsx';

jest.mock('./GreetingModal.jsx', () => () => <div data-testid='mock-greeting-modal' />);
jest.mock('utilities/logging.js', () => ({
  createLogger: () => ({
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

const buildStore = () => createStore((state = {
  profile: {
    account: null,
    provider: null,
  },
}) => state);

const noop = () => {};

const renderSiteLoadOptions = (arrowIndex, props = {}) => render(
  <Provider store={buildStore()}>
    <SiteLoadOptions
      arrowIndex={arrowIndex}
      sidebarOpen
      closeSidebarFunction={jest.fn()}
      clickRightArrow={noop}
      clickLeftArrow={noop}
      {...props}
    />
  </Provider>
);

const SidebarHarness = ({ arrowIndex }) => {
  const [sidebarOpen, setSidebarOpen] = React.useState(true);

  return (
    <Provider store={buildStore()}>
      <SiteLoadOptions
        arrowIndex={arrowIndex}
        sidebarOpen={sidebarOpen}
        closeSidebarFunction={() => setSidebarOpen(false)}
        clickRightArrow={noop}
        clickLeftArrow={noop}
      />
    </Provider>
  );
};

describe('SiteLoadOptions', () => {
  it('keeps the intro slide bound to the greeting-image layout hooks', () => {
    renderSiteLoadOptions(0);

    const greetingImage = screen.getByAltText('Context Engine welcome slide');
    const greetingButton = greetingImage.closest('button');

    expect(greetingImage).toBeInTheDocument();
    expect(greetingImage.id).toBe('greetingImage');
    expect(greetingButton?.id).toBe('siteExplainer');
    expect(greetingButton).toHaveAttribute('data-slide-layout', 'flushBottom');
    expect(greetingImage).toHaveAttribute('data-slide-layout', 'flushBottom');
  });

  it('keeps the second slide bound to the centered robot layout hooks', () => {
    renderSiteLoadOptions(1);

    const robotImage = screen.getByAltText('Context Engine toolkit slide');
    const robotButton = robotImage.closest('button');

    expect(screen.getByText(/A toolkit/i)).toBeInTheDocument();
    expect(robotImage).toBeInTheDocument();
    expect(robotImage.id).toBe('betaViewerRobot');
    expect(robotButton?.id).toBe('siteExplainerMultiply');
    expect(robotButton).toHaveAttribute('data-slide-layout', 'centered');
    expect(robotImage).toHaveAttribute('data-slide-layout', 'centered');
  });

  it('removes the unused email updates UI and still lets the sidebar collapse', () => {
    const { container } = render(<SidebarHarness arrowIndex={0} />);

    expect(screen.queryByText(/Get updates/i)).not.toBeInTheDocument();
    expect(container.querySelector('#betaTabSideBar')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ce-site-load-close-sidebar'));

    expect(container.querySelector('#betaSidebarDisappeared')).toBeInTheDocument();
  });
});
