const React = require('react');
const { render, screen } = require('@testing-library/react');
const {
  getShortenedAddress,
  getShortenedQuestionID,
  getShortenedSurveyID,
  getShortenedTransactionHash,
} = require('./displayHelpers.js');

const ADDRESS = '0x1234567890abcdef1234567890abcdef12345678';
const SURVEY_ID = `0x123${'a'.repeat(58)}xyz`;
const QUESTION_ID = `0xqwe${'b'.repeat(58)}rst`;
const TX_HASH = `0x1234${'a'.repeat(52)}fedcba`;

describe('displayHelpers', () => {
  it('shortens addresses as plain text by default and as links when enabled', () => {
    expect(getShortenedAddress(ADDRESS, false)).toBe('0x123...5678');
    expect(getShortenedAddress(ADDRESS)).toBe('0x123...5678');
    expect(getShortenedAddress('', false)).toBe('...');
    expect(getShortenedAddress('abc', false)).toBe('abc...');
    expect(() => getShortenedAddress(null, false)).toThrow();

    render(<>{getShortenedAddress(ADDRESS, null, '/custom-user')}</>);

    const link = screen.getByRole('link', { name: '0x123...5678' });
    expect(link).toHaveAttribute('href', '/custom-user');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveStyle({ padding: '0px' });
  });

  it('preserves survey ID CSV, plain, and clickable output shapes', () => {
    expect(getShortenedSurveyID(SURVEY_ID, false)).toBe('123...xyz');
    expect(getShortenedSurveyID(SURVEY_ID, false, null, true)).toBe('123-xyz');
    expect(getShortenedSurveyID('', false)).toBe('...');
    expect(() => getShortenedSurveyID(null, false)).toThrow();

    const { container } = render(<>{getShortenedSurveyID(SURVEY_ID, true, '/custom-survey')}</>);
    const link = container.querySelector('a');

    expect(link).toHaveAttribute('href', '/custom-survey');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link.style.padding).toBe('0px');
    expect(link.style.color).toBe('blue');
    expect(link.style.marginLeft).toBe('5px');
    expect(link).toHaveTextContent('');
  });

  it('shortens question IDs and transaction hashes without mutating inputs', () => {
    const question = new String(QUESTION_ID);
    const tx = new String(TX_HASH);
    const originalQuestion = question.toString();
    const originalTx = tx.toString();

    expect(getShortenedQuestionID(question, false)).toBe('qwe...rst');
    expect(getShortenedTransactionHash(tx, false)).toBe('0x1234...fedcba');
    expect(question.toString()).toBe(originalQuestion);
    expect(tx.toString()).toBe(originalTx);
    expect(() => getShortenedQuestionID(null, false)).toThrow();
    expect(() => getShortenedTransactionHash(null, false)).toThrow();

    render(
      <>
        {getShortenedQuestionID(QUESTION_ID, true, '/custom-question')}
        {getShortenedTransactionHash(TX_HASH, true, '/custom-tx')}
      </>,
    );

    const questionLink = screen.getByRole('link', { name: 'qwe...rst' });
    const transactionLink = screen.getByRole('link', { name: '0x1234...fedcba' });

    expect(questionLink).toHaveAttribute('href', '/custom-question');
    expect(questionLink).toHaveAttribute('rel', 'noopener noreferrer');
    expect(transactionLink).toHaveAttribute('href', '/custom-tx');
    expect(transactionLink).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
