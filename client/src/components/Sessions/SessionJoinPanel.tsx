import { useEffect, useId, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { UncontrolledTooltip } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import { getCorsProxyUrlOrThrow } from '../../utilities/worker/corsProxy.js';
import { buildExternalInterviewKickoff } from '../SurveyTool/sessionInterview';
import { verifyInterviewKickoffCatalog } from '../SurveyTool/sessionInterviewCatalogValidation';
import styles from './SessionJoinPanel.module.scss';

type Props = { sessionUrl?: string; sessionSlug?: string; workerUrl?: string; sessionConfig?: unknown };
const originOf = (value: string): string => {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.origin : '';
  } catch {
    return '';
  }
};

export default function SessionJoinPanel({ sessionUrl, sessionSlug, workerUrl = '', sessionConfig }: Props) {
  const [open, setOpen] = useState(false);
  const [resolvedWorker, setResolvedWorker] = useState({ session: '', url: '' });
  const [attempt, setAttempt] = useState(0);
  const [validation, setValidation] = useState({ key: '', error: '' });
  const [copyState, setCopyState] = useState({ key: '', text: '', error: '' });
  const helpId = `ce-join-help-${useId().replace(/:/g, '')}`;
  let url: URL | null = null;
  let slug = '';
  try {
    url = new URL(sessionUrl || `/session/${encodeURIComponent(sessionSlug || '')}`, window.location.origin);
    if (!['http:', 'https:'].includes(url.protocol) || !/^\/session\/[^/]+\/?$/.test(url.pathname)) url = null;
    if (url) slug = decodeURIComponent(url.pathname.split('/')[2]);
  } catch {
    url = null;
    slug = '';
  }
  const activeWorker = originOf(
    workerUrl || url?.searchParams.get('worker') || (resolvedWorker.session === slug ? resolvedWorker.url : ''),
  );
  // Sharing only the session identity and Worker prevents copying an admin token or prefill packet.
  const returnUrl =
    url && activeWorker ? `${url.origin}${url.pathname}?${new URLSearchParams({ worker: activeWorker })}` : '';
  const voiceUrl = returnUrl ? `${returnUrl}&mode=voice` : '';
  const kickoff = returnUrl
    ? buildExternalInterviewKickoff({ workerUrl: activeWorker, sessionSlug: slug, sessionUrl: returnUrl })
    : '';
  useEffect(() => {
    if (!open || !slug) return;
    let current = true;
    setValidation({ key: '', error: '' });
    const check = async () => {
      if (!activeWorker) {
        const worker = await getCorsProxyUrlOrThrow({ sessionSlug: slug, sessionConfig, allowDemoFallback: false });
        if (!originOf(worker)) throw new Error('This session needs a Worker before its join links are available.');
        if (current) setResolvedWorker({ session: slug, url: worker });
        return;
      }
      await verifyInterviewKickoffCatalog({ workerUrl: activeWorker, sessionSlug: slug, sessionUrl: returnUrl });
      if (current) setValidation({ key: kickoff, error: '' });
    };
    void check().catch((error: unknown) => {
      if (current)
        setValidation({
          key: kickoff,
          error: error instanceof Error ? error.message : 'Could not check this session.',
        });
    });
    return () => {
      current = false;
    };
  }, [open, slug, activeWorker, returnUrl, kickoff, sessionConfig, attempt]);
  const copy = async (text: string) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      setCopyState({ key: returnUrl, text: '', error: '' });
    } catch {
      setCopyState({ key: returnUrl, text, error: 'Could not use the clipboard. Copy the text below.' });
    }
  };
  if (!slug) return null;
  const compatible = Boolean(kickoff && validation.key === kickoff && !validation.error);
  return (
    <section className={styles.panel} data-testid="ce-session-join">
      <button type="button" className={styles.toggle} aria-expanded={open} onClick={() => setOpen(!open)}>
        Join
      </button>
      {open ? (
        <div className={styles.content}>
          <div className={styles.heading}>
            Voice interview{' '}
            <button type="button" id={helpId} className={styles.help} aria-label="About joining">
              <FontAwesomeIcon icon={faQuestionCircle} />
            </button>
          </div>
          <UncontrolledTooltip target={helpId} trigger="hover focus" autohide={false}>
            Scan to join on your own device. Your AI can also draft answers for you to review before submitting.
          </UncontrolledTooltip>
          {voiceUrl ? (
            <>
              <QRCodeSVG value={voiceUrl} size={168} marginSize={4} title="Join the voice interview" />
              <div>
                <a href={voiceUrl}>Open voice interview</a>{' '}
                <button
                  type="button"
                  aria-label="Copy voice link"
                  onClick={() => {
                    void copy(voiceUrl);
                  }}
                >
                  Copy link
                </button>
              </div>
            </>
          ) : null}
          <div className={styles.heading}>For your AI</div>
          <button
            type="button"
            aria-label="Copy AI prompt"
            disabled={!compatible}
            onClick={() => {
              void copy(kickoff);
            }}
          >
            Copy prompt
          </button>
          {validation.error ? (
            <div role="alert">
              {validation.error}{' '}
              <button type="button" onClick={() => setAttempt(attempt + 1)}>
                Retry
              </button>
            </div>
          ) : !compatible ? (
            <div role="status">Checking session compatibility…</div>
          ) : null}
          {returnUrl && copyState.key === returnUrl ? (
            <div role={copyState.error ? 'alert' : 'status'}>
              {copyState.error || 'Copied.'}
              {copyState.text ? <textarea aria-label="Text to copy" value={copyState.text} readOnly rows={5} /> : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
