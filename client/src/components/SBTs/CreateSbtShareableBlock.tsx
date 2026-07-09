import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faClipboard, faCopy, faDownload, faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import { QRCodeSVG } from 'qrcode.react';

import CETooltip from '../Shared/CETooltip';
import {
  resolveCreateSbtCopyActionDisplayState,
  resolveCreateSbtHiddenQrDisplayState,
  resolveCreateSbtShareableTooltipIconStyle,
} from './createSbtGroupHelpers';

type CreateSbtShareableBlockStyles = Record<string, string>;

type CreateSbtShareableBlockProps = {
  copiedLinkIndex?: unknown;
  fileSuffix: string;
  onCopyQrImage: (highResQrId: string, copyKey: string) => void;
  onCopyUrl: (url: string, copyKey: string) => void;
  onDownloadQr: (highResQrId: string, fileName: string) => void;
  qrId: string;
  sbtAddress?: unknown;
  styles: CreateSbtShareableBlockStyles;
  testId?: string | null;
  title: string;
  tooltipText?: string | null;
  url: string;
};

export const CreateSbtShareableBlock = ({
  copiedLinkIndex,
  fileSuffix,
  onCopyQrImage,
  onCopyUrl,
  onDownloadQr,
  qrId,
  sbtAddress,
  styles,
  testId = null,
  title,
  tooltipText = null,
  url,
}: CreateSbtShareableBlockProps): JSX.Element => {
  const copyKeyUrl = `url_${qrId}`;
  const copyKeyImg = `img_${qrId}`;
  const highResQrId = `${qrId}_high_res`;
  const copyUrlActionState = resolveCreateSbtCopyActionDisplayState({
    copied: copiedLinkIndex === copyKeyUrl,
  });
  const copyQrImageActionState = resolveCreateSbtCopyActionDisplayState({
    copied: copiedLinkIndex === copyKeyImg,
  });
  const { hiddenStyle } = resolveCreateSbtHiddenQrDisplayState();

  return (
    <div className={styles.shareableBlock} {...(testId ? { 'data-testid': testId } : {})}>
      <div className={styles.leftCol}>
        <h3 className={styles.blockTitle}>
          {title}
          {tooltipText && (
            <>
              <FontAwesomeIcon
                icon={faQuestionCircle}
                className={styles.tooltip}
                id={`tt_${qrId}`}
                style={resolveCreateSbtShareableTooltipIconStyle()}
              />
              <CETooltip placement="right" target={`tt_${qrId}`} className={styles.tooltipBubble}>
                {tooltipText}
              </CETooltip>
            </>
          )}
        </h3>

        <div className={styles.urlContainer}>
          <span className={styles.urlText} title={url}>
            {url}
          </span>
          <button onClick={() => onCopyUrl(url, copyKeyUrl)} className={styles.copyButton} title="Copy URL">
            {copyUrlActionState.shouldRenderCopiedIcon && <FontAwesomeIcon icon={faCheck} />}
            {copyUrlActionState.shouldRenderDefaultIcon && <FontAwesomeIcon icon={faCopy} />}
          </button>
        </div>
      </div>

      <div className={styles.rightCol}>
        <div className={styles.qrCodeContainer}>
          <QRCodeSVG
            id={qrId}
            value={url}
            size={64}
            bgColor="#ffffff"
            fgColor="#000000"
            level="L"
            includeMargin={false}
          />
          <div style={hiddenStyle}>
            <QRCodeSVG
              id={highResQrId}
              value={url}
              size={1024}
              bgColor="#ffffff"
              fgColor="#000000"
              level="L"
              includeMargin={true}
            />
          </div>
        </div>
        <div className={styles.qrActionsColumn}>
          <button
            className={styles.qrActionButton}
            onClick={() => onCopyQrImage(highResQrId, copyKeyImg)}
            title="Copy QR Image to Clipboard"
          >
            {copyQrImageActionState.shouldRenderCopiedIcon && <FontAwesomeIcon icon={faCheck} />}
            {copyQrImageActionState.shouldRenderDefaultIcon && <FontAwesomeIcon icon={faClipboard} />}
          </button>
          <button
            className={styles.qrActionButton}
            onClick={() => onDownloadQr(highResQrId, `ContextEngine_Sbt_${sbtAddress}_${fileSuffix}.png`)}
            title="Download QR Code"
          >
            <FontAwesomeIcon icon={faDownload} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateSbtShareableBlock;
