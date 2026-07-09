import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import CheckboxMultiSelect from './CheckboxMultiSelect';

type TestOption = {
  value?: unknown;
  label?: React.ReactNode;
};

type HarnessProps = {
  initial?: TestOption[];
  isClearable?: boolean;
  disabled?: boolean;
  onChangeSpy?: (nextValue: TestOption[]) => void;
};

const OPTIONS: TestOption[] = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma' },
];

const Harness = ({ initial = [], isClearable = true, disabled = false, onChangeSpy }: HarnessProps) => {
  const [value, setValue] = useState<TestOption[]>(initial);
  return (
    <CheckboxMultiSelect
      inputId="test-cms"
      options={OPTIONS}
      value={value}
      onChange={(next) => {
        if (onChangeSpy) onChangeSpy(next);
        setValue(next);
      }}
      placeholder="Pick things"
      isClearable={isClearable}
      disabled={disabled}
    />
  );
};

const openMenu = () => {
  fireEvent.click(screen.getByRole('button', { name: /Pick things/i }));
};

describe('CheckboxMultiSelect', () => {
  it('shows the placeholder in the control when nothing is selected', () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: /Pick things/i })).toHaveTextContent('Pick things');
  });

  it('opens the menu on click and toggles aria-expanded', () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: /Pick things/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('test-cms')).toBeInTheDocument();
  });

  it('keeps the menu open across multiple toggles and calls onChange with each new value', () => {
    const spy = jest.fn();
    render(<Harness onChangeSpy={spy} />);
    openMenu();
    const alphaCheckbox = screen.getByRole('checkbox', { name: 'Alpha' });
    fireEvent.click(alphaCheckbox);
    expect(spy).toHaveBeenLastCalledWith([{ value: 'a', label: 'Alpha' }]);

    const betaCheckbox = screen.getByRole('checkbox', { name: 'Beta' });
    fireEvent.click(betaCheckbox);
    expect(spy).toHaveBeenLastCalledWith([
      { value: 'a', label: 'Alpha' },
      { value: 'b', label: 'Beta' },
    ]);

    expect(screen.getByRole('button', { name: /Pick things/i })).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(alphaCheckbox);
    expect(spy).toHaveBeenLastCalledWith([{ value: 'b', label: 'Beta' }]);
  });

  it('filters options by case-insensitive substring', () => {
    render(<Harness />);
    openMenu();
    fireEvent.change(screen.getByTestId('test-cms'), { target: { value: 'bet' } });
    expect(screen.queryByRole('checkbox', { name: 'Alpha' })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Beta' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Gamma' })).not.toBeInTheDocument();
  });

  it('normalizes non-array value and options props without crashing', () => {
    render(
      <CheckboxMultiSelect
        inputId="test-cms-null"
        options={null}
        value={null}
        onChange={jest.fn()}
        placeholder="Pick things"
      />,
    );

    openMenu();

    expect(screen.getByTestId('test-cms-null')).toBeInTheDocument();
    expect(screen.getByText('No matches')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Clear all/i })).not.toBeInTheDocument();
  });

  it('renders a clear button when value is non-empty and clears all on click', () => {
    const spy = jest.fn();
    render(<Harness initial={[{ value: 'a', label: 'Alpha' }]} onChangeSpy={spy} />);
    const clear = screen.getByRole('button', { name: /Clear all/i });
    fireEvent.click(clear);
    expect(spy).toHaveBeenLastCalledWith([]);
  });

  it('closes the menu on Escape', () => {
    render(<Harness />);
    openMenu();
    expect(screen.getByTestId('test-cms')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('test-cms')).not.toBeInTheDocument();
  });

  it('does not emit onChange when disabled', () => {
    const spy = jest.fn();
    render(<Harness disabled onChangeSpy={spy} />);
    const trigger = screen.getByRole('button', { name: /Pick things/i });
    expect(trigger).toBeDisabled();
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(spy).not.toHaveBeenCalled();
  });
});
