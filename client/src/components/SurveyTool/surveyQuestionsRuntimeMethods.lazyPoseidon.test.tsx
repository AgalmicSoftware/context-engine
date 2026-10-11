import React from 'react';
import { render, screen } from '@testing-library/react';

import { SurveyQuestions } from './SurveyQuestions';

const mockLoadedArities: number[] = [];

jest.mock('poseidon-lite/poseidon2', () => {
  mockLoadedArities.push(2);
  return jest.requireActual('poseidon-lite/poseidon2');
});
jest.mock('poseidon-lite/poseidon3', () => {
  mockLoadedArities.push(3);
  return jest.requireActual('poseidon-lite/poseidon3');
});

it('loads poseidon-lite only when the first commitment is hashed', async () => {
  const ref = React.createRef<any>();
  render(
    <SurveyQuestions
      ref={ref}
      runtimeStrategy={{
        render: () => <div data-testid="survey-questions-poseidon" />,
      }}
    />,
  );
  await screen.findByTestId('survey-questions-poseidon');
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(mockLoadedArities).toEqual([]);
  const { hasher } = ref.current.state;
  await expect(hasher([1n, 2n])).resolves.toBe(
    7853200120776062878684798364095072458815029376092732009249414926327459813530n,
  );
  expect(mockLoadedArities.sort()).toEqual([2, 3]);
});
