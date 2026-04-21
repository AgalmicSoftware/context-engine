import { render, screen, within } from '@testing-library/react';
import CreateQuestionsAndSurveys from './CreateQuestionsAndSurveys.jsx';
import gateLockStyles from '../Gates/GateMultiSelectLock.module.scss';
import surveyStyles from './CreateQuestionsAndSurveys.module.scss';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

const makeInstance = (props = {}) => {
  const instance = new CreateQuestionsAndSurveys({
    network: { id: 84532 },
    activeSessionSlug: 'edge',
    ...props,
  });
  instance._isMounted = true;
  instance.setState = jest.fn((update, cb) => {
    const patch = typeof update === 'function'
      ? update(instance.state, instance.props)
      : update;
    if (patch && typeof patch === 'object') {
      instance.state = { ...instance.state, ...patch };
    }
    if (typeof cb === 'function') cb();
  });
  return instance;
};

describe('CreateQuestionsAndSurveys lock UI', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders the survey title lock without SBT badge text or inline gate dots', () => {
    const instance = makeInstance();
    instance.resolveGateOptions = jest.fn(() => ({
      gateMap: {
        gate_1: { id: 'gate_1' },
        gate_2: { id: 'gate_2' },
      },
      gateOptions: [
        { id: 'gate_1', label: 'Edge Alpha', badgeLabel: 'Edge Alpha', color: '#5affc2' },
        { id: 'gate_2', label: 'Edge Beta', badgeLabel: 'Edge Beta', color: '#5b8cff' },
      ],
      defaultGateId: 'gate_1',
    }));
    instance.state = {
      ...instance.state,
      showAutoTool: false,
      isStandaloneQuestion: false,
      title: 'Survey Title',
      surveyLockGateIds: ['gate_1', 'gate_2'],
      questions: [{
        uiKey: 'q1',
        id: 'q1',
        type: 'freeform',
        prompt: 'Question 1',
        tags: [],
        currentTagInputValue: '',
        aiGeneratedTagsFromSource: [],
        isGeneratingTags: false,
      }],
    };

    const { container } = render(instance.render());
    const titleLock = container.querySelector(`.${surveyStyles.surveyTitleLock}`);

    expect(titleLock).not.toBeNull();
    expect(within(titleLock).getByTestId(E2E_TESTIDS.GATE_LOCK_BUTTON)).toBeInTheDocument();
    expect(within(titleLock).queryByText(/\bSBT\b/i)).not.toBeInTheDocument();
    expect(within(titleLock).queryByText(/Edge Alpha/i)).not.toBeInTheDocument();
    expect(within(titleLock).queryByText(/Edge Beta/i)).not.toBeInTheDocument();
    expect(within(titleLock).queryByText(/\b\d+\s+gates?\b/i)).not.toBeInTheDocument();
    expect(titleLock.querySelector(`.${gateLockStyles.dots}`)).toBeNull();
  });

  it('renders the question header lock without SBT badge text or inline gate dots', () => {
    const instance = makeInstance();
    instance.resolveGateOptions = jest.fn(() => ({
      gateMap: {
        gate_1: { id: 'gate_1' },
        gate_2: { id: 'gate_2' },
      },
      gateOptions: [
        { id: 'gate_1', label: 'Edge Alpha', badgeLabel: 'Edge Alpha', color: '#5affc2' },
        { id: 'gate_2', label: 'Edge Beta', badgeLabel: 'Edge Beta', color: '#5b8cff' },
      ],
      defaultGateId: 'gate_1',
    }));
    instance.state = {
      ...instance.state,
      showAutoTool: false,
      isStandaloneQuestion: false,
      title: 'Survey Title',
      surveyLockGateIds: [],
      questions: [{
        uiKey: 'q1',
        id: 'q1',
        type: 'freeform',
        prompt: 'Question 1',
        lockGateIds: ['gate_1', 'gate_2'],
        tags: [],
        currentTagInputValue: '',
        aiGeneratedTagsFromSource: [],
        isGeneratingTags: false,
      }],
    };

    const { container } = render(instance.render());
    const questionLock = container.querySelector(`.${surveyStyles.questionHeaderActions}`);

    expect(questionLock).not.toBeNull();
    expect(within(questionLock).getByTestId(E2E_TESTIDS.GATE_LOCK_BUTTON)).toBeInTheDocument();
    expect(within(questionLock).queryByText(/\bSBT\b/i)).not.toBeInTheDocument();
    expect(within(questionLock).queryByText(/Edge Alpha/i)).not.toBeInTheDocument();
    expect(within(questionLock).queryByText(/Edge Beta/i)).not.toBeInTheDocument();
    expect(within(questionLock).queryByText(/\b\d+\s+gates?\b/i)).not.toBeInTheDocument();
    expect(questionLock.querySelector(`.${gateLockStyles.dots}`)).toBeNull();
  });
});
