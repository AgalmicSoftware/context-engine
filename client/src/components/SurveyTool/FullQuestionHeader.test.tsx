import React from 'react';
import { render, screen } from '@testing-library/react';
import FullQuestionHeader from './FullQuestionHeader';

describe('FullQuestionHeader', () => {
  it('renders prompt content and trailing action content together', () => {
    render(
      <FullQuestionHeader>
        <span>Prompt content</span>
        <span>Action content</span>
      </FullQuestionHeader>,
    );

    expect(screen.getByText('Prompt content')).toBeInTheDocument();
    expect(screen.getByText('Action content')).toBeInTheDocument();
  });
});
