import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { CreateSbtShareableBlock } from './CreateSbtShareableBlock';

jest.mock('../Shared/CETooltip', () => ({ children }: { children: React.ReactNode }) => (
  <span data-testid="tooltip">{children}</span>
));

const styles = {
  blockTitle: 'blockTitle',
  copyButton: 'copyButton',
  leftCol: 'leftCol',
  qrActionButton: 'qrActionButton',
  qrActionsColumn: 'qrActionsColumn',
  qrCodeContainer: 'qrCodeContainer',
  rightCol: 'rightCol',
  shareableBlock: 'shareableBlock',
  tooltip: 'tooltip',
  tooltipBubble: 'tooltipBubble',
  urlContainer: 'urlContainer',
  urlText: 'urlText',
};

describe('CreateSbtShareableBlock', () => {
  it('renders the link and wires copy/download actions to the high-res QR id', () => {
    const onCopyUrl = jest.fn();
    const onCopyQrImage = jest.fn();
    const onDownloadQr = jest.fn();
    const url = 'https://contextengine.example/session/alpha?sbt=0xabc&auto=1';

    render(
      <CreateSbtShareableBlock
        copiedLinkIndex=""
        fileSuffix="autojoin"
        onCopyQrImage={onCopyQrImage}
        onCopyUrl={onCopyUrl}
        onDownloadQr={onDownloadQr}
        qrId="qr-code-auto-join"
        sbtAddress="0xabc"
        styles={styles}
        testId="ce-sbt-create-open-mint-url"
        title="URL Where Anyone Can Join"
        tooltipText="Anyone with this link can join."
        url={url}
      />,
    );

    expect(screen.getByTestId('ce-sbt-create-open-mint-url')).toHaveTextContent('URL Where Anyone Can Join');
    expect(screen.getByTitle(url)).toHaveTextContent(url);
    expect(screen.getByTestId('tooltip')).toHaveTextContent('Anyone with this link can join.');

    fireEvent.click(screen.getByTitle('Copy URL'));
    expect(onCopyUrl).toHaveBeenCalledWith(url, 'url_qr-code-auto-join');

    fireEvent.click(screen.getByTitle('Copy QR Image to Clipboard'));
    expect(onCopyQrImage).toHaveBeenCalledWith('qr-code-auto-join_high_res', 'img_qr-code-auto-join');

    fireEvent.click(screen.getByTitle('Download QR Code'));
    expect(onDownloadQr).toHaveBeenCalledWith('qr-code-auto-join_high_res', 'ContextEngine_Sbt_0xabc_autojoin.png');
  });
});
