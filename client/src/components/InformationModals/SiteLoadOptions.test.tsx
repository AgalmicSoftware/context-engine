import React from 'react';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import { fireEvent, render, screen } from '@testing-library/react';

import SiteLoadOptions from './SiteLoadOptions';

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
      <SiteLoadOptions arrowIndex={arrowIndex} clickRightArrow={noop} clickLeftArrow={noop} {...props} />
    </Provider>,
  );

describe('SiteLoadOptions', () => {
  it('keeps the intro slide bound to the greeting-image layout hooks', () => {
    renderSiteLoadOptions(0);

    const greetingImage = screen.getByAltText('Context Engine welcome slide');
    const greetingButton = screen.getByTestId('ce-welcome-slide-media');
    const greetingFooter = greetingButton.closest('.welcomeSlideFooter');

    expect(greetingImage).toBeInTheDocument();
    expect(greetingFooter).toBeInTheDocument();
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

  it('advances from the intro image without a sidebar or metrics panel', () => {
    const clickRightArrow = jest.fn();
    renderSiteLoadOptions(0, { clickRightArrow });
    expect(screen.queryByTestId('ce-site-load-sidebar')).not.toBeInTheDocument();
    expect(screen.queryByText(/Metrics:/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('ce-welcome-slide-media'));
    expect(clickRightArrow).toHaveBeenCalledTimes(1);
  });
});
