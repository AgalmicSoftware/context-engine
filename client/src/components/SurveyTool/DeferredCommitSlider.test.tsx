import { DeferredCommitSlider } from './SurveyTool.jsx';

const syncClassSetState = (subject: any) => {
  subject.setState = jest.fn((next: any, cb?: () => void) => {
    const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
    subject.state = { ...subject.state, ...(patch || {}) };
    if (typeof cb === 'function') cb();
    return patch;
  });
  return subject.setState;
};

describe('DeferredCommitSlider', () => {
  it('buffers single-question slider movement locally and only commits on completion', () => {
    const onCommit = jest.fn();
    const subject = new DeferredCommitSlider({
      value: 2,
      min: 0,
      max: 10,
      step: 1,
      onCommit,
      children: jest.fn(() => null),
    });
    syncClassSetState(subject);
    subject.state = { liveValue: 2, isInteracting: false };

    subject.handleChange(7, { type: 'mousemove' });

    expect(subject.state.liveValue).toBe(7);
    expect(subject.state.isInteracting).toBe(true);
    expect(onCommit).not.toHaveBeenCalled();

    subject.handleChangeComplete();

    expect(onCommit).toHaveBeenCalledWith(7);
  });
});
