import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { normalizeArweaveUrl } from '../../../utilities/arweave/arweaveUrls.js';
import { toStr } from '../../../utilities/shared/primitives.js';
import { readCompactImageClipboard } from '../../Shared/compactImageClipboard.js';
import type { SessionHeaderFieldProps } from '../SessionHeaderField';

export type SessionHeaderUploadStatusTone = NonNullable<SessionHeaderFieldProps['sessionHeaderUploadStatusTone']>;
export type SessionHeaderFileState = File | Blob;

type SessionHeaderClipboardResult =
  | {
      kind?: string;
      file?: SessionHeaderFileState | null;
      text?: string;
      error?: string;
    }
  | null
  | undefined;

type ReadSessionHeaderClipboard = (options: { fileNamePrefix: string }) => Promise<SessionHeaderClipboardResult>;

export interface UseSessionHeaderPreviewOptions {
  allowFileUpload?: boolean;
  draftSessionHeader?: string | null;
  updateDraftSessionHeader: (value: string | undefined) => void;
  readClipboard?: ReadSessionHeaderClipboard;
}

const useSessionHeaderPreview = ({
  allowFileUpload = true,
  draftSessionHeader,
  updateDraftSessionHeader,
  readClipboard = readCompactImageClipboard as ReadSessionHeaderClipboard,
}: UseSessionHeaderPreviewOptions) => {
  const [sessionHeaderMode, setSessionHeaderMode] = useState('url');
  const [compactSessionHeaderMode, setCompactSessionHeaderMode] = useState('idle');
  const [sessionHeaderFile, setSessionHeaderFile] = useState<SessionHeaderFileState | null>(null);
  const [sessionHeaderPreviewUrl, setSessionHeaderPreviewUrl] = useState('');
  const sessionHeaderPreviewUrlRef = useRef(sessionHeaderPreviewUrl);
  sessionHeaderPreviewUrlRef.current = sessionHeaderPreviewUrl;
  const [sessionHeaderPreviewModalOpen, setSessionHeaderPreviewModalOpen] = useState(false);
  const [sessionHeaderUploadStatus, setSessionHeaderUploadStatus] = useState('');
  const [sessionHeaderUploadStatusTone, setSessionHeaderUploadStatusTone] =
    useState<SessionHeaderUploadStatusTone>('default');

  const setSessionHeaderStatus = useCallback((text = '', tone: SessionHeaderUploadStatusTone = 'default') => {
    setSessionHeaderUploadStatus(text);
    setSessionHeaderUploadStatusTone(text ? tone : 'default');
  }, []);

  useEffect(() => {
    if (allowFileUpload) return;
    setSessionHeaderMode('url');
    setSessionHeaderFile(null);
    setSessionHeaderPreviewModalOpen(false);
    setSessionHeaderStatus('');
  }, [allowFileUpload, setSessionHeaderStatus]);

  useEffect(() => {
    const canCreateObjectUrl = typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';
    if (!sessionHeaderFile) {
      const currentPreviewUrl = sessionHeaderPreviewUrlRef.current;
      if (currentPreviewUrl && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(currentPreviewUrl);
      }
      setSessionHeaderPreviewUrl('');
      return;
    }
    if (!canCreateObjectUrl) return undefined;
    const previewUrl = URL.createObjectURL(sessionHeaderFile);
    setSessionHeaderPreviewUrl(previewUrl);
    return () => {
      if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [sessionHeaderFile]);

  const sessionHeaderPreviewSrc = useMemo(() => {
    if (allowFileUpload && sessionHeaderMode === 'upload') {
      return toStr(sessionHeaderPreviewUrl).trim();
    }
    return normalizeArweaveUrl(draftSessionHeader || '', {
      contextLabel: 'session_wizard_header_preview',
    });
  }, [allowFileUpload, draftSessionHeader, sessionHeaderMode, sessionHeaderPreviewUrl]);

  useEffect(() => {
    if (sessionHeaderPreviewSrc) return;
    setSessionHeaderPreviewModalOpen(false);
  }, [sessionHeaderPreviewSrc]);

  const handlePasteSessionHeaderFromClipboard = useCallback(async () => {
    const clipboardResult = await readClipboard({
      fileNamePrefix: 'clipboard-session-header',
    });

    if (clipboardResult?.kind === 'file' && clipboardResult.file) {
      if (!allowFileUpload) {
        setSessionHeaderStatus('This hosting profile accepts a header image URL, not a local file.', 'error');
        return;
      }
      setSessionHeaderMode('upload');
      setCompactSessionHeaderMode('idle');
      setSessionHeaderFile(clipboardResult.file);
      setSessionHeaderStatus('');
      return;
    }

    if (clipboardResult?.kind === 'text') {
      setSessionHeaderMode('url');
      setCompactSessionHeaderMode('url');
      setSessionHeaderFile(null);
      updateDraftSessionHeader(clipboardResult.text);
      setSessionHeaderStatus('');
      return;
    }

    setSessionHeaderStatus(clipboardResult?.error || 'Clipboard does not contain a supported image or URL.', 'error');
  }, [allowFileUpload, readClipboard, setSessionHeaderStatus, updateDraftSessionHeader]);

  const handleClearSessionHeaderPreview = useCallback(() => {
    setSessionHeaderPreviewModalOpen(false);
    setSessionHeaderMode('url');
    setCompactSessionHeaderMode('idle');
    setSessionHeaderFile(null);
    updateDraftSessionHeader('');
    setSessionHeaderStatus('');
  }, [setSessionHeaderStatus, updateDraftSessionHeader]);

  return {
    sessionHeaderMode: allowFileUpload ? sessionHeaderMode : 'url',
    setSessionHeaderMode,
    compactSessionHeaderMode,
    setCompactSessionHeaderMode,
    sessionHeaderFile: allowFileUpload ? sessionHeaderFile : null,
    setSessionHeaderFile,
    sessionHeaderPreviewSrc,
    sessionHeaderPreviewModalOpen: allowFileUpload ? sessionHeaderPreviewModalOpen : false,
    setSessionHeaderPreviewModalOpen,
    sessionHeaderUploadStatus,
    sessionHeaderUploadStatusTone,
    setSessionHeaderStatus,
    handlePasteSessionHeaderFromClipboard,
    handleClearSessionHeaderPreview,
  };
};

export default useSessionHeaderPreview;
