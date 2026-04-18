import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AsyncSearchSelect from './AsyncSearchSelect.jsx';

const OPTIONS = [
  { value: 'alpha', label: 'Alpha' },
  { value: 'beta', label: 'Beta' },
  { value: 'gamma', label: 'Gamma' },
];

const Harness = ({
  options = OPTIONS,
  initialValue = null,
  onChangeSpy,
  placeholder = 'Pick one',
  isLoading = false,
  loadingMessage,
  noOptionsMessage,
  formatOptionLabel,
  getOptionValue,
  disabled = false,
  id = 'test-async-search-select',
  inputId,
}) => {
  const [value, setValue] = useState(initialValue);

  return (
    <AsyncSearchSelect
      id={id}
      inputId={inputId}
      options={options}
      value={value}
      onChange={(option) => {
        if (onChangeSpy) onChangeSpy(option);
        setValue(option);
      }}
      placeholder={placeholder}
      isLoading={isLoading}
      loadingMessage={loadingMessage}
      noOptionsMessage={noOptionsMessage}
      formatOptionLabel={formatOptionLabel}
      getOptionValue={getOptionValue}
      disabled={disabled}
    />
  );
};

const openMenu = () => {
  fireEvent.click(screen.getByRole('button', { name: /pick one/i }));
};

describe('AsyncSearchSelect', () => {
  it('shows the placeholder when no value is selected', () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: /pick one/i })).toHaveTextContent('Pick one');
  });

  it('opens the menu on click and toggles aria-expanded', () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: /pick one/i });

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('renders options using formatOptionLabel', () => {
    render(
      <Harness formatOptionLabel={(option) => <span>{`Formatted ${option.label}`}</span>} />
    );

    openMenu();
    expect(screen.getByText('Formatted Alpha')).toBeInTheDocument();
    expect(screen.getByText('Formatted Beta')).toBeInTheDocument();
  });

  it('calls onChange with the full option on selection and closes the menu', async () => {
    const spy = jest.fn();
    render(<Harness onChangeSpy={spy} />);

    openMenu();
    fireEvent.click(screen.getByRole('option', { name: 'Beta' }));

    expect(spy).toHaveBeenCalledWith({ value: 'beta', label: 'Beta' });
    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /beta/i })).toBeInTheDocument();
  });

  it('filters options by case-insensitive substring using label', () => {
    render(<Harness />);

    openMenu();
    const searchInput = screen.getByRole('textbox', { name: /search options/i });
    expect(searchInput).toHaveAttribute('data-testid', 'test-async-search-select');
    fireEvent.change(searchInput, { target: { value: 'ET' } });

    expect(screen.queryByRole('option', { name: 'Alpha' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Beta' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Gamma' })).not.toBeInTheDocument();
  });

  it('uses getOptionValue to match the incoming value prop against options (marks aria-selected)', () => {
    const keyedOptions = [
      { slug: 'alpha', value: '1', label: 'Alpha' },
      { slug: 'beta', value: '2', label: 'Beta' },
    ];

    render(
      <Harness
        options={keyedOptions}
        initialValue={{ slug: 'beta', value: 'other', label: 'Other Beta' }}
        getOptionValue={(option) => String(option?.slug ?? '')}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /other beta/i }));
    expect(screen.getByRole('option', { name: 'Beta' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('option', { name: 'Alpha' })).toHaveAttribute('aria-selected', 'false');
  });

  it('does not mark options selected when getOptionValue resolves to an empty key', () => {
    const keyedOptions = [
      { slug: null, label: 'Alpha' },
      { slug: 'beta', label: 'Beta' },
    ];

    render(
      <Harness
        options={keyedOptions}
        initialValue={{ slug: null, label: 'Selected fallback' }}
        getOptionValue={(option) => option?.slug}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /selected fallback/i }));
    expect(screen.getByRole('option', { name: 'Alpha' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('option', { name: 'Beta' })).toHaveAttribute('aria-selected', 'false');
  });

  it('shows loadingMessage in the menu when isLoading is true and does not show options or the no-options message', () => {
    render(
      <Harness
        isLoading
        loadingMessage={() => 'Searching...'}
        noOptionsMessage={() => 'Nothing here'}
      />
    );

    openMenu();
    expect(screen.getByTestId('ce-async-select-loading')).toHaveTextContent('Searching...');
    expect(screen.queryByRole('option', { name: 'Alpha' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('ce-async-select-empty')).not.toBeInTheDocument();
  });

  it('shows a loading spinner in the closed control when isLoading is true', () => {
    render(<Harness isLoading />);

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByTestId('ce-async-select-control-spinner')).toBeInTheDocument();
  });

  it('shows noOptionsMessage when not loading and filtered list is empty; skips render when noOptionsMessage returns null', () => {
    const view = render(<Harness noOptionsMessage={() => 'Nothing found'} />);

    openMenu();
    fireEvent.change(screen.getByTestId('test-async-search-select'), { target: { value: 'zzz' } });
    expect(screen.getByTestId('ce-async-select-empty')).toHaveTextContent('Nothing found');

    view.unmount();

    render(<Harness id="null-empty-select" noOptionsMessage={() => null} />);
    fireEvent.click(screen.getByRole('button', { name: /pick one/i }));
    fireEvent.change(screen.getByTestId('null-empty-select'), { target: { value: 'zzz' } });
    expect(screen.queryByTestId('ce-async-select-empty')).not.toBeInTheDocument();
  });

  it('does not open or emit onChange when disabled', () => {
    const spy = jest.fn();
    render(<Harness disabled onChangeSpy={spy} />);

    const trigger = screen.getByRole('button', { name: /pick one/i });
    expect(trigger).toBeDisabled();

    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  it('does not crash when value is null and getOptionValue is not null-safe', () => {
    render(
      <AsyncSearchSelect
        id="null-safe-getter-select"
        options={[{ slug: 'a', label: 'Alpha' }]}
        value={null}
        onChange={jest.fn()}
        placeholder="Pick one"
        getOptionValue={(option) => option.slug}
      />
    );

    expect(screen.getByRole('button', { name: /pick one/i })).toHaveTextContent('Pick one');
  });
});
