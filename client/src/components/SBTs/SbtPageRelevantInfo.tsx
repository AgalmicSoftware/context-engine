import React, { lazy, Suspense, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import { Alert } from 'reactstrap';

import { litStorage } from 'utilities/crypto/litProtocol.js';
import { toSafeLinkHref } from '../../utilities/arweave/arweaveUrls.js';
import { buildPublicRoute } from '../../utilities/ui/publicUrl.js';
import { resolveSbtPageMutedInfoIconStyle } from './sbtPageHelpers';
import styles from './SBTPage.module.scss';
import { buildTagHref } from '../SurveyTool/QuestionTagDropdown';

const TagModal = lazy(() => import('../TagPage/TagModal'));

type SbtPageRelevantInfoProps = {
  compact?: boolean;
  documentIDHashes: string[];
  documentURLs: string[];
  documentUrlsArePublic?: boolean;
  introText?: React.ReactNode;
  onOpenEncryptedDoc: (url: string) => void;
  shouldRenderDocumentIdHashes: boolean;
  shouldRenderDocumentUrls: boolean;
  shouldRenderTags: boolean;
  tags: string[];
  sessionSlug?: string;
};

const SbtPageRelevantInfo = ({
  compact = false,
  documentIDHashes,
  documentURLs,
  documentUrlsArePublic = false,
  introText = 'This section shows relevant documents, URLs, tags, and IDs.',
  onOpenEncryptedDoc,
  shouldRenderDocumentIdHashes,
  shouldRenderDocumentUrls,
  shouldRenderTags,
  tags,
  sessionSlug,
}: SbtPageRelevantInfoProps): React.ReactElement => {
  const [activeTag, setActiveTag] = useState<string | null>(null);
  return (
    <div className={`${styles.relevantInfo}${compact ? ` ${styles.compactRelevantInfo}` : ''}`}>
      {introText != null && (
        <Alert color="info" fade={false}>
          <FontAwesomeIcon icon={faInfoCircle} style={resolveSbtPageMutedInfoIconStyle()} />
          {introText}
        </Alert>
      )}
      {shouldRenderDocumentUrls && (
        <div className={styles.docUrlsSection}>
          <h4>Document URLs:</h4>
          <ul className={styles.docUrlList}>
            {documentURLs.map((url, index) => {
              const litDoc = !documentUrlsArePublic && litStorage.isLitArweaveUrl(url);
              const href = litDoc ? '' : toSafeLinkHref(url, { contextLabel: 'sbt_document' });
              return (
                <li key={index} className={styles.docUrlItem}>
                  <span className={styles.docUrlBadge}>{litDoc ? 'Encrypted Doc' : 'Doc URL'}</span>
                  {litDoc ? (
                    <button type="button" className={styles.docUrlButton} onClick={() => onOpenEncryptedDoc(url)}>
                      Decrypt and view
                    </button>
                  ) : href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer">
                      {url}
                    </a>
                  ) : (
                    <span>{url}</span>
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
          {!compact && <h4>Tags:</h4>}
          <ul className={styles.tagList} aria-label="Tags">
            {tags.map((tag, index) => {
              return (
                <li key={index} className={styles.tagItem}>
                  <span className={styles.tagBadge}>Tag</span>
                  <a
                    href={buildTagHref(tag, '', sessionSlug === '' ? 'general' : sessionSlug)}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
                        return;
                      event.preventDefault();
                      setActiveTag(tag);
                    }}
                  >
                    {tag}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {activeTag && (
        <Suspense fallback={<span role="status">Loading tag explorer…</span>}>
          <TagModal isOpen toggle={() => setActiveTag(null)} activeTag={activeTag} sessionSlug={sessionSlug} />
        </Suspense>
      )}
    </div>
  );
};

export default SbtPageRelevantInfo;
