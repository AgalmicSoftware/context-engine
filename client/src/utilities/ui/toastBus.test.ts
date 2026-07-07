import { showToast, subscribeToToasts, type ToastListener, type ToastOptions, type ToastPayload } from './toastBus.js';

describe('toastBus', () => {
  it('normalizes emitted payloads before notifying subscribers', () => {
    const payloads: ToastPayload[] = [];
    const unsubscribe = subscribeToToasts((payload) => {
      payloads.push(payload);
    });

    try {
      const id = showToast(' Saved locally ', {
        kind: 'success',
        duration: Number.NaN,
        icon: 'OK',
      });

      expect(id).toBe(payloads[0]?.id);
      expect(payloads).toEqual([
        {
          id: expect.stringMatching(/^ce-toast-\d+-\d+$/),
          message: 'Saved locally',
          kind: 'success',
          duration: 4000,
          icon: 'OK',
        },
      ]);
    } finally {
      unsubscribe();
    }
  });

  it('falls back to defaults for nullish messages and malformed JS options', () => {
    const payloads: ToastPayload[] = [];
    const unsubscribe = subscribeToToasts((payload) => {
      payloads.push(payload);
    });

    try {
      showToast(null, 'not-options' as unknown as ToastOptions);

      expect(payloads).toEqual([
        expect.objectContaining({
          message: '',
          kind: 'info',
          duration: 4000,
          icon: '',
        }),
      ]);
    } finally {
      unsubscribe();
    }
  });

  it('continues notifying subscribers when one listener throws', () => {
    const throwingListener = jest.fn(() => {
      throw new Error('toast listener failed');
    });
    const receivingListener = jest.fn();
    const unsubscribeThrowing = subscribeToToasts(throwingListener);
    const unsubscribeReceiving = subscribeToToasts(receivingListener);

    try {
      expect(() => showToast('Continue')).not.toThrow();

      expect(throwingListener).toHaveBeenCalledTimes(1);
      expect(receivingListener).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Continue',
        }),
      );
    } finally {
      unsubscribeThrowing();
      unsubscribeReceiving();
    }
  });

  it('removes subscribers when unsubscribe is called', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToToasts(listener);

    showToast('First');
    unsubscribe();
    showToast('Second');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'First',
      }),
    );
  });

  it('ignores non-function subscribers at runtime', () => {
    const unsubscribe = subscribeToToasts(null as unknown as ToastListener);

    expect(() => showToast('Ignored')).not.toThrow();
    unsubscribe();
  });
});
