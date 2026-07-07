import React from 'react';

import AudioInput from '../Shared/AudioInput/AudioInput';

type SurveyAudioWorkerProps = {
  sessionSlug?: string;
  sessionConfig?: Record<string, unknown> | null;
  context?: unknown;
  workerUrl?: string;
};

type SurveyAudioFieldInputProps = SurveyAudioWorkerProps & {
  placeholder: string;
  placeholderOpacity?: number;
  value?: string | number | null;
  encrypted?: boolean;
  dataTestId?: string;
  dataCeQuestionId?: string;
  forceGlow?: boolean;
  disabled?: boolean;
  disableEncryption?: boolean;
  enableDownloads?: boolean;
  updateFunction: (value: string) => void;
  toggleEncryption: (encrypted: boolean) => void;
};

const SurveyAudioFieldInput = ({
  placeholder,
  placeholderOpacity = 0.5,
  value = '',
  encrypted = false,
  dataTestId = '',
  dataCeQuestionId = '',
  forceGlow = false,
  disabled = false,
  disableEncryption = true,
  enableDownloads = false,
  updateFunction,
  toggleEncryption,
  sessionSlug,
  sessionConfig,
  context,
  workerUrl,
}: SurveyAudioFieldInputProps) => (
  <AudioInput
    sessionSlug={sessionSlug}
    sessionConfig={sessionConfig}
    context={context}
    workerUrl={workerUrl}
    placeholder={placeholder}
    placeholderOpacity={placeholderOpacity}
    value={value}
    updateFunction={updateFunction}
    toggleEncryption={toggleEncryption}
    encrypted={encrypted}
    dataTestId={dataTestId}
    dataCeQuestionId={dataCeQuestionId}
    smallEncryptToggle
    disabled={disabled}
    forceGlow={forceGlow}
    disableEncryption={disableEncryption}
    enableDownloads={enableDownloads}
  />
);

export default React.memo(SurveyAudioFieldInput);
