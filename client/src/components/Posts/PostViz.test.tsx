import { fireEvent, render, screen, within } from '@testing-library/react';
import PostViz from './PostViz';

describe('PostViz presentation variants', () => {
  it('renders the editorial statistics treatment with the original model pie chart and confidence', () => {
    render(
      <PostViz
        spec={{
          type: 'response-type-grid',
          title: 'Statistics',
          inline: true,
          presentation: 'editorial',
          panels: [
            {
              kind: 'Models',
              title: 'Responding Model Type',
              display: 'pie',
              counts: [
                { label: 'model-a', value: 2, color: '#7aa7ff' },
                { label: 'model-b', value: 1, color: '#ff6bcb' },
                { label: 'model-c', value: 1, color: '#ffb347' },
              ],
            },
            {
              kind: 'Answer shapes',
              title: 'Prediction Response Types',
              display: 'ring',
              counts: [
                { label: 'binary', value: 160, color: '#7aa7ff' },
                { label: 'multi-select', value: 52, color: '#4dffa4' },
                { label: 'rating', value: 12, color: '#ffb347' },
                { label: 'freeform', value: 8, color: '#ff6bcb' },
              ],
            },
            {
              kind: 'Confidence',
              title: 'Agent confidence',
              display: 'bars',
              summaryValue: 80.8,
              summarySuffix: '/100',
              counts: [
                { label: '90-100', value: 69, color: '#4dffa4' },
                { label: '75-89', value: 108, color: '#7aa7ff' },
              ],
            },
          ],
        }}
      />,
    );

    const statistics = screen.getByRole('region', { name: 'Statistics' });
    const models = within(statistics).getByRole('group', { name: 'Responding Model Type' });
    expect(within(models).getByText('4 total')).toBeInTheDocument();
    const modelChart = within(models).getByRole('img', {
      name: 'Responding Model Type: model-a 2, model-b 1, model-c 1',
    });
    expect(modelChart).toBeInTheDocument();
    expect(within(models).queryByRole('img', { name: /distribution/i })).not.toBeInTheDocument();

    const answerShapes = within(statistics).getByRole('group', { name: 'Prediction Response Types' });
    const answerShapeChart = within(answerShapes).getByRole('img', {
      name: 'Prediction Response Types distribution: binary 160, multi-select 52, rating 12, freeform 8',
    });
    expect(modelChart).toHaveClass('editorialChartCircle');
    expect(answerShapeChart).toHaveClass('editorialChartCircle');

    const confidence = within(statistics).getByRole('group', { name: 'Agent confidence' });
    expect(within(confidence).getByText('80.8')).toBeInTheDocument();
    expect(within(confidence).getByText('/100')).toBeInTheDocument();
    expect(within(confidence).getByLabelText('75-89: 108')).toBeInTheDocument();
  });

  it('shows rating confidence on hover and pins it on click in the precision matrix', () => {
    render(
      <PostViz
        spec={{
          type: 'beeswarm',
          title: 'Rating answers',
          inline: true,
          presentation: 'precision',
          min: 0,
          max: 10,
          valueSuffix: '/10',
          participants: [
            { label: 'P1', status: 'completed', color: '#9ee7ff' },
            { label: 'P2', status: 'completed', color: '#7aa7ff' },
          ],
          items: [
            {
              label: 'AI improves flourishing',
              prompt: 'How optimistic am I that AI will broadly improve human flourishing over the next decade?',
              values: [
                { label: 'P1', value: 3, confidence: 70, color: '#9ee7ff' },
                { label: 'P2', value: 8, confidence: 90, color: '#7aa7ff' },
              ],
            },
          ],
        }}
      />,
    );

    const table = screen.getByRole('table', { name: 'Rating answers' });
    expect(within(table).getByRole('columnheader', { name: 'Question' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Response scale' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Median' })).toBeInTheDocument();

    const questionRow = within(table).getByRole('row', { name: /AI improves flourishing/i });
    expect(
      within(questionRow).getByText(
        'How optimistic am I that AI will broadly improve human flourishing over the next decade?',
      ),
    ).toBeInTheDocument();
    const p1Rating = within(questionRow).getByRole('button', { name: 'P1: 3/10, 70% confidence' });
    expect(p1Rating).toBeInTheDocument();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.mouseEnter(p1Rating);
    expect(screen.getByRole('tooltip')).toHaveTextContent('P1: 3/10');
    const confidenceLine = within(screen.getByRole('tooltip')).getByText('Confidence: 70%');
    expect(confidenceLine).toHaveClass('precisionTooltipConfidence');

    fireEvent.mouseLeave(p1Rating);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.click(p1Rating);
    expect(p1Rating).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('tooltip')).toHaveTextContent('Confidence: 70%');

    fireEvent.mouseLeave(p1Rating);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close rating details' }));
    expect(p1Rating).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(screen.queryByText('Participants')).not.toBeInTheDocument();
  });

  it('marks multi-select response panels for the expanded reading layout', () => {
    render(
      <PostViz
        spec={{
          type: 'response-type-grid',
          title: 'Other response shapes',
          inline: true,
          presentation: 'precision',
          panels: [
            {
              kind: 'Multi-select',
              title: 'Which area would I delegate first?',
              counts: [
                { label: 'event filtering', value: 3, color: '#ffb347' },
                { label: 'calendar scheduling', value: 2, color: '#7aa7ff' },
              ],
            },
            {
              kind: 'Freeform',
              title: 'What is my personal AI fire alarm?',
              quotes: [{ label: 'P1', text: 'A privacy-line crossing.' }],
            },
          ],
        }}
      />,
    );

    const multichoice = screen.getByRole('group', { name: 'Which area would I delegate first?' });
    expect(multichoice).toHaveClass('responseTypeMultiSelectPanel');
    expect(within(multichoice).getByText('event filtering')).toBeInTheDocument();
    expect(within(multichoice).getByLabelText('event filtering: 3')).toBeInTheDocument();
  });
});
