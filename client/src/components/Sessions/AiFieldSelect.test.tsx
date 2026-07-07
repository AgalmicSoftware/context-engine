import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';

import styles from './SessionWizard.module.scss';
import { renderAiOrGateSelect, type RenderAiOrGateSelectParams } from './AiFieldSelect';
import { AI_PROVIDER_OPTIONS, getAiModelOptions } from './sessionWizardAiConfig';

const buildParams = (overrides: Partial<RenderAiOrGateSelectParams> = {}): RenderAiOrGateSelectParams => ({
  keyString: 'ai.models.transcription.provider',
  value: 'openai',
  currentPath: ['ai', 'models', 'transcription', 'provider'],
  displayLabelText: 'Transcription Provider',
  fieldTooltipControl: <span data-testid="field-tooltip">?</span>,
  onUpdateDraftValue: jest.fn(),
  draft: {
    ai: {
      mode: 'openai',
      models: {
        fast: { provider: 'openai', model: 'gpt-5' },
        thinking: { provider: 'openai', model: 'gpt-5' },
        transcription: { provider: 'openai', model: 'whisper-1' },
      },
    },
  },
  encryptionGates: [
    { id: 'gate-1', label: 'Gate One', color: '#4dffa4' },
    { id: 'gate-2', label: 'Gate Two', color: '#ff6600' },
  ],
  defaultGateId: 'gate-2',
  onSetDefaultGateId: jest.fn(),
  ...overrides,
});

const renderAiFieldSelect = (overrides: Partial<RenderAiOrGateSelectParams> = {}) => {
  const params = buildParams(overrides);
  const view = render(<>{renderAiOrGateSelect(params)}</>);
  return { ...view, params };
};

const asOptionElement = (option: Element): HTMLOptionElement => option as HTMLOptionElement;

describe('renderAiOrGateSelect', () => {
  it('renders transcription provider select with correct options', () => {
    renderAiFieldSelect({
      value: '',
    });

    expect(screen.getByText('Transcription Provider')).toBeInTheDocument();
    expect(screen.getByTestId('field-tooltip')).toBeInTheDocument();

    const select = screen.getByRole('combobox');
    const options = within(select).getAllByRole('option');

    expect(select).toHaveValue('openai');
    expect(
      options.map((option) => {
        const optionEl = asOptionElement(option);
        return {
          value: optionEl.getAttribute('value'),
          label: optionEl.textContent,
          disabled: optionEl.disabled,
        };
      }),
    ).toEqual([
      { value: 'openai', label: 'OpenAI', disabled: false },
      { value: 'local', label: 'Local (coming soon)', disabled: true },
    ]);
  });

  it('renders fast/thinking provider select with AI_PROVIDER_OPTIONS and cascades model updates', () => {
    const { params } = renderAiFieldSelect({
      keyString: 'ai.models.fast.provider',
      value: 'openai',
      currentPath: ['ai', 'models', 'fast', 'provider'],
      displayLabelText: 'Fast Provider',
      draft: {
        ai: {
          models: {
            fast: { provider: 'openai', model: 'gpt-5' },
          },
        },
      },
    });

    const select = screen.getByRole('combobox');
    const options = within(select).getAllByRole('option');

    expect(
      options.map((option) => {
        const optionEl = asOptionElement(option);
        return {
          value: optionEl.getAttribute('value'),
          label: optionEl.textContent,
          disabled: optionEl.disabled,
        };
      }),
    ).toEqual(
      AI_PROVIDER_OPTIONS.map((option) => ({
        value: option.value,
        label: option.label,
        disabled: !!option.disabled,
      })),
    );

    fireEvent.change(select, { target: { value: 'anthropic' } });

    expect(params.onUpdateDraftValue).toHaveBeenNthCalledWith(1, ['ai', 'models', 'fast', 'provider'], 'anthropic');
    expect(params.onUpdateDraftValue).toHaveBeenNthCalledWith(
      2,
      ['ai', 'models', 'fast', 'model'],
      getAiModelOptions('fast', 'anthropic')[0],
    );
  });

  it('renders model select with dynamic options from getAiModelOptions', () => {
    renderAiFieldSelect({
      keyString: 'ai.models.thinking.model',
      value: 'not-a-real-model',
      currentPath: ['ai', 'models', 'thinking', 'model'],
      displayLabelText: 'Thinking Model',
      draft: {
        ai: {
          models: {
            thinking: { provider: 'anthropic', model: 'not-a-real-model' },
          },
        },
      },
    });

    const expectedOptions = getAiModelOptions('thinking', 'anthropic');
    const select = screen.getByRole('combobox');
    const options = within(select).getAllByRole('option');

    expect(select).toHaveValue(expectedOptions[0]);
    expect(options.map((option) => option.getAttribute('value'))).toEqual(expectedOptions);
  });

  it('renders default gate select with encryption gate options and color indicator', () => {
    const { container, params } = renderAiFieldSelect({
      keyString: 'lit.defaultGateId',
      value: 'gate-2',
      currentPath: ['lit', 'defaultGateId'],
      displayLabelText: 'Default Gate',
    });

    const select = screen.getByRole('combobox');
    const options = within(select).getAllByRole('option');
    const gateColor = container.querySelector(`.${styles.gateColor}`);

    expect(select).toHaveValue('gate-2');
    expect(
      options.map((option) => ({
        value: option.getAttribute('value'),
        label: option.textContent,
      })),
    ).toEqual([
      { value: 'gate-1', label: 'Gate One' },
      { value: 'gate-2', label: 'Gate Two' },
    ]);
    expect(gateColor).toBeInTheDocument();
    expect(gateColor).toHaveStyle({ background: '#ff6600' });

    fireEvent.change(select, { target: { value: 'gate-1' } });

    expect(params.onSetDefaultGateId).toHaveBeenCalledWith('gate-1');
  });

  it('returns null for non-matching keyStrings', () => {
    expect(
      renderAiOrGateSelect(
        buildParams({
          keyString: 'sessionName',
          currentPath: ['sessionName'],
          value: 'Demo Session',
        }),
      ),
    ).toBeNull();
  });
});
