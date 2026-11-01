import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { SessionListeningTranscript } from './SessionListeningTranscript';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

describe('SessionListeningTranscript', () => {
  const scrollHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight');
  const clientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
  beforeAll(() => {
    // jsdom lays nothing out; each line is 20px tall in a 100px box.
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get(this: HTMLTextAreaElement) {
        return String(this.value || '').split('\n').length * 20;
      },
    });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 100 });
  });
  afterAll(() => {
    if (scrollHeight) Object.defineProperty(HTMLElement.prototype, 'scrollHeight', scrollHeight);
    if (clientHeight) Object.defineProperty(HTMLElement.prototype, 'clientHeight', clientHeight);
  });

  const lines = (count: number) =>
    Array.from({ length: count }, (_, index) => `Person ${(index % 2) + 1}: point ${index + 1}.`).join('\n');
  const transcriptBox = (count: number) => (
    <SessionListeningTranscript transcript={lines(count)} clearDisabled={false} onClear={jest.fn()} />
  );

  it('keeps the newest line in view as chunks arrive until the host scrolls up', () => {
    const { rerender } = render(transcriptBox(10));
    const box = screen.getByTestId(E2E_TESTIDS.SESSION_LISTENING_TRANSCRIPT);
    expect(box.scrollTop).toBe(200);

    rerender(transcriptBox(15));
    expect(box.scrollTop).toBe(300);

    // Rereading earlier lines: a new chunk leaves the text where the host put it.
    box.scrollTop = 40;
    fireEvent.scroll(box);
    rerender(transcriptBox(20));
    expect(box.scrollTop).toBe(40);

    // Back at the end, it follows the newest line again.
    box.scrollTop = 400 - 100;
    fireEvent.scroll(box);
    rerender(transcriptBox(25));
    expect(box.scrollTop).toBe(500);
  });

  it('keeps the host where they were reading where new text moves the scroll position', () => {
    const value = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!;
    // Emulate an engine that scrolls a textarea back to its top when its value is replaced.
    Object.defineProperty(HTMLTextAreaElement.prototype, 'value', {
      configurable: true,
      get: value.get,
      set(this: HTMLTextAreaElement, next: string) {
        value.set!.call(this, next);
        this.scrollTop = 0;
      },
    });
    try {
      const { rerender } = render(transcriptBox(10));
      const box = screen.getByTestId(E2E_TESTIDS.SESSION_LISTENING_TRANSCRIPT);
      box.scrollTop = 40;
      fireEvent.scroll(box);
      rerender(transcriptBox(15));
      expect(box.scrollTop).toBe(40);
    } finally {
      Object.defineProperty(HTMLTextAreaElement.prototype, 'value', value);
    }
  });

  it('clears through its corner control unless clearing is disabled', () => {
    const onClear = jest.fn();
    const { rerender } = render(<SessionListeningTranscript transcript="Notes" clearDisabled onClear={onClear} />);
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_LISTENING_TRANSCRIPT)).toHaveValue('Notes');
    expect(screen.getByRole('button', { name: 'Clear transcript' })).toBeDisabled();

    rerender(<SessionListeningTranscript transcript="Notes" clearDisabled={false} onClear={onClear} />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear transcript' }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
