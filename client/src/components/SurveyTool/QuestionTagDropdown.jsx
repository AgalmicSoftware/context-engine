import React from 'react';
import { DropdownItem, DropdownMenu, DropdownToggle, UncontrolledDropdown } from 'reactstrap';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHashtag } from '@fortawesome/free-solid-svg-icons';
import { normalizeTagList } from '../../utilities/defaultTags.js';
import { readPublicUrlBasePath } from '../../utilities/ui/publicUrl.js';
import styles from './QuestionTagDropdown.module.scss';

export const getQuestionTagDisplayList = (tags) => {
  if (!Array.isArray(tags)) return [];

  const seen = new Set();
  const out = [];

  tags.forEach((rawTag) => {
    const displayTag = String(rawTag ?? '').trim();
    const normalizedTag = normalizeTagList([displayTag])[0];

    if (!displayTag || !normalizedTag || seen.has(normalizedTag)) return;

    seen.add(normalizedTag);
    out.push(displayTag);
  });

  return out;
};

const resolveTagRouteBaseUrl = (baseUrl = '') => {
  const explicitBaseUrl = String(baseUrl ?? '').trim();
  if (explicitBaseUrl) return explicitBaseUrl.replace(/\/+$/, '');
  return readPublicUrlBasePath();
};

const joinTagRoute = (baseUrl = '', pathname = '/') => {
  const normalizedBaseUrl = resolveTagRouteBaseUrl(baseUrl);
  const normalizedPathname = String(pathname || '').trim() || '/';
  if (!normalizedBaseUrl) return normalizedPathname;
  return `${normalizedBaseUrl}${normalizedPathname}`;
};

export const buildTagPagePath = (tags = [], baseUrl = '') => {
  const displayTags = getQuestionTagDisplayList(tags);
  if (!displayTags.length) return joinTagRoute(baseUrl, '/questions');
  return joinTagRoute(baseUrl, `/tag/${displayTags.map((tag) => encodeURIComponent(tag)).join('+')}`);
};

export const buildTagHref = (tag, baseUrl = '', sessionSlug = '') => {
  const trimmedTag = String(tag ?? '').trim();
  const normalizedSessionSlug = String(sessionSlug ?? '').trim();

  // Regression guard: tag routes must stay aligned with PUBLIC_URL/base-path hosting.
  // Hardcoding '/tag/...' here breaks optional subpath deploys like '/ce/...'.
  const path = !trimmedTag
    ? joinTagRoute(baseUrl, '/tag/')
    : joinTagRoute(baseUrl, `/tag/${encodeURIComponent(trimmedTag)}`);

  return normalizedSessionSlug
    ? `${path}?session=${encodeURIComponent(normalizedSessionSlug)}`
    : path;
};

const QuestionTagDropdown = ({ tags, baseUrl = '', sessionSlug = '' }) => {
  const displayTags = getQuestionTagDisplayList(tags);

  if (!displayTags.length) return null;

  return (
    <UncontrolledDropdown className={styles.dropdown} direction="up">
      <DropdownToggle
        caret={false}
        color="link"
        className={styles.toggle}
        aria-label="Show question tags"
        title="Show question tags"
        onClick={(event) => event.stopPropagation()}
      >
        <FontAwesomeIcon icon={faHashtag} />
      </DropdownToggle>
      <DropdownMenu end className={styles.menu}>
        {displayTags.map((tag) => (
          <DropdownItem
            key={tag}
            tag={Link}
            to={buildTagHref(tag, baseUrl, sessionSlug)}
            className={styles.item}
            onClick={(event) => event.stopPropagation()}
          >
            #{tag}
          </DropdownItem>
        ))}
      </DropdownMenu>
    </UncontrolledDropdown>
  );
};

export default QuestionTagDropdown;
