import { act, render, screen } from '@testing-library/react';
import PileQuestionPrompt from './PileQuestionPrompt';

describe('PileQuestionPrompt', () => {
  let resize: () => void;
  let mobile: boolean;
  let availableHeight: number;
  let textLines: number;
  const disconnect = jest.fn();
  const mediaListener = jest.fn();
  const originalResizeObserver = global.ResizeObserver;
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    mobile = true;
    availableHeight = 90;
    textLines = 4;
    document.documentElement.style.fontSize = '16px';
    Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: () => ({
      get matches() { return mobile; },
      addEventListener: mediaListener,
      removeEventListener: jest.fn(),
    }) });
    Object.defineProperty(global, 'ResizeObserver', { configurable: true, writable: true, value: jest.fn((callback) => {
      resize = callback;
      return { observe: jest.fn(), disconnect };
    }) });
    jest.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(() => availableHeight);
    jest.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
      const title = this.querySelector<HTMLElement>('#questionTitle');
      return textLines * parseFloat(title?.style.fontSize || '24');
    });
    const readStyle = window.getComputedStyle;
    jest.spyOn(window, 'getComputedStyle').mockImplementation(element => {
      const style = readStyle(element);
      if (element.id === 'questionTitle' && !style.fontSize) {
        Object.defineProperty(style, 'fontSize', { value: '24px' });
      }
      return style;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    global.ResizeObserver = originalResizeObserver;
    window.matchMedia = originalMatchMedia;
    document.documentElement.style.removeProperty('font-size');
  });

  const prompt = (text = 'Long question') => <PileQuestionPrompt><h4 id="questionTitle">{text}</h4></PileQuestionPrompt>;

  it('shrinks overflowing mobile text and restores the normal size when space returns', () => {
    const { unmount } = render(prompt());
    const title = screen.getByRole('heading');
    expect(title).toHaveStyle({ fontSize: '22px' });
    availableHeight = 120;
    act(() => resize());
    expect(title.style.fontSize).toBe('');
    expect(title.parentElement).not.toHaveAttribute('tabindex');
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });

  it('keeps extreme text readable and keyboard-scrollable at the minimum size', () => {
    textLines = 20;
    const { rerender } = render(prompt());
    expect(screen.getByRole('heading')).toHaveStyle({ fontSize: '16px' });
    expect(screen.getByRole('heading').parentElement).toHaveAttribute('tabindex', '0');
    textLines = 1;
    rerender(prompt('Short question'));
    expect(screen.getByRole('heading').style.fontSize).toBe('');
    expect(screen.getByRole('heading').parentElement).not.toHaveAttribute('tabindex');
  });

  it('leaves desktop typography unchanged and removes the mobile override on resize', () => {
    render(prompt());
    expect(screen.getByRole('heading')).toHaveStyle({ fontSize: '22px' });
    mobile = false;
    act(() => resize());
    expect(screen.getByRole('heading').style.fontSize).toBe('');
  });
});
