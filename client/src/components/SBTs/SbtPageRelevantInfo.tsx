import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import { Alert } from 'reactstrap';

import { litStorage } from 'utilities/crypto/litProtocol.js';
import { buildPublicRoute } from '../../utilities/ui/publicUrl.js';
import { resolveSbtPageMutedInfoIconStyle } from './sbtPageHelpers';
import styles from './SBTPage.module.scss';

type SbtPageRelevantInfoProps = {
  documentIDHashes: string[];
  documentURLs: string[];
  onOpenEncryptedDoc: (url: string) => void;
  shouldRenderDocumentIdHashes: boolean;
  shouldRenderDocumentUrls: boolean;
  shouldRenderTags: boolean;
  tags: string[];
};

const SbtPageRelevantInfo = ({
  documentIDHashes,
  documentURLs,
  onOpenEncryptedDoc,
  shouldRenderDocumentIdHashes,
  shouldRenderDocumentUrls,
  shouldRenderTags,
  tags,
}: SbtPageRelevantInfoProps): React.ReactElement => (
  <div className={styles.relevantInfo}>
    <Alert color="info" fade={false}>
      <FontAwesomeIcon icon={faInfoCircle} style={resolveSbtPageMutedInfoIconStyle()} />
      This section shows relevant documents, URLs, tags, and IDs.
    </Alert>
    {shouldRenderDocumentUrls && (
      <div className={styles.docUrlsSection}>
        <h4>Document URLs:</h4>
        <ul className={styles.docUrlList}>
          {documentURLs.map((url, index) => {
            const litDoc = litStorage.isLitArweaveUrl(url);
            return (
              <li key={index} className={styles.docUrlItem}>
                <span className={styles.docUrlBadge}>{litDoc ? 'Encrypted Doc' : 'Doc URL'}</span>
                {litDoc ? (
                  <button type="button" className={styles.docUrlButton} onClick={() => onOpenEncryptedDoc(url)}>
                    Decrypt and view
                  </button>
                ) : (
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    {url}
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    )}
    {shouldRenderDocumentIdHashes && (
      <div className={styles.docIDsSection}>
        <h4>Document ID Hashes:</h4>
        <ul className={styles.docIdList}>
          {documentIDHashes.map((hash, index) => {
            const docHash = encodeURIComponent(hash);
            return (
              <li key={index} className={styles.docIdItem}>
                <span className={styles.docIdBadge}>Doc ID</span>
                <a href={buildPublicRoute(`/doc/${docHash}`)} target="_blank" rel="noopener noreferrer">
                  {hash}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    )}
    {shouldRenderTags && (
      <div className={styles.tagsSection}>
        <h4>Tags:</h4>
        <ul className={styles.tagList}>
          {tags.map((tag, index) => {
            const tagEnc = encodeURIComponent(tag);
            return (
              <li key={index} className={styles.tagItem}>
                <span className={styles.tagBadge}>Tag</span>
                <a href={buildPublicRoute(`/tag/${tagEnc}`)} target="_blank" rel="noopener noreferrer">
                  {tag}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    )}
  </div>
);

export default SbtPageRelevantInfo;
