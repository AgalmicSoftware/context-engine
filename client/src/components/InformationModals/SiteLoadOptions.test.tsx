import React from 'react';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import { fireEvent, render, screen } from '@testing-library/react';

import SiteLoadOptions from './SiteLoadOptions';

jest.mock('./GreetingModal', () => () => <div data-testid="mock-greeting-modal" />);
jest.mock('utilities/logging.js', () => ({
  createLogger: () => ({
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

const buildStore = () =>
  createStore(
    (
      state = {
        profile: {
          account: null,
          provider: null,
        },
      },
    ) => state,
  );

const noop = () => {};

const renderSiteLoadOptions = (arrowIndex: number, props: Record<string, unknown> = {}) =>
  render(
    <Provider store={buildStore()}>
      <SiteLoadOptions
        arrowIndex={arrowIndex}
        sidebarOpen
        closeSidebarFunction={jest.fn()}
        clickRightArrow={noop}
        clickLeftArrow={noop}
        {...props}
      />
    </Provider>,
  );

const SidebarHarness = ({ arrowIndex }: { arrowIndex: number }) => {
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
    const greetingButton = screen.getByTestId('ce-welcome-slide-media');

    expect(greetingImage).toBeInTheDocument();
    expect(greetingImage).toHaveClass('welcomeSlideImageIntro');
    expect(greetingButton).toHaveClass('welcomeSlideMediaButton');
    expect(greetingButton).not.toHaveClass('welcomeSlideMediaButtonCentered');
    expect(greetingButton).toHaveAttribute('data-ce-control-appearance', 'frameless');
    expect(greetingButton).toHaveAttribute('data-slide-layout', 'flushBottom');
    expect(greetingImage).toHaveAttribute('data-slide-layout', 'flushBottom');
  });

  it('centers bullet content for titleless slides and dims only the trailing copy', () => {
    renderSiteLoadOptions(1);

    const robotImage = screen.getByAltText('Context Engine toolkit slide');
    const robotButton = screen.getByTestId('ce-welcome-slide-media');
    const bulletListContainer = screen.getByTestId('ce-welcome-slide-bullet-list');
    const bulletList = screen.getByTestId('ce-welcome-slide-bullet-items');
    const firstBoldText = screen.getByText('A toolkit', { selector: 'strong' });
    const firstTrailingText = screen.getByText('for large-group discourse and coordination', { selector: 'span' });

    expect(robotImage).toBeInTheDocument();
    expect(robotImage).toHaveClass('welcomeSlideImageToolkit');
    expect(robotButton).toHaveClass('welcomeSlideMediaButtonCentered');
    expect(robotButton).toHaveAttribute('data-ce-control-appearance', 'frameless');
    expect(robotButton).toHaveAttribute('data-slide-layout', 'centered');
    expect(robotImage).toHaveAttribute('data-slide-layout', 'centered');
    expect(bulletListContainer).toHaveClass('isTitlelessBulletList');
    expect(firstBoldText).toBeInTheDocument();
    expect(firstTrailingText).toHaveClass('welcomeSlideBulletTrailingText');
    expect(bulletList).not.toHaveClass('isTitlelessBulletList');
  });

  it('leaves titled slides on the existing bullet alignment', () => {
    renderSiteLoadOptions(2);

    const bulletListContainer = screen.getByTestId('ce-welcome-slide-bullet-list');
    const bulletList = screen.getByTestId('ce-welcome-slide-bullet-items');

    expect(screen.getByText(/Open-source templates/i)).toBeInTheDocument();
    expect(bulletListContainer).not.toHaveClass('isTitlelessBulletList');
    expect(bulletList).toHaveClass('welcomeSlideBulletItems');
  });

  it('removes the unused email updates UI and still lets the sidebar collapse', () => {
    const { container } = render(<SidebarHarness arrowIndex={0} />);

    expect(screen.queryByText(/Get updates/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('ce-site-load-sidebar')).toHaveClass('welcomeSlideSidebar');
    expect(screen.getByTestId('ce-site-load-close-sidebar')).not.toHaveAttribute('data-dismiss');
    expect(container.querySelectorAll('[data-dismiss="modal"]')).toHaveLength(0);

    fireEvent.click(screen.getByTestId('ce-site-load-close-sidebar'));

    expect(screen.getByTestId('ce-site-load-sidebar')).toHaveClass('isSidebarCollapsed');
  });
});
