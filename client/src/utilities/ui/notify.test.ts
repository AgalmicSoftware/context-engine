describe('notify', () => {
  let notify: typeof import('./notify.js').notify;
  let mockShowToast: jest.Mock;
  let mockLogger: {
    info: jest.Mock;
    warn: jest.Mock;
    error: jest.Mock;
  };

  beforeEach(() => {
    jest.resetModules();
    mockShowToast = jest.fn();
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    jest.doMock('./toastBus.js', () => ({
      showToast: (...args: unknown[]) => mockShowToast(...args),
    }));

    jest.doMock('../logging', () => ({
      createLogger: () => mockLogger,
    }));

    jest.isolateModules(() => {
      notify = require('./notify.js').notify;
    });
  });

  it('emits success toasts through the CE toast bus', () => {
    notify.success(' Saved ');

    expect(mockLogger.info).toHaveBeenCalledWith('Saved');
    expect(mockShowToast).toHaveBeenCalledWith('Saved', { kind: 'success' });
  });

  it('emits error toasts with the provided duration', () => {
    notify.error('Failed', 9000);

    expect(mockLogger.error).toHaveBeenCalledWith('Failed');
    expect(mockShowToast).toHaveBeenCalledWith('Failed', {
      kind: 'error',
      duration: 9000,
    });
  });

  it('emits warning toasts with the current warning icon', () => {
    notify.warn('Careful');

    expect(mockLogger.warn).toHaveBeenCalledWith('Careful');
    expect(mockShowToast).toHaveBeenCalledWith('Careful', {
      kind: 'warn',
      icon: '⚠️',
    });
  });

  it('emits info toasts with the info icon', () => {
    notify.info('Heads up');

    expect(mockLogger.info).toHaveBeenCalledWith('Heads up');
    expect(mockShowToast).toHaveBeenCalledWith('Heads up', {
      kind: 'info',
      icon: 'ℹ️',
    });
  });
});
