import React from 'react';
import { render, screen } from '@testing-library/react';
import SessionInterviewSubmitButton from './SessionInterviewSubmitButton';
import styles from './SurveyTool.module.scss';

const props = {
  count: 6,
  awaitingLogin: false,
  joiningGroups: false,
  applying: false,
  busy: false,
  submitted: false,
  onSubmit: () => {},
};
const letters = (button: HTMLElement) => button.style.getPropertyValue('--ce-submit-fill-letters');

// The words fill the button, so their size follows how many letters show; the count sits apart in the corner.
describe('SessionInterviewSubmitButton', () => {
  it('sizes its words by the letters each label shows', () => {
    const { rerender } = render(<SessionInterviewSubmitButton {...props} />);
    const button = screen.getByRole('button', { name: 'Submit (6)' });
    expect(button).toHaveClass(styles.sessionInterviewSubmitFill);
    expect(button.firstElementChild).toHaveClass(styles.sessionInterviewSubmitFillText);
    expect(letters(button)).toBe('6');

    rerender(<SessionInterviewSubmitButton {...props} joiningGroups />);
    expect(letters(screen.getByRole('button', { name: 'Submit and join (6)' }))).toBe('15');

    rerender(<SessionInterviewSubmitButton {...props} awaitingLogin />);
    expect(letters(screen.getByRole('button', { name: 'Submit after login (6)' }))).toBe('18');
  });

  it('holds one size while saving and counts the tick of a finished Submit', () => {
    const { rerender } = render(<SessionInterviewSubmitButton {...props} applying />);
    expect(letters(screen.getByRole('button'))).toBe(String('Saving · 00s'.length));

    rerender(<SessionInterviewSubmitButton {...props} submitted />);
    expect(screen.getByRole('button')).toHaveTextContent('Responses submitted');
    expect(letters(screen.getByRole('button'))).toBe(String('Responses submitted'.length + 2));

    rerender(<SessionInterviewSubmitButton {...props} submitted onViewResults={() => {}} />);
    expect(letters(screen.getByRole('button', { name: 'View results' }))).toBe('12');
  });
});
