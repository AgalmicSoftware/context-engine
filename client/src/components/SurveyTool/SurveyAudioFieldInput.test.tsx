import React from 'react';
import { render, screen } from '@testing-library/react';
import SurveyAudioFieldInput from './SurveyAudioFieldInput';

jest.mock('../Shared/AudioInput/AudioInput', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: (props: any) => (
      <div
        data-testid="mock-audio-input"
        data-placeholder={props.placeholder}
        data-ce-question-id={props.dataCeQuestionId || ''}
        data-enable-downloads={String(!!props.enableDownloads)}
        data-disable-encryption={String(!!props.disableEncryption)}
        data-force-glow={String(!!props.forceGlow)}
      />
    ),
  };
});

describe('SurveyAudioFieldInput', () => {
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
      />
    );

    const input = screen.getByTestId('mock-audio-input');
    expect(input).toHaveAttribute('data-placeholder', 'response (optional)');
    expect(input).toHaveAttribute('data-ce-question-id', 'q1');
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
      />
    );

    const input = screen.getByTestId('mock-audio-input');
    expect(input).toHaveAttribute('data-enable-downloads', 'true');
    expect(input).toHaveAttribute('data-disable-encryption', 'false');
  });
});
