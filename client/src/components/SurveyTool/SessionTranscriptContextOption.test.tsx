import { fireEvent, render, screen } from '@testing-library/react';
import SessionTranscriptContextOption from './SessionTranscriptContextOption';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

const upload = (overrides = {}) =>
  ({
    available: true,
    chosen: false,
    setChosen: jest.fn(),
    access: {},
    setAccess: jest.fn(),
    groups: [{ groupId: 'salon', label: 'Salon' }],
    allowAdminsOnly: false,
    status: '',
    failed: false,
    upload: jest.fn(),
    settled: jest.fn(),
    ...overrides,
  }) as unknown as React.ComponentProps<typeof SessionTranscriptContextOption>['upload'];

describe('the transcript box on the Submit questions line', () => {
  it('starts unticked, with who can read it only once ticked', () => {
    const state = upload();
    const { rerender } = render(<SessionTranscriptContextOption upload={state} />);
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_TRANSCRIPT_CONTEXT)).not.toBeChecked();
    expect(screen.queryByLabelText('Who can read the transcript')).toBeNull();
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_TRANSCRIPT_CONTEXT));
    expect(state.setChosen).toHaveBeenCalledWith(true);

    const ticked = upload({ chosen: true, access: { groupIds: ['salon'] } });
    rerender(<SessionTranscriptContextOption upload={ticked} />);
    const access = screen.getByLabelText('Who can read the transcript');
    expect(access).toHaveTextContent('Salon');
    fireEvent.click(access);
    expect(screen.queryByRole('button', { name: 'Admins only' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Everyone in the session' }));
    expect(ticked.setAccess).toHaveBeenCalledWith({});
  });

  it('shows the group chosen even before the list of groups has it, so the choice on screen is the real one', () => {
    render(
      <SessionTranscriptContextOption upload={upload({ chosen: true, access: { groupIds: ['later'] }, groups: [] })} />,
    );
    const access = screen.getByLabelText('Who can read the transcript');
    expect(access).toHaveTextContent('One group');
    fireEvent.click(access);
    expect(screen.getByRole('button', { name: 'This group', pressed: true })).toBeInTheDocument();
  });

  it('offers Admins only to admins', () => {
    render(<SessionTranscriptContextOption upload={upload({ chosen: true, allowAdminsOnly: true })} />);
    fireEvent.click(screen.getByLabelText('Who can read the transcript'));
    expect(screen.getByRole('button', { name: 'Admins only' })).toBeInTheDocument();
  });
});
