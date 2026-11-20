import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { normalizeArweaveUrl } from '../../../utilities/arweave/arweaveUrls.js';
import { toStr } from '../../../utilities/shared/primitives.js';
import { readCompactImageClipboard } from '../../Shared/compactImageClipboard.js';
import type { SessionHeaderFieldProps } from '../SessionHeaderField';
import { resolveSessionHeaderImageFormat, UNSUPPORTED_SESSION_HEADER_IMAGE_MESSAGE } from '../sessionWizardUiSupport';
import { shrinkHeaderImageToDataUrl } from '../sessionHeaderInlineImage';

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
  /** A Centralized session: a chosen picture is shrunk and kept with the config, not uploaded. */
  inlineUpload?: boolean;
  shrinkToDataUrl?: (file: SessionHeaderFileState) => Promise<string>;
  draftSessionHeader?: string | null;
  updateDraftSessionHeader: (value: string | undefined) => void;
  readClipboard?: ReadSessionHeaderClipboard;
}

const useSessionHeaderPreview = ({
  allowFileUpload = true,
  inlineUpload = false,
  shrinkToDataUrl = shrinkHeaderImageToDataUrl,
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
  const [sessionHeaderUploadStatus, setSessionHeaderUploadStatus] = useState('');
  const [sessionHeaderUploadStatusTone, setSessionHeaderUploadStatusTone] =
    useState<SessionHeaderUploadStatusTone>('default');
  // The shrunk picture for the file it was made from, so a later choice never shows or saves an earlier one.
  const [inline, setInline] = useState<{ file: SessionHeaderFileState | null; dataUrl: string }>({
    file: null,
    dataUrl: '',
  });

  const setSessionHeaderStatus = useCallback((text = '', tone: SessionHeaderUploadStatusTone = 'default') => {
    setSessionHeaderUploadStatus(text);
    setSessionHeaderUploadStatusTone(text ? tone : 'default');
  }, []);

  // A picker's accept list is only a hint, so every chosen or pasted file is
  // checked here instead of failing later at publish.
  const chooseSessionHeaderFile = useCallback(
    (file: SessionHeaderFileState | null): boolean => {
      if (file && !resolveSessionHeaderImageFormat(file)) {
        setSessionHeaderFile(null);
        setSessionHeaderStatus(UNSUPPORTED_SESSION_HEADER_IMAGE_MESSAGE, 'error');
        return false;
      }
      setSessionHeaderFile(file);
      return true;
    },
    [setSessionHeaderStatus],
  );

  useEffect(() => {
    if (allowFileUpload) return;
    setSessionHeaderMode('url');
    setSessionHeaderFile(null);
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

  const shrunkFile = inline.file;
  useEffect(() => {
    // A file already shrunk, as after switching away and back, is not decoded again.
    if (!inlineUpload || !sessionHeaderFile || shrunkFile === sessionHeaderFile) return undefined;
    let current = true;
    let settled = false;
    setSessionHeaderStatus('Making the picture small enough to keep with the session…', 'loading');
    shrinkToDataUrl(sessionHeaderFile).then(
      (dataUrl) => {
        settled = true;
        if (!current) return;
        setInline({ file: sessionHeaderFile, dataUrl });
        setSessionHeaderStatus('');
      },
      (error: unknown) => {
        settled = true;
        if (!current) return;
        setSessionHeaderFile(null);
        setSessionHeaderStatus(error instanceof Error ? error.message : String(error), 'error');
      },
    );
    return () => {
      current = false;
      // Left unfinished, as on a switch to Decentralized: its "Making…" message goes with it.
      if (!settled) setSessionHeaderStatus('');
    };
  }, [inlineUpload, sessionHeaderFile, shrunkFile, setSessionHeaderStatus, shrinkToDataUrl]);
  const inlineDataUrl =
    inlineUpload && sessionHeaderMode === 'upload' && sessionHeaderFile && inline.file === sessionHeaderFile
      ? inline.dataUrl
      : '';

  const sessionHeaderPreviewSrc = useMemo(() => {
    if (allowFileUpload && sessionHeaderMode === 'upload') {
      return inlineDataUrl || toStr(sessionHeaderPreviewUrl).trim();
    }
    return normalizeArweaveUrl(draftSessionHeader || '', {
      contextLabel: 'session_wizard_header_preview',
    });
  }, [allowFileUpload, draftSessionHeader, inlineDataUrl, sessionHeaderMode, sessionHeaderPreviewUrl]);

  const handlePasteSessionHeaderFromClipboard = useCallback(async () => {
    const clipboardResult = await readClipboard({
      fileNamePrefix: 'clipboard-session-header',
    });

    if (clipboardResult?.kind === 'file' && clipboardResult.file) {
      if (!allowFileUpload) {
        setSessionHeaderStatus('This hosting profile accepts a header image URL, not a local file.', 'error');
        return;
      }
      if (!chooseSessionHeaderFile(clipboardResult.file)) return;
      setSessionHeaderMode('upload');
      setCompactSessionHeaderMode('idle');
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
  }, [allowFileUpload, chooseSessionHeaderFile, readClipboard, setSessionHeaderStatus, updateDraftSessionHeader]);

  const handleClearSessionHeaderPreview = useCallback(() => {
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
    setSessionHeaderFile: chooseSessionHeaderFile,
    sessionHeaderPreviewSrc,
    sessionHeaderUploadStatus,
    sessionHeaderUploadStatusTone,
    setSessionHeaderStatus,
    handlePasteSessionHeaderFromClipboard,
    handleClearSessionHeaderPreview,
    /** The picture a Centralized session keeps with its config, '' when there is none or it isn't ready. */
    sessionHeaderInline: inlineDataUrl,
    /** A picture is still being made small enough; Create waits for it. */
    sessionHeaderInlinePending:
      inlineUpload && sessionHeaderMode === 'upload' && !!sessionHeaderFile && inline.file !== sessionHeaderFile,
  };
};

export default useSessionHeaderPreview;
