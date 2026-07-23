/**
 * @module components/MainSite/routeStatusViews
 */

import React from 'react';
import styles from './AppShell.module.scss';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import {
  ROUTE_STATUS_BODY_STYLE,
  ROUTE_STATUS_CARD_STYLE,
  ROUTE_STATUS_EYEBROW_STYLE,
  ROUTE_STATUS_LINK_STYLE,
  ROUTE_STATUS_PATH_STYLE,
  ROUTE_STATUS_SHELL_STYLE,
  ROUTE_STATUS_TITLE_STYLE,
} from './routeStyles.js';
import { buildPublicRoute } from './urlUtils.js';

type RouteStatusPageProps = {
  eyebrow?: string;
  title?: string;
  description?: string;
  path?: string;
};

export const RouteStatusPage = ({ eyebrow = '', title = '', description = '', path = '' }: RouteStatusPageProps) => (
  <div style={ROUTE_STATUS_SHELL_STYLE}>
    <div style={ROUTE_STATUS_CARD_STYLE}>
      {eyebrow ? <div style={ROUTE_STATUS_EYEBROW_STYLE}>{eyebrow}</div> : null}
      <h2 style={ROUTE_STATUS_TITLE_STYLE}>{title}</h2>
      <p style={ROUTE_STATUS_BODY_STYLE}>{description}</p>
      {path ? <p style={ROUTE_STATUS_PATH_STYLE}>Path: {path}</p> : null}
      <a href={buildPublicRoute('/')} style={ROUTE_STATUS_LINK_STYLE}>
        Back to home
      </a>
    </div>
  </div>
);

type ExperimentalStubProps = {
  featureName?: string;
  description?: string;
  path?: string;
};

export const ExperimentalStub = ({
  featureName = 'This feature',
  description = '',
  path = '',
}: ExperimentalStubProps) => (
  <RouteStatusPage
    eyebrow="Experimental"
    title="This feature is in development"
    description={description || `${featureName} is not part of the supported public surface yet.`}
    path={path}
  />
);

export const NotFoundRoute = ({ path = '' }: { path?: string }) => (
  <RouteStatusPage
    eyebrow="404"
    title="Page not found"
    description="This URL is not part of the supported public surface for this build."
    path={path}
  />
);

export const removeHashQueryParam = (hashValue = '', key = ''): string => {
  const normalizedKey = String(key || '').trim();
  const rawHash = String(hashValue || '')
    .replace(/^#/, '')
    .trim();
  if (!normalizedKey || !rawHash) return String(hashValue || '').trim();
  if (!/[=&]/.test(rawHash)) return String(hashValue || '').trim();
  const params = new URLSearchParams(rawHash);
  params.delete(normalizedKey);
  const nextHash = params.toString();
  return nextHash ? `#${nextHash}` : '';
};

export const SESSION_LOADING_SKELETON_SECTION_LAYOUT = Object.freeze([
  {
    sectionName: 'Questions',
    subtitle: '\u2013 Answer or Add',
    barWidths: ['84%', '96%', '87%', '79%'],
  },
  {
    sectionName: 'Groups',
    subtitle: '\u2013 Join or Create',
    barWidths: ['62%', '80%'],
  },
  {
    sectionName: 'Results',
    subtitle: '\u2013 View or Save',
    barWidths: ['57%', '76%'],
  },
]);

type SessionLoadingSkeletonProps = {
  statusTitle?: string;
  statusDetail?: string;
};

export const SessionLoadingSkeleton = ({
  statusTitle = 'Resolving Session Link...',
  statusDetail = '',
}: SessionLoadingSkeletonProps) => (
  <div
    className={styles.sessionLoadingSkeleton}
    role="status"
    aria-live="polite"
    aria-busy="true"
    data-testid={E2E_TESTIDS.SESSION_LOADING_SKELETON}
  >
    <div className={styles.sessionLoadingSkeletonStatus}>
      <h3 className={styles.sessionLoadingSkeletonStatusTitle}>{statusTitle}</h3>
      {statusDetail ? <p className={styles.sessionLoadingSkeletonStatusText}>{statusDetail}</p> : null}
    </div>
    <div className={styles.sessionLoadingSkeletonSections} aria-hidden="true">
      {SESSION_LOADING_SKELETON_SECTION_LAYOUT.map((sectionLayout, sectionIndex) => (
        <div
          key={`session-skeleton-section-${sectionIndex}`}
          className={styles.sessionLoadingSkeletonSection}
          data-testid={`${E2E_TESTIDS.SESSION_LOADING_SKELETON}-section`}
        >
          <div className={styles.sessionLoadingSkeletonSectionHeader}>
            <span className={styles.sessionLoadingSkeletonCaret} aria-hidden="true" />
            <span className={styles.sessionLoadingSkeletonSectionTitle}>{sectionLayout.sectionName}</span>
            <span className={styles.sessionLoadingSkeletonSubtitle}>{sectionLayout.subtitle}</span>
          </div>
          <div className={styles.sessionLoadingSkeletonSectionBars}>
            {sectionLayout.barWidths.map((width, barIndex) => (
              <div
                key={`session-skeleton-section-${sectionIndex}-bar-${barIndex}`}
                className={[
                  styles.sessionLoadingSkeletonBar,
                  barIndex === 0 ? styles.sessionLoadingSkeletonTitleBar : null,
                  styles.sessionLoadingSkeletonShimmer,
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={{ width }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);
