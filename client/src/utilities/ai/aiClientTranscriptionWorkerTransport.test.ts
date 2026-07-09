import {
  resolveTranscriptionWorkerEndpoint,
  uploadAudioForTranscription,
} from './aiClientTranscriptionWorkerTransport';
import { fetchWorkerWithAuth } from '../worker/workerAuth.js';

jest.mock('../worker/workerAuth.js', () => ({
  fetchWorkerWithAuth: jest.fn(),
}));

jest.mock('../worker/workerSessionResolution.js', () => ({
  defaultStrictAllowDemoFallback: jest.fn(() => false),
}));

const mockedFetchWorkerWithAuth = jest.mocked(fetchWorkerWithAuth);

describe('aiClientTranscriptionWorkerTransport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('normalizes transcription endpoints without losing the base worker URL', () => {
    expect(resolveTranscriptionWorkerEndpoint('https://worker.example')).toEqual({
      endpoint: 'https://worker.example/transcribe',
      baseUrl: 'https://worker.example',
    });
    expect(resolveTranscriptionWorkerEndpoint('https://worker.example/transcribe')).toEqual({
      endpoint: 'https://worker.example/transcribe',
      baseUrl: 'https://worker.example',
    });
  });

  it('uploads multipart audio with transcription config and anonymous-first auth', async () => {
    mockedFetchWorkerWithAuth.mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'hello world' }),
    } as Response);

    const text = await uploadAudioForTranscription(
      new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/wav' }),
      {
        endpoint: 'https://worker.example/transcribe',
        baseUrl: 'https://worker.example',
        sessionSlug: 'demo-session',
        transcriptionCfg: {
          provider: 'openai',
          model: 'whisper-1',
          apiKey: 'sk-local',
          rpcUrl: 'https://rpc.example',
        },
      },
      { fileName: 'meeting.wav' },
    );

    expect(text).toBe('hello world');
    const [endpoint, requestInit, authOptions] = mockedFetchWorkerWithAuth.mock.calls[0] || [];
    expect(endpoint).toBe('https://worker.example/transcribe');
    expect(requestInit).toEqual(expect.objectContaining({ method: 'POST' }));
    expect(authOptions).toEqual(
      expect.objectContaining({
        allowDemoFallback: false,
        fallbackOnGateUnavailable: true,
        preferAnonymous: true,
        sessionSlug: 'demo-session',
        workerUrl: 'https://worker.example',
      }),
    );

    const form = requestInit?.body as FormData;
    expect(form.get('provider')).toBe('openai');
    expect(form.get('model')).toBe('whisper-1');
    expect(form.get('apiKey')).toBe('sk-local');
    expect(form.get('rpcUrl')).toBe('https://rpc.example');
    expect((form.get('file') as File).name).toBe('meeting.wav');
  });

  it('uses worker error messages without throwing on JSON parse failures', async () => {
    mockedFetchWorkerWithAuth.mockResolvedValueOnce({
      ok: true,
      json: async () => {
        throw new Error('not json');
      },
    } as Response);
    const onJsonParseError = jest.fn();

    await expect(
      uploadAudioForTranscription(
        new Blob(['audio'], { type: 'audio/wav' }),
        {
          endpoint: 'https://worker.example/transcribe',
          baseUrl: 'https://worker.example',
        },
        { onJsonParseError },
      ),
    ).resolves.toBe('');
    expect(onJsonParseError).toHaveBeenCalledWith(expect.any(Error));

    mockedFetchWorkerWithAuth.mockResolvedValueOnce({
      ok: false,
      status: 413,
      json: async () => ({ error: { message: 'Too large' } }),
    } as Response);

    await expect(
      uploadAudioForTranscription(new Blob(['audio'], { type: 'audio/wav' }), {
        endpoint: 'https://worker.example/transcribe',
        baseUrl: 'https://worker.example',
      }),
    ).rejects.toThrow('Too large');
  });
});
