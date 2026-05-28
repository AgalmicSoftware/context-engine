import {
  runSessionWizardPublishController,
} from './sessionWizardPublishController';

const buildPlan = (overrides = {}) => ({
  shouldAutoDeployWorker: true,
  stepNumbers: {
    'deploy-worker': 1,
  },
  ...overrides,
});

describe('runSessionWizardPublishController', () => {
  it('keeps blocked publish inert without calling side-effect ports', async () => {
    const deployWorker = jest.fn().mockResolvedValue({
      ok: true,
      deployComplete: true,
      workerUrl: 'https://worker.example',
    });
    const setPublishStep = jest.fn();

    await expect(runSessionWizardPublishController({
      input: {
        publishAllowed: false,
        publishExecutionPlan: buildPlan(),
      },
      ports: {
        deployWorker,
      },
      callbacks: {
        setPublishStep,
      },
    })).resolves.toEqual({
      status: 'blocked',
      workerUrlOverride: '',
    });

    expect(deployWorker).not.toHaveBeenCalled();
    expect(setPublishStep).not.toHaveBeenCalled();
  });

  it('calls the worker deploy port and progress callback in publish order', async () => {
    const events: string[] = [];
    const deployWorker = jest.fn().mockImplementation(async () => {
      events.push('deployWorker');
      return {
        ok: true,
        deployComplete: true,
        workerUrl: 'https://deployed-worker.example',
      };
    });
    const setPublishStep = jest.fn((step) => {
      events.push(`setPublishStep:${step}`);
    });

    await expect(runSessionWizardPublishController({
      input: {
        publishExecutionPlan: buildPlan({
          stepNumbers: {
            'deploy-worker': 3,
          },
        }),
      },
      ports: {
        deployWorker,
      },
      callbacks: {
        setPublishStep,
      },
    })).resolves.toEqual({
      status: 'completed',
      workerUrlOverride: 'https://deployed-worker.example',
    });

    expect(events).toEqual([
      'setPublishStep:3',
      'deployWorker',
    ]);
    expect(deployWorker).toHaveBeenCalledTimes(1);
  });

  it('skips worker deploy side effects when the plan has no auto-deploy step', async () => {
    const deployWorker = jest.fn();
    const setPublishStep = jest.fn();

    await expect(runSessionWizardPublishController({
      input: {
        publishExecutionPlan: buildPlan({
          shouldAutoDeployWorker: false,
          stepNumbers: {
            'register-session': 1,
            done: 2,
          },
        }),
      },
      ports: {
        deployWorker,
      },
      callbacks: {
        setPublishStep,
      },
    })).resolves.toEqual({
      status: 'completed',
      workerUrlOverride: '',
    });

    expect(deployWorker).not.toHaveBeenCalled();
    expect(setPublishStep).not.toHaveBeenCalled();
  });

  it('maps failed deploy results to the existing worker deploy error message', async () => {
    await expect(runSessionWizardPublishController({
      input: {
        publishExecutionPlan: buildPlan(),
      },
      ports: {
        deployWorker: jest.fn().mockResolvedValue({
          ok: false,
          error: 'Worker deploy failed upstream.',
        }),
      },
      callbacks: {
        setPublishStep: jest.fn(),
      },
    })).rejects.toThrow('Worker deploy failed upstream.');
  });

  it('preserves thrown deploy errors', async () => {
    const error = new Error('network refused deploy request');

    await expect(runSessionWizardPublishController({
      input: {
        publishExecutionPlan: buildPlan(),
      },
      ports: {
        deployWorker: jest.fn().mockRejectedValue(error),
      },
      callbacks: {
        setPublishStep: jest.fn(),
      },
    })).rejects.toBe(error);
  });
});
