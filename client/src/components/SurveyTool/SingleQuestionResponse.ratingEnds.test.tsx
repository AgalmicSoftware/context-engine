import React from 'react';
import { render } from '@testing-library/react';

import SingleQuestionResponse from './SingleQuestionResponse';

const renderRating = (question: Record<string, unknown>, value: unknown) =>
  render(
    <SingleQuestionResponse
      network={{ id: 84532 }}
      questionsCacheNonce={1}
      questionResponsesNonce={1}
      sessionSlug="edge"
      mode="mini"
      showImportance
      question={{ prompt: 'How far should the council go?', type: 'rating', ...question }}
      response={{ answer: { value, encrypted: false }, importance: 6 }}
    />,
  );

const ratingText = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('[class*="readOnlyRating"] span')).map((span) => span.textContent);

describe('a rating answer card', () => {
  it('says the value once, with no bare 0 and 10 ends beside "8/10"', () => {
    const { container } = renderRating({}, 8);
    expect(ratingText(container)).toEqual(['8/10']);
  });

  it('keeps worded ends, and a bare floor that "n/max" does not say', () => {
    const worded = renderRating({ minLabel: 'Not at all', maxLabel: 'Completely' }, 8);
    expect(ratingText(worded.container)).toEqual(['Not at all', '8/10', 'Completely']);
    worded.unmount();

    const fromOne = renderRating({ min: 1, max: 5 }, 4);
    expect(ratingText(fromOne.container)).toEqual(['1', '4/5']);
  });
});
