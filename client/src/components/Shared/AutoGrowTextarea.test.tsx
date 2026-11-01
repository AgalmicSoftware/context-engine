import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import AutoGrowTextarea from './AutoGrowTextarea';

describe('AutoGrowTextarea', () => {
  const scrollHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight');
  beforeAll(() => {
    // jsdom lays nothing out; give each line of text 20px.
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get(this: HTMLTextAreaElement) {
        return Math.max(1, Math.ceil((this.value || '').length / 20)) * 20;
      },
    });
  });
  afterAll(() => {
    if (scrollHeight) Object.defineProperty(HTMLElement.prototype, 'scrollHeight', scrollHeight);
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
});
