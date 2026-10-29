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
    const sessionConfig = {
      slug: 'demo-session',
      sessionId: '0x88888888888888888888888888888888',
    };

    const text = await uploadAudioForTranscription(
      new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/wav' }),
      {
        endpoint: 'https://worker.example/transcribe',
        baseUrl: 'https://worker.example',
        sessionSlug: 'demo-session',
        sessionConfig,
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
        sessionConfig,
        sessionSlug: 'demo-session',
        workerUrl: 'https://worker.example',
      }),
    );
    expect(authOptions?.anonymousOnly).not.toBe(true);

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

it('opts group transcription into speaker labels without changing the text-only caller', async () => {
  const transport = { endpoint: 'https://worker.example/transcribe', baseUrl: 'https://worker.example' };
  const turns = [{ speaker: 'A', start: 0, end: 2, text: 'Room question.' }];
  mockedFetchWorkerWithAuth.mockResolvedValue({
    ok: true,
    json: async () => ({ text: 'Room question.', segments: turns }),
  } as Response);
  const { uploadAudioForDiarizedTranscription } = await import('./aiClientTranscriptionWorkerTransport');
  await expect(uploadAudioForDiarizedTranscription(new Blob(['audio']), transport)).resolves.toEqual({
    text: 'Room question.',
    segments: turns,
  });
  const form = mockedFetchWorkerWithAuth.mock.lastCall?.[1]?.body as FormData;
  expect(form.get('model')).toBe('gpt-4o-transcribe-diarize');
  expect(form.get('purpose')).toBe('group-conversation');
  expect(form.get('labelSpeakers')).toBe('true');
  await expect(uploadAudioForTranscription(new Blob(['audio']), transport)).resolves.toBe('Room question.');
  expect((mockedFetchWorkerWithAuth.mock.lastCall?.[1]?.body as FormData).get('labelSpeakers')).toBeNull();
});

it('handles silent labeled clips, old Workers, and provider errors explicitly', async () => {
  const { uploadAudioForDiarizedTranscription } = await import('./aiClientTranscriptionWorkerTransport');
  const transport = { endpoint: 'https://worker.example/transcribe', baseUrl: 'https://worker.example' };
  mockedFetchWorkerWithAuth.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ text: '', segments: [] }),
  } as Response);
  await expect(uploadAudioForDiarizedTranscription(new Blob(['audio']), transport)).resolves.toEqual({
    text: '',
    segments: [],
  });
  mockedFetchWorkerWithAuth.mockResolvedValueOnce({ ok: true, json: async () => ({ text: 'Plain text' }) } as Response);
  await expect(uploadAudioForDiarizedTranscription(new Blob(['audio']), transport)).rejects.toThrow(
    'does not support speaker labels',
  );
  mockedFetchWorkerWithAuth.mockResolvedValueOnce({
    ok: false,
    status: 429,
    json: async () => ({ error: 'Synthetic capacity error' }),
  } as Response);
  await expect(uploadAudioForDiarizedTranscription(new Blob(['audio']), transport)).rejects.toThrow(
    'Synthetic capacity error',
  );
});
