/** @file SessionContextPreview.tsx: a context file shown in place, and in the docs page's viewer as a dialog. Loaded on first use. */
import { useEffect, useRef, useState } from 'react';
import { Modal, ModalBody, ModalHeader } from 'reactstrap';

import { CONTEXT_FILE_TYPES } from '@ce-shared/sessionContextSources.mjs';
import { DocumentLibraryViewerBody } from '../DocumentLibrary/DocumentLibraryPanelViews';
import {
  contextSourceDisplayTitle,
  contextSourceKindLabel,
  readContextSourceBlob,
  readContextSourceText,
  type ContextSource,
} from '../../utilities/docLibrary/contextSources';
import { toViewerBlob } from '../../utilities/ui/viewerMime';
import styles from './SessionContextSources.module.scss';

/** How much of a text file shows in place; the viewer shows all of it. */
export const PREVIEW_CHARS = 4000;

type Reader = {
  sessionSlug: string;
  sessionConfig: Record<string, unknown> | null;
  account: string;
};

type Content = { loading: boolean; error: string; text: string; blobUrl: string; mime: string };

// By its type, or else its name, as its kind label is.
const isPdf = (source: ContextSource) => contextSourceKindLabel(source) === 'PDF';

// A text file's text, or a PDF as a blob: URL that is freed when it is no longer shown.
const useSourceContent = (source: ContextSource, { sessionSlug, sessionConfig, account }: Reader): Content => {
  const configRef = useRef(sessionConfig);
  configRef.current = sessionConfig;
  // A reloaded list makes new objects for the same file, which need not load again.
  const sourceRef = useRef(source);
  sourceRef.current = source;
  const [content, setContent] = useState<Content>({ loading: true, error: '', text: '', blobUrl: '', mime: '' });
  useEffect(() => {
    let current = true;
    let blobUrl = '';
    const options = { sessionSlug, sessionConfig: configRef.current, context: { account } };
    const file = sourceRef.current;
    setContent({ loading: true, error: '', text: '', blobUrl: '', mime: '' });
    const load = isPdf(file)
      ? readContextSourceBlob(file, options).then((blob) => {
          const viewer = toViewerBlob(blob, CONTEXT_FILE_TYPES.pdf);
          if (!current) return;
          blobUrl = URL.createObjectURL(viewer.blob);
          setContent({ loading: false, error: '', text: '', blobUrl, mime: viewer.mime });
        })
      : readContextSourceText(file, options).then((text) => {
          if (current) setContent({ loading: false, error: '', text, blobUrl: '', mime: file.mime });
        });
    load.catch((failure: unknown) => {
      if (current) {
        setContent({
          loading: false,
          error: failure instanceof Error ? failure.message : 'It could not be loaded.',
          text: '',
          blobUrl: '',
          mime: '',
        });
      }
    });
    return () => {
      current = false;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [source.id, source.mime, sessionSlug, account]);
  return content;
};

type InlineProps = Reader & { source: ContextSource; onOpen: () => void };

/** The start of a text file, or a PDF's first page, under its name; the PDF opens the viewer. */
export const ContextInlinePreview = ({ source, onOpen, ...reader }: InlineProps) => {
  const content = useSourceContent(source, reader);
  const title = contextSourceDisplayTitle(source);
  if (content.loading) return <p className={styles.previewStatus}>Loading…</p>;
  if (content.error) return <p className={styles.previewStatus}>{content.error}</p>;
  if (content.blobUrl) {
    return (
      <div className={styles.pdfThumb}>
        {/* The browser's own PDF viewer, as on the docs page; the button above it takes the clicks. */}
        <iframe
          title={`${title}, first page`}
          src={`${content.blobUrl}#page=1&toolbar=0&navpanes=0&view=FitH`}
          tabIndex={-1}
          aria-hidden="true"
        />
        <button type="button" className={styles.pdfThumbOpen} onClick={onOpen} aria-label={`Open ${title}`}>
          <span>Open</span>
        </button>
      </div>
    );
  }
  const shortened = content.text.length > PREVIEW_CHARS;
  return (
    <>
      <pre className={styles.previewText} data-testid="ce-session-context-preview-text">
        {shortened ? `${content.text.slice(0, PREVIEW_CHARS)}…` : content.text || 'This file is empty.'}
      </pre>
      {shortened ? (
        <button type="button" className={styles.previewMore} onClick={onOpen}>
          Show all
        </button>
      ) : null}
    </>
  );
};

type ViewerProps = Reader & { source: ContextSource; pageHref: string; onClose: () => void };

/** The docs page's viewer for one file, in a dialog, with a link to that page. */
export const ContextViewerModal = ({ source, pageHref, onClose, ...reader }: ViewerProps) => {
  const content = useSourceContent(source, reader);
  const title = contextSourceDisplayTitle(source);
  return (
    <Modal isOpen toggle={onClose} size="lg" scrollable className={styles.viewerModal}>
      <ModalHeader toggle={onClose}>{title}</ModalHeader>
      <ModalBody data-testid="ce-session-context-viewer">
        <DocumentLibraryViewerBody
          viewerError={content.error}
          viewerLoading={content.loading}
          viewerText={content.text}
          viewerMime={content.mime}
          viewerBlobUrl={content.blobUrl}
          viewerTitle={source.title}
        />
        {pageHref ? (
          <a className={styles.viewerPageLink} href={pageHref} target="_blank" rel="noopener noreferrer">
            Open in its own page
          </a>
        ) : null}
      </ModalBody>
    </Modal>
  );
};
