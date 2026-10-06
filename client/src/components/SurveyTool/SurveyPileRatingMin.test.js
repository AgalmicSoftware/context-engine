import { fireEvent, screen } from '@testing-library/react';
import { createPileViewRuntimeStrategy } from './SurveyPileViewMode';
import { renderSurveyPileViewMode } from './surveyQuestionsTestHarness';

jest.mock('./CreateQuestionsAndSurveys', () => {
  const React = require('react');
  return { __esModule: true, default: () => React.createElement('div') };
});
jest.mock('./SessionListeningPanel', () => {
  const React = require('react');
  return { __esModule: true, default: () => React.createElement('div') };
});

const renderPile = (scale) =>
  renderSurveyPileViewMode({
    minifiedMode: 'pile',
    network: { id: 84532 },
    networkChainId: 84532,
    account: '',
    loginComplete: false,
    cacheHasLoaded: true,
    isQuestionCacheReady: true,
    questionResponsesNonce: 2,
    questionsCacheNonce: 2,
    onFilterChange: jest.fn(),
    runtimeStrategy: createPileViewRuntimeStrategy(),
    questionPool: [{ id: 'rating-q1', type: 'rating', prompt: 'Rate it', scale }],
  });

describe.each([
  { label: '0-10', min: 0, max: 10 },
  { label: '1-5', min: 1, max: 5 },
])('pile, unanswered rating on a $label scale', ({ min, max }) => {
  it('R3 pointer: press and release on the thumb at the minimum selects it', () => {
    renderPile({ min, max });
    const slider = screen.getByRole('slider');
    expect(slider).toHaveValue(String(min));
    expect(screen.getByLabelText('Current rating')).toHaveTextContent('–');
    fireEvent.mouseDown(slider);
    fireEvent.change(slider, { target: { value: String(min) } });
    fireEvent.mouseUp(slider);
    expect(screen.getByLabelText('Current rating')).toHaveTextContent(String(min));
  });

  it('R3k keyboard: ArrowLeft at the minimum selects it', () => {
    renderPile({ min, max });
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowLeft' });
    expect(screen.getByLabelText('Current rating')).toHaveTextContent(String(min));
  });

  it('control: moving away and back does select the minimum', () => {
    renderPile({ min, max });
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: String(min + 1) } });
    fireEvent.change(slider, { target: { value: String(min) } });
    expect(screen.getByLabelText('Current rating')).toHaveTextContent(String(min));
  });
});
