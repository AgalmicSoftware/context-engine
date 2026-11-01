import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import AutoGrowTextarea from './AutoGrowTextarea';
import { CE_THEME_CHANGE_EVENT } from '../../utilities/ui/themeRuntime';

describe('AutoGrowTextarea', () => {
  const scrollHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight');
  // How many characters fit on a line; a new width, font or theme changes it.
  let charsPerLine = 20;
  beforeAll(() => {
    // jsdom lays nothing out; give each line of text 20px.
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get(this: HTMLTextAreaElement) {
        return Math.max(1, Math.ceil((this.value || '').length / charsPerLine)) * 20;
      },
    });
  });
  afterAll(() => {
    if (scrollHeight) Object.defineProperty(HTMLElement.prototype, 'scrollHeight', scrollHeight);
  });
  afterEach(() => {
    charsPerLine = 20;
  });

  it('grows with its text instead of cutting it off', () => {
    const { rerender } = render(<AutoGrowTextarea aria-label="Prompt" value="Short" onChange={() => {}} />);
    const prompt = screen.getByRole('textbox', { name: 'Prompt' });
    expect(prompt.tagName).toBe('TEXTAREA');
    expect(prompt).toHaveStyle({ height: '20px', overflowY: 'hidden' });

    rerender(<AutoGrowTextarea aria-label="Prompt" value={'A long question '.repeat(5)} onChange={() => {}} />);
    expect(prompt).toHaveStyle({ height: '80px' });
  });

  it('passes the element to its owner and keeps one-line values on one line', () => {
    const innerRef = jest.fn();
    const onChange = jest.fn((event: React.ChangeEvent<HTMLInputElement>) => event.target.value);
    render(<AutoGrowTextarea aria-label="Option" singleLine value="" innerRef={innerRef} onChange={onChange} />);
    const option = screen.getByRole('textbox', { name: 'Option' });
    expect(innerRef).toHaveBeenCalledWith(option);

    expect(fireEvent.keyDown(option, { key: 'Enter' })).toBe(false);
    fireEvent.change(option, { target: { value: 'Council staff\nand residents' } });
    expect(onChange).toHaveReturnedWith('Council staff and residents');
  });

  describe('when the text rewraps without a new value', () => {
    let resized: ResizeObserverCallback | null = null;
    const fonts = new EventTarget();
    beforeEach(() => {
      jest.useFakeTimers();
      resized = null;
      (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
        constructor(callback: ResizeObserverCallback) {
          resized = callback;
        }
        observe() {}
        disconnect() {}
      };
      Object.defineProperty(document, 'fonts', { configurable: true, value: fonts });
    });
    afterEach(() => {
      delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
      delete (document as { fonts?: unknown }).fonts;
      jest.useRealTimers();
    });

    const renderPrompt = () => {
      render(<AutoGrowTextarea aria-label="Prompt" value={'A long question '.repeat(5)} onChange={() => {}} />);
      const prompt = screen.getByRole('textbox', { name: 'Prompt' });
      expect(prompt).toHaveStyle({ height: '80px' });
      return prompt;
    };

    it('refits on the next frame after its width changes', () => {
      const prompt = renderPrompt();
      charsPerLine = 10;
      Object.defineProperty(prompt, 'clientWidth', { configurable: true, value: 150 });
      act(() => resized?.([], {} as ResizeObserver));
      // Resizing inside the observer's callback would raise its loop error, so the refit waits a frame.
      expect(prompt).toHaveStyle({ height: '80px' });
      act(() => jest.advanceTimersToNextFrame());
      expect(prompt).toHaveStyle({ height: '160px' });
    });

    it('refits once web fonts finish loading', () => {
      const prompt = renderPrompt();
      charsPerLine = 40;
      act(() => {
        fonts.dispatchEvent(new Event('loadingdone'));
        jest.advanceTimersToNextFrame();
      });
      expect(prompt).toHaveStyle({ height: '40px' });
    });

    it('refits when the theme changes', () => {
      const prompt = renderPrompt();
      charsPerLine = 16;
      act(() => {
        window.dispatchEvent(new CustomEvent(CE_THEME_CHANGE_EVENT));
        jest.advanceTimersToNextFrame();
      });
      expect(prompt).toHaveStyle({ height: '100px' });
    });
  });
});
