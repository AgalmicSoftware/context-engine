import React from 'react';
import { render, screen } from '@testing-library/react';

import SurveyQuestionsJsonTree, { processSurveyQuestionsJsonToTree } from './SurveyQuestionsJsonTree';

describe('SurveyQuestionsJsonTree', () => {
  it('converts nested objects and arrays into the existing tree node model', () => {
    expect(processSurveyQuestionsJsonToTree({ prompt: 'Question', answers: ['yes'] })).toEqual([
      { type: 'objectKeyValue', key: 'prompt', value: 'Question', level: 0 },
      { type: 'objectKey', key: 'answers', level: 0 },
      { type: 'arrayItemValue', key: 0, value: 'yes', level: 1 },
    ]);
  });

  it('renders empty JSON input with the existing empty object fallback', () => {
    render(<SurveyQuestionsJsonTree jsonInput={null} />);

    expect(screen.getByText('{}')).toBeInTheDocument();
  });

  it('renders object, array, and primitive values', () => {
    render(<SurveyQuestionsJsonTree jsonInput={{ question: { id: 'q1' }, answers: ['yes'], count: 1 }} />);

    expect(screen.getByText('question:')).toBeInTheDocument();
    expect(screen.getByText('id: q1')).toBeInTheDocument();
    expect(screen.getByText('answers:')).toBeInTheDocument();
    expect(screen.getByText('[0]: yes')).toBeInTheDocument();
    expect(screen.getByText('count: 1')).toBeInTheDocument();
  });

  it('logs and renders invalid JSON strings with the existing fallback payload', () => {
    const onInvalidInput = jest.fn();

    render(<SurveyQuestionsJsonTree jsonInput="{not json" onInvalidInput={onInvalidInput} />);

    expect(onInvalidInput).toHaveBeenCalledWith(
      'Invalid JSON string for display:',
      expect.any(SyntaxError),
      'Input:',
      '{not json',
    );
    expect(screen.getByText('error: Invalid JSON input')).toBeInTheDocument();
    expect(screen.getByText('original: {not json')).toBeInTheDocument();
  });

  it('logs and renders unsupported input types with the existing fallback payload', () => {
    const onInvalidInput = jest.fn();

    render(<SurveyQuestionsJsonTree jsonInput={42} onInvalidInput={onInvalidInput} />);

    expect(onInvalidInput).toHaveBeenCalledWith(
      'Invalid input for jsonTreeDisplay: Expected string or object, got',
      'number',
    );
    expect(screen.getByText('error: Invalid input type')).toBeInTheDocument();
    expect(screen.getByText('original: 42')).toBeInTheDocument();
  });
});
