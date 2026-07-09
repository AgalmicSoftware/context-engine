export const DEFAULT_OPENAI_TRANSCRIBE_URL = 'https://api.openai.com/v1/audio/transcriptions';
export const OPENAI_TRANSCRIBE_URL_ENV = 'CE_OPENAI_TRANSCRIBE_URL';

const toTrimmedString = (value) => (
  typeof value === 'string'
    ? value.trim()
    : value == null
      ? ''
      : String(value).trim()
);

export const resolveOpenAiTranscribeUrl = ({
  constants = null,
  env = null,
} = {}) => (
  toTrimmedString(constants?.openAiTranscribeUrl) ||
  toTrimmedString(constants?.OPENAI_TRANSCRIBE_URL) ||
  toTrimmedString(env?.[OPENAI_TRANSCRIBE_URL_ENV]) ||
  DEFAULT_OPENAI_TRANSCRIBE_URL
);
