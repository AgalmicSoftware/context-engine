import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import CEDateTimeInput from './CEDateTimeInput';

const allowIntermediateNativeInputValues = (input: HTMLInputElement) => {
  let currentValue = input.value;
  Object.defineProperty(input, 'value', {
    configurable: true,
    get: () => currentValue,
    set: (nextValue: string) => {
      currentValue = nextValue;
    },
  });

  return () => {
    Reflect.deleteProperty(input, 'value');
  };
};

describe('CEDateTimeInput', () => {
  it('renders a local datetime-local value and forwards changed dates', () => {
    const handleChange = jest.fn();
    render(
      <CEDateTimeInput
        data-testid="ce-date-time-input"
        minDate={new Date('2026-04-06T09:15:00')}
        onChange={handleChange}
        placeholderText="Pick a time"
        selected={new Date('2026-04-06T12:30:00')}
        showTimeSelect
        timeIntervals={15}
      />,
    );

    const input = screen.getByTestId('ce-date-time-input') as HTMLInputElement;
    expect(input).toHaveValue('2026-04-06T12:30');
    expect(input).toHaveAttribute('min', '2026-04-06T09:15');

    fireEvent.change(input, { target: { value: '2026-04-06T13:45' } });

    expect(handleChange).toHaveBeenCalledWith(expect.any(Date));
    const nextDate = handleChange.mock.calls[0][0];
    expect(nextDate.getFullYear()).toBe(2026);
    expect(nextDate.getMonth()).toBe(3);
    expect(nextDate.getDate()).toBe(6);
    expect(nextDate.getHours()).toBe(13);
    expect(nextDate.getMinutes()).toBe(45);
  });

  it('rounds live min dates up to the next time interval boundary', () => {
    render(
      <CEDateTimeInput
        data-testid="ce-date-time-input"
        minDate={new Date('2026-04-06T09:07:30')}
        selected={new Date('2026-04-06T12:30:00')}
        showTimeSelect
        timeIntervals={15}
      />,
    );

    const input = screen.getByTestId('ce-date-time-input') as HTMLInputElement;
    expect(input).toHaveAttribute('min', '2026-04-06T09:15');
  });

  it('keeps partial datetime edits visible while clearing the committed value', () => {
    const handleChange = jest.fn();

    const Wrapper = () => {
      const [selected, setSelected] = React.useState<Date | null>(new Date('2026-04-06T12:30:00'));

      return (
        <>
          <CEDateTimeInput
            data-testid="ce-date-time-input"
            onChange={(nextValue) => {
              handleChange(nextValue);
              setSelected(nextValue);
            }}
            selected={selected}
            showTimeSelect
          />
          <div data-testid="ce-selected-state">{selected ? 'set' : 'empty'}</div>
        </>
      );
    };

    render(<Wrapper />);

    const input = screen.getByTestId('ce-date-time-input') as HTMLInputElement;
    const restoreValueProperty = allowIntermediateNativeInputValues(input);

    try {
      input.value = '2026-04-06T13:';
      fireEvent.input(input);

      expect(handleChange).toHaveBeenCalledTimes(1);
      expect(handleChange).toHaveBeenNthCalledWith(1, null);
      expect(screen.getByTestId('ce-selected-state')).toHaveTextContent('empty');
      expect(input).toHaveValue('2026-04-06T13:');
      expect(input).toHaveAttribute('aria-invalid', 'true');

      input.value = '2026-04-06T13:45';
      fireEvent.input(input);

      expect(handleChange).toHaveBeenCalledTimes(2);
      expect(handleChange).toHaveBeenNthCalledWith(2, expect.any(Date));
      expect(screen.getByTestId('ce-selected-state')).toHaveTextContent('set');
      expect(input).toHaveValue('2026-04-06T13:45');
      expect(input).not.toHaveAttribute('aria-invalid');
    } finally {
      restoreValueProperty();
    }
  });

  it('clears an invalid partial draft when the field loses focus', () => {
    const handleChange = jest.fn();

    const Wrapper = () => {
      const [selected, setSelected] = React.useState<Date | null>(new Date('2026-04-06T12:30:00'));

      return (
        <>
          <CEDateTimeInput
            data-testid="ce-date-time-input"
            onChange={(nextValue) => {
              handleChange(nextValue);
              setSelected(nextValue);
            }}
            selected={selected}
            showTimeSelect
          />
          <div data-testid="ce-selected-state">{selected ? 'set' : 'empty'}</div>
        </>
      );
    };

    render(<Wrapper />);

    const input = screen.getByTestId('ce-date-time-input') as HTMLInputElement;
    const restoreValueProperty = allowIntermediateNativeInputValues(input);

    try {
      input.value = '2026-04-06T13:';
      fireEvent.input(input);
      fireEvent.blur(input);

      expect(handleChange).toHaveBeenNthCalledWith(1, null);
      expect(handleChange).toHaveBeenNthCalledWith(2, null);
      expect(screen.getByTestId('ce-selected-state')).toHaveTextContent('empty');
      expect(input).toHaveValue('');
      expect(input).not.toHaveAttribute('aria-invalid');
    } finally {
      restoreValueProperty();
    }
  });

  it('shows a clear button for clearable values and emits null when cleared', () => {
    const handleChange = jest.fn();
    render(
      <CEDateTimeInput isClearable onChange={handleChange} selected={new Date('2026-04-06T12:30:00')} showTimeSelect />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clear date and time' }));

    expect(handleChange).toHaveBeenCalledWith(null);
  });
});
