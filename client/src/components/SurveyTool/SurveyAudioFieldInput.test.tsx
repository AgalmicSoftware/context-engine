import React from 'react';
import { render, screen } from '@testing-library/react';
import SurveyAudioFieldInput from './SurveyAudioFieldInput';

const mockAudioInputProps: any[] = [];

jest.mock('../Shared/AudioInput/AudioInput', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: (props: any) => {
      mockAudioInputProps.push(props);
      return (
        <div
          data-testid="mock-audio-input"
          data-placeholder={props.placeholder}
          data-ce-question-id={props.dataCeQuestionId || ''}
          data-disabled={String(!!props.disabled)}
          data-enable-downloads={String(!!props.enableDownloads)}
          data-disable-encryption={String(!!props.disableEncryption)}
          data-force-glow={String(!!props.forceGlow)}
        />
      );
    },
  };
});

describe('SurveyAudioFieldInput', () => {
  beforeEach(() => {
    mockAudioInputProps.length = 0;
  });

  it('forwards survey audio field props to AudioInput with SurveyTool defaults', () => {
    render(
      <SurveyAudioFieldInput
        qIndex={3}
        placeholder="response (optional)"
        value="hello"
        encrypted
        dataTestId="ce-answer"
        dataCeQuestionId="q1"
        forceGlow
        disabled
        updateFunction={jest.fn()}
        toggleEncryption={jest.fn()}
      />,
    );

    const input = screen.getByTestId('mock-audio-input');
    expect(input).toHaveAttribute('data-placeholder', 'response (optional)');
    expect(input).toHaveAttribute('data-ce-question-id', 'q1');
    expect(input).toHaveAttribute('data-disabled', 'true');
    expect(input).toHaveAttribute('data-enable-downloads', 'false');
    expect(input).toHaveAttribute('data-disable-encryption', 'true');
    expect(input).toHaveAttribute('data-force-glow', 'true');
  });

  it('allows pile-style download behavior overrides', () => {
    render(
      <SurveyAudioFieldInput
        placeholder="Additional comments..."
        dataCeQuestionId="q2"
        enableDownloads
        disableEncryption={false}
        updateFunction={jest.fn()}
        toggleEncryption={jest.fn()}
      />,
    );

    const input = screen.getByTestId('mock-audio-input');
    expect(input).toHaveAttribute('data-enable-downloads', 'true');
    expect(input).toHaveAttribute('data-disable-encryption', 'false');
  });

  it('preserves audio worker and handler identity for recording-bound fields', () => {
    const sessionConfig = { worker: 'config' };
    const context = { chainId: 84532 };
    const updateFunction = jest.fn();
    const toggleEncryption = jest.fn();

    render(
      <SurveyAudioFieldInput
        placeholder="response (optional)"
        value="hello"
        dataCeQuestionId="q3"
        sessionSlug="edge"
        sessionConfig={sessionConfig}
        context={context}
        workerUrl="https://worker.example/audio"
        updateFunction={updateFunction}
        toggleEncryption={toggleEncryption}
      />,
    );

    const props = mockAudioInputProps[mockAudioInputProps.length - 1];
    expect(props.sessionSlug).toBe('edge');
    expect(props.sessionConfig).toBe(sessionConfig);
    expect(props.context).toBe(context);
    expect(props.workerUrl).toBe('https://worker.example/audio');
    expect(props.updateFunction).toBe(updateFunction);
    expect(props.toggleEncryption).toBe(toggleEncryption);
  });
});
