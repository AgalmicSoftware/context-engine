import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import QuadraticAllocationInput from './QuadraticAllocationInput';
import SurveyQuestionsFullQuestionCardShell from './SurveyQuestionsFullQuestionCardShell';
import { renderPileCardShell } from './surveyPileActiveQuestionCard';
import { renderPileFooterSection } from './surveyPileQuestionSections';
import { QuadraticScrollControlsProvider, QuadraticScrollControlsSlot } from './QuadraticScrollControls';
import SessionInterviewDraftCard from './SessionInterviewDraftCard';

const options = ['Parks', 'Transit', 'Housing', 'Libraries'];
const rectangle = (top = 0, height = 100): DOMRect =>
  ({ top, bottom: top + height, left: 0, right: 200, width: 200, height, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;
let originalResizeObserver: typeof ResizeObserver;
let originalMatchMedia: typeof window.matchMedia;

beforeEach(() => {
  originalResizeObserver = global.ResizeObserver;
  originalMatchMedia = window.matchMedia;
  window.matchMedia = jest.fn().mockReturnValue({ matches: false });
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  jest.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(100);
  jest.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(240);
  jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const option = this.hasAttribute('data-quadratic-option-label') ? this.closest('[data-direction]') : this;
    if (option?.hasAttribute('data-direction') && option.querySelector('input[type="range"]')) {
      return rectangle(Array.from(option.parentElement!.children).indexOf(option) * 60, 60);
    }
    return rectangle();
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  global.ResizeObserver = originalResizeObserver;
  window.matchMedia = originalMatchMedia;
});

function PileCard({
  id,
  input = true,
  questionOptions = options,
}: {
  id: string;
  input?: boolean;
  questionOptions?: string[];
}) {
  return renderPileCardShell({
    questionType: 'quadratic',
    promptHeader: id,
    questionContainerClass: 'question-input',
    questionComponent: input ? <QuadraticAllocationInput questionId={id} options={questionOptions} /> : null,
    footerSection: renderPileFooterSection({
      sliderSection: <button>Intensity {id}</button>,
      questionIcons: <button>Comments {id}</button>,
      commentsSection: null,
    }),
  });
}

it('places each pile card scroll control beside its own footer icons and scrolls only its list', () => {
  const { rerender } = render(
    <>
      <PileCard id="first" />
      <PileCard id="second" />
    </>,
  );
  const firstFooter = screen.getByRole('button', { name: 'Intensity first' }).parentElement!;
  const secondFooter = screen.getByRole('button', { name: 'Intensity second' }).parentElement!;
  const firstNext = within(firstFooter).getByRole('button', { name: 'Scroll to more options' });
  const secondNext = within(secondFooter).getByRole('button', { name: 'Scroll to more options' });
  const firstList = document.getElementById(firstNext.getAttribute('aria-controls')!)!;
  const secondList = document.getElementById(secondNext.getAttribute('aria-controls')!)!;
  const firstScroll = jest.fn();
  const secondScroll = jest.fn();
  firstList.scrollTo = firstScroll;
  secondList.scrollTo = secondScroll;
  expect(firstList).not.toBe(secondList);
  expect(firstList.closest('fieldset')).not.toContainElement(firstNext);
  fireEvent.click(firstNext);
  expect(firstScroll).toHaveBeenCalledWith({ top: 60, behavior: 'smooth' });
  expect(secondScroll).not.toHaveBeenCalled();
  firstList.scrollTop = 140;
  fireEvent.scroll(firstList);
  expect(within(firstFooter).queryByRole('button', { name: 'Scroll to more options' })).not.toBeInTheDocument();
  const previous = within(firstFooter).getByRole('button', { name: 'Scroll to previous options' });
  const previousScroll = jest.fn();
  firstList.scrollBy = previousScroll;
  fireEvent.click(previous);
  expect(previousScroll).toHaveBeenCalledWith({ top: -80, behavior: 'smooth' });
  rerender(
    <>
      <PileCard id="first" input={false} />
      <PileCard id="second" />
    </>,
  );
  expect(within(firstFooter).queryByRole('button', { name: /Scroll to/ })).not.toBeInTheDocument();
  expect(within(secondFooter).getByRole('button', { name: 'Scroll to more options' })).toBeInTheDocument();
});

it('places full-question scroll controls with the footer while keeping the allocation label intact', () => {
  render(
    <SurveyQuestionsFullQuestionCardShell
      mainContent={<QuadraticAllocationInput questionId="full" options={options} value={[3, 0, 0, 0]} />}
      sliderSection={<button>Full intensity</button>}
      footerIcons={<button>Full comments</button>}
    />,
  );
  const footer = screen.getByRole('button', { name: 'Full intensity' }).parentElement!;
  expect(within(footer).getByRole('button', { name: 'Scroll to more options' })).toBeInTheDocument();
  expect(screen.getByRole('slider', { name: 'Parks' })).toHaveAttribute(
    'aria-valuetext',
    '+3 votes, 9 credits, support',
  );
});

it('keeps working inline when rendered without a card footer', () => {
  render(<QuadraticAllocationInput questionId="standalone" options={options} />);
  const allocation = screen.getByRole('group', { name: 'Quadratic allocation' });
  expect(within(allocation).getByRole('button', { name: 'Scroll to more options' })).toBeInTheDocument();
});

it('moves controls back inline when the footer slot unmounts and reattaches without losing the list', () => {
  function Card({ footer }: { footer: boolean }) {
    return (
      <QuadraticScrollControlsProvider>
        <QuadraticAllocationInput questionId="toggle" options={options} />
        <footer aria-label="Toggle footer">{footer && <QuadraticScrollControlsSlot />}</footer>
      </QuadraticScrollControlsProvider>
    );
  }
  const { rerender } = render(<Card footer />);
  const footer = screen.getByRole('contentinfo', { name: 'Toggle footer' });
  const originalListId = within(footer)
    .getByRole('button', { name: 'Scroll to more options' })
    .getAttribute('aria-controls');
  rerender(<Card footer={false} />);
  expect(within(footer).queryByRole('button', { name: /Scroll to/ })).not.toBeInTheDocument();
  const allocation = screen.getByRole('group', { name: 'Quadratic allocation' });
  expect(within(allocation).getByRole('button', { name: 'Scroll to more options' })).toHaveAttribute(
    'aria-controls',
    originalListId,
  );
  rerender(<Card footer />);
  expect(within(footer).getByRole('button', { name: 'Scroll to more options' })).toHaveAttribute(
    'aria-controls',
    originalListId,
  );
  expect(within(allocation).queryByRole('button', { name: /Scroll to/ })).not.toBeInTheDocument();
});

it('resets scrolling when the same mounted input changes question and options', () => {
  const { rerender } = render(<PileCard id="before" />);
  const footer = screen.getByRole('button', { name: 'Intensity before' }).parentElement!;
  const next = within(footer).getByRole('button', { name: 'Scroll to more options' });
  const list = document.getElementById(next.getAttribute('aria-controls')!)!;
  list.scrollTop = 140;
  fireEvent.scroll(list);
  expect(within(footer).getByRole('button', { name: 'Scroll to previous options' })).toBeInTheDocument();
  rerender(<PileCard id="after" questionOptions={options.slice(1)} />);
  expect(list.scrollTop).toBe(0);
  expect(list.closest('fieldset')).toHaveAttribute('data-question-id', 'after');
  expect(within(list).queryByRole('slider', { name: 'Parks' })).not.toBeInTheDocument();
  expect(within(list).getByRole('slider', { name: 'Transit' })).toBeInTheDocument();
  expect(within(footer).queryByRole('button', { name: 'Scroll to previous options' })).not.toBeInTheDocument();
  expect(within(footer).getByRole('button', { name: 'Scroll to more options' })).toHaveAttribute(
    'aria-controls',
    list.id,
  );
});

it('places interview controls beside the existing icons for native and injected inputs', () => {
  const draft = { questionId: 'interview', answer: [0, 0, 0, 0] };
  const props = {
    draft,
    edited: draft,
    question: { id: 'interview', type: 'quadratic', prompt: 'Priorities', options },
    selected: true,
    existing: false,
    disabled: false,
    onEdit: jest.fn(),
    onSelect: jest.fn(),
  };
  const { rerender } = render(<SessionInterviewDraftCard {...props} />);
  const footer = screen.getByRole('button', { name: 'Conviction / importance' }).parentElement!.parentElement!;
  expect(within(footer).getByRole('button', { name: 'Scroll to more options' })).toBeInTheDocument();
  rerender(
    <SessionInterviewDraftCard
      {...props}
      renderAnswerInput={() => <QuadraticAllocationInput questionId="injected" options={options} />}
    />,
  );
  expect(within(footer).getByRole('button', { name: 'Scroll to more options' })).toBeInTheDocument();
  expect(screen.getByRole('group', { name: 'Quadratic allocation' })).not.toContainElement(
    within(footer).getByRole('button', { name: 'Scroll to more options' }),
  );
});
