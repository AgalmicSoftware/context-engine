const OPENAI_REALTIME_CALLS_URL = 'https://api.openai.com/v1/realtime/calls';
export const DEFAULT_INTERVIEW_REALTIME_MODEL = 'gpt-realtime-2.1';

const trim = (value) => String(value == null ? '' : value).trim();
const isObj = (value) => !!value && typeof value === 'object' && !Array.isArray(value);

const buildRealtimeMultipartBody = ({ sdp, session }) => {
  const boundary = `----context-engine-realtime-${crypto.randomUUID().replace(/-/g, '')}`;
  const body = [
    `--${boundary}\r\n`,
    'Content-Disposition: form-data; name="sdp"\r\n',
    'Content-Type: application/sdp\r\n\r\n',
    sdp,
    `\r\n--${boundary}\r\n`,
    'Content-Disposition: form-data; name="session"\r\n',
    'Content-Type: application/json\r\n\r\n',
    JSON.stringify(session),
    `\r\n--${boundary}--\r\n`,
  ].join('');
  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
};

export const readRealtimeCallRequestPayload = async ({ request } = {}) => {
  let body;
  try {
    body = await request.json();
  } catch {
    return { ok: false, status: 400, error: 'Invalid JSON.' };
  }
  if (!isObj(body)) return { ok: false, status: 400, error: 'Invalid JSON.' };
  const sdp = String(body.sdp == null ? '' : body.sdp);
  const instructions = trim(body.instructions);
  if (!sdp || !/^v=0(?:\r?\n|$)/.test(sdp)) return { ok: false, status: 400, error: 'Invalid SDP offer.' };
  if (sdp.length > 64_000) return { ok: false, status: 413, error: 'SDP offer is too large.' };
  if (!instructions || instructions.length > 32_000) {
    return { ok: false, status: instructions ? 413 : 400, error: 'Interview instructions are missing or too large.' };
  }
  return { ok: true, payload: { sdp, instructions } };
};

const resolveRealtimeConfig = (config = {}) => {
  const interview = isObj(config.interviewMode || config.interview) ? (config.interviewMode || config.interview) : {};
  const provider = trim(interview.provider || 'openai').toLowerCase();
  const requestedModel = trim(interview.realtimeModel || config?.ai?.realtimeModel);
  const model = /^gpt-realtime(?:-[a-z0-9.]+)*$/i.test(requestedModel)
    ? requestedModel
    : DEFAULT_INTERVIEW_REALTIME_MODEL;
  return { provider, model };
};

export const proxyOpenAiRealtimeCall = async ({
  payload,
  secrets,
  config,
  baseHeaders,
  deps,
  constants,
} = {}) => {
  const fetchImpl = deps?.fetch || fetch;
  const realtime = resolveRealtimeConfig(config);
  if (realtime.provider !== 'openai') {
    return deps?.json?.({ error: 'Realtime interview voice currently requires the OpenAI provider.' }, 400, baseHeaders);
  }
  const key = trim(secrets?.openaiKey);
  if (!key) {
    return deps?.json?.({ error: 'Server misconfigured: openaiKey is missing.' }, 401, baseHeaders);
  }
  const session = {
    type: 'realtime',
    model: realtime.model,
    output_modalities: ['audio'],
    instructions: payload.instructions,
    max_output_tokens: 2048,
    audio: {
      input: {
        transcription: { model: 'gpt-transcribe' },
        turn_detection: {
          type: 'server_vad',
          create_response: true,
          interrupt_response: true,
        },
      },
    },
  };
  const multipart = buildRealtimeMultipartBody({ sdp: payload.sdp, session });
  const response = await fetchImpl(constants?.openAiRealtimeCallsUrl || OPENAI_REALTIME_CALLS_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${key}`,
      'content-type': multipart.contentType,
    },
    body: multipart.body,
  });
  const text = await response.text();
  if (!response.ok) {
    let message = 'OpenAI Realtime call failed.';
    try { message = JSON.parse(text)?.error?.message || message; } catch {}
    return deps?.json?.({ error: message }, response.status, baseHeaders);
  }
  const headers = new Headers(baseHeaders || {});
  headers.set('content-type', 'application/sdp');
  headers.set('cache-control', 'no-store');
  return new Response(text, { status: 200, headers });
};

export const __test__realtimeCallExecution = { buildRealtimeMultipartBody, resolveRealtimeConfig };
