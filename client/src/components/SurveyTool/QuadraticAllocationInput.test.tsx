import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import QuadraticAllocationInput from './QuadraticAllocationInput';
import QuadraticAllocationResults from './QuadraticAllocationResults';
import {
  validateQuadraticAllocation,
  validateQuadraticQuestion,
} from '../../../../shared/questions/quadraticAllocation.mjs';
import { generateQuestionId } from '../../utilities/shared/questionUtils.mjs';
import { encodeValueBytes } from '../../../../shared/encryption/envelopeV1Core.mjs';

const question = { options: ['Parks', 'Transit'], voiceCredits: 99 };

it('validates signed quadratic cost, neutral allocations, budgets, and malformed inputs', () => {
  expect(validateQuadraticAllocation([7, -7], question)).toBe('');
  expect(validateQuadraticAllocation([0, 0], question)).toBe('');
  expect(validateQuadraticAllocation([8, -6], question)).toMatch(/exceeds/);
  expect(validateQuadraticAllocation([3, -4], { ...question, voiceCredits: 25 })).toBe('');
  for (const value of [[1], [1, 2, 3], [1.5, 0], ['1', 0], [Infinity, 0], [NaN, 0], Array(2), {}]) {
    expect(validateQuadraticAllocation(value, question)).not.toBe('');
  }
  for (const voiceCredits of [0, -1, 1.2, '99', null, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    expect(validateQuadraticQuestion({ ...question, voiceCredits })).not.toBe('');
  }
  expect(validateQuadraticQuestion({ options: ['One'] })).toMatch(/two/);
  expect(validateQuadraticQuestion({ options: ['One', ' one '] })).toMatch(/unique/);
  expect(validateQuadraticQuestion({ options: ['One', ' '] })).toMatch(/nonblank/);
});

it('changes identity with the option order, labels, and budget; commitments preserve signs and order', () => {
  const id = generateQuestionId('quadratic', 'Priorities', question.options);
  expect(id).toBe(generateQuestionId('quadratic', 'Priorities', question.options, false, 99));
  expect(id).not.toBe(generateQuestionId('quadratic', 'Priorities', question.options, false, 100));
  expect(id).not.toBe(generateQuestionId('quadratic', 'Priorities', [...question.options].reverse()));
  expect(id).not.toBe(generateQuestionId('quadratic', 'Priorities', ['Parks', 'Housing']));
  expect(new TextDecoder().decode(encodeValueBytes('quadratic', [3, -4]))).toBe('[3,-4]');
  expect(encodeValueBytes('quadratic', [3, -4])).not.toEqual(encodeValueBytes('quadratic', [-4, 3]));
});

it('edits and restores votes, reports costs, rejects overspending, and allows explicit neutrality', () => {
  function Form() {
    const [value, setValue] = useState<number[]>([3, -4]);
    return <QuadraticAllocationInput questionId="q" {...question} value={value} onChange={setValue} />;
  }
  render(<Form />);
  expect(screen.getByRole('status')).toHaveTextContent('74 credits left');
  fireEvent.change(screen.getByLabelText('Parks'), { target: { value: '9' } });
  expect(screen.getByRole('status')).toHaveTextContent('2 credits left');
  fireEvent.change(screen.getByLabelText('Transit'), { target: { value: '-5' } });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Transit')).toHaveValue('-4');
  fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
  expect(screen.getByRole('status')).toHaveTextContent('99 credits left');
  expect(screen.getByLabelText('Parks')).toHaveValue('0');
  expect(screen.getByTestId('ce-quadratic-cost-0')).toBeEmptyDOMElement();
  expect(screen.getByTestId('ce-quadratic-cost-1')).toBeEmptyDOMElement();
  fireEvent.change(screen.getByLabelText('Parks'), { target: { value: '-7' } });
  expect(screen.getByTestId('ce-quadratic-cost-0')).toHaveTextContent('49 credits');
  fireEvent.change(screen.getByLabelText('Parks'), { target: { value: '0' } });
  expect(screen.getByTestId('ce-quadratic-cost-0')).toBeEmptyDOMElement();
});

it('respects disabled state and excludes encrypted or invalid results', () => {
  const onChange = jest.fn();
  render(<QuadraticAllocationInput questionId="q" {...question} value={[0, 0]} disabled onChange={onChange} />);
  expect(screen.getByLabelText('Parks')).toBeDisabled();
  render(
    <QuadraticAllocationResults
      question={question}
      responses={[
        { answer: { value: [3, -4] } },
        { answer: { value: [-2, 5] } },
        { answer: { value: [0, 0] } },
        { answer: { value: [9, 9] } },
        { answer: { value: '*', encrypted: true } },
      ]}
    />,
  );
  expect(screen.getByRole('table', { name: 'Quadratic allocation results' })).toBeInTheDocument();
  expect(screen.getByTestId('ce-quadratic-results')).toHaveTextContent('2 encrypted or invalid');
  expect(screen.getAllByRole('row')[1]).toHaveTextContent('Parks3-21');
});

it('uses a centered slider, shows signed vote costs, and explains the shared budget', async () => {
  render(<QuadraticAllocationInput questionId="q" options={['Parks', 'Transit', 'Housing']} value={[7, 3, -4]} />);
  const input = screen.getByRole('slider', { name: 'Parks' });
  expect(input).toHaveAttribute('min', '-9');
  expect(input).toHaveAttribute('max', '9');
  expect(input).toHaveAttribute('aria-valuetext', '+7 votes, 49 credits, support');
  expect(screen.getByTestId('ce-quadratic-cost-0')).toHaveTextContent('49 credits');
  expect(screen.getByRole('status')).toHaveTextContent('25 credits left');
  fireEvent.focus(screen.getByRole('button', { name: 'How voice credits work' }));
  expect(await screen.findByRole('tooltip')).toHaveTextContent('+7 or −7 uses 49 credits');
  expect(screen.getByRole('tooltip')).toHaveTextContent('You may leave credits unused');
  expect(screen.queryByRole('button', { name: /submit/i })).not.toBeInTheDocument();
});

it('clamps a large slider movement to affordability and always allows recovering credits', () => {
  function Form() {
    const [value, setValue] = useState([3, -4]);
    return (
      <QuadraticAllocationInput questionId="q" {...question} voiceCredits={25} value={value} onChange={setValue} />
    );
  }
  render(<Form />);
  fireEvent.change(screen.getByRole('slider', { name: 'Parks' }), { target: { value: '5' } });
  expect(screen.getByRole('slider', { name: 'Parks' })).toHaveValue('3');
  expect(screen.getByRole('status')).toHaveTextContent('0 credits left');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('slider', { name: 'Transit' }), { target: { value: '0' } });
  expect(screen.getByRole('status')).toHaveTextContent('16 credits left');
  fireEvent.change(screen.getByRole('slider', { name: 'Parks' }), { target: { value: '-5' } });
  expect(screen.getByRole('slider', { name: 'Parks' })).toHaveValue('-5');
  expect(screen.getByRole('status')).toHaveTextContent('0 credits left');
});

it('includes decrypted allocations even when the persisted encryption flag remains set', () => {
  render(
    <QuadraticAllocationResults question={question} responses={[{ answer: { value: [3, -4], encrypted: true } }]} />,
  );
  expect(screen.getByTestId('ce-quadratic-results')).not.toHaveTextContent('encrypted or invalid');
  expect(screen.getAllByRole('row')[1]).toHaveTextContent('Parks303');
});

it.each([undefined, null, '', [0, 0]])('does not create a pending answer when resetting %p', (value) => {
  const onChange = jest.fn();
  render(<QuadraticAllocationInput questionId="q" {...question} value={value} onChange={onChange} />);
  const reset = screen.getByRole('button', { name: 'Reset' });
  expect(reset).toBeDisabled();
  fireEvent.click(reset);
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole('slider', { name: 'Parks' }), { target: { value: '2' } });
  expect(onChange).toHaveBeenCalledWith([2, 0]);
});
