import { toTrimmedString } from './stringCoercion.js';

export const MISSING_TRANSCRIBE_FILE_ERROR = 'Missing file (use field "file"; "audio" also accepted).';
export const MISSING_TRANSCRIBE_RPC_URL_ERROR = 'Missing rpcUrl for custom transcription.';

export const normalizeTranscribeRequestPayload = ({ formData } = {}) => {
  const form = formData && typeof formData.get === 'function' ? formData : null;
  if (!form) {
    return {
      ok: false,
      status: 400,
      error: 'Expected multipart/form-data.',
      payload: null,
    };
  }

  const model = toTrimmedString(form.get('model') || 'whisper-1') || 'whisper-1';
  const provider = toTrimmedString(form.get('provider') || 'openai').toLowerCase();
  const apiKey = toTrimmedString(form.get('apiKey'));
  const rpcUrl = toTrimmedString(form.get('rpcUrl'));
  const file = form.get('file') || form.get('audio');
  if (!file) {
    return {
      ok: false,
      status: 400,
      error: MISSING_TRANSCRIBE_FILE_ERROR,
      payload: null,
    };
  }
  if (provider !== 'openai' && provider !== 'custom') {
    return {
      ok: false,
      status: 400,
      error: `Unsupported transcription provider: ${provider}`,
      payload: null,
    };
  }
  if (provider === 'custom' && !rpcUrl) {
    return {
      ok: false,
      status: 400,
      error: MISSING_TRANSCRIBE_RPC_URL_ERROR,
      payload: null,
    };
  }

  const upstreamFormData = new FormData();
  upstreamFormData.append('file', file, file.name || 'audio.mp3');
  upstreamFormData.append('model', model);
  upstreamFormData.append('response_format', 'json');

  return {
    ok: true,
    status: 200,
    error: '',
    payload: {
      formData: form,
      file,
      model,
      provider,
      requestApiKey: apiKey,
      requestRpcUrl: rpcUrl,
      upstreamFormData,
    },
  };
};

export const readTranscribeRequestPayload = async ({ request } = {}) => {
  let formData = null;
  try {
    formData = await request.formData();
  } catch {
    return {
      ok: false,
      status: 400,
      error: 'Expected multipart/form-data.',
      payload: null,
    };
  }

  return normalizeTranscribeRequestPayload({ formData });
};
