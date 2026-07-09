import React from 'react';
import { DropdownItem, DropdownMenu, DropdownToggle, UncontrolledDropdown } from 'reactstrap';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHashtag } from '@fortawesome/free-solid-svg-icons';
import { readPublicUrlBasePath } from '../../utilities/ui/publicUrl.js';
import { getQuestionTagDisplayList } from '../../utilities/survey/questionTags.js';
import styles from './QuestionTagDropdown.module.scss';

export { getQuestionTagDisplayList } from '../../utilities/survey/questionTags.js';

type QuestionTagDropdownProps = {
  tags?: unknown[];
  baseUrl?: string;
  sessionSlug?: string;
  onTagSelect?: ((tag: string) => void) | null;
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

export const buildTagPagePath = (tags: unknown[] = [], baseUrl = '') => {
  const displayTags = getQuestionTagDisplayList(tags);
  if (!displayTags.length) return joinTagRoute(baseUrl, '/questions');
  return joinTagRoute(baseUrl, `/tag/${displayTags.map((tag) => encodeURIComponent(tag)).join('+')}`);
};

export const buildTagHref = (tag: unknown, baseUrl = '', sessionSlug = '') => {
  const trimmedTag = String(tag ?? '').trim();
  const normalizedSessionSlug = String(sessionSlug ?? '').trim();

  // Regression guard: tag routes must stay aligned with PUBLIC_URL/base-path hosting.
  // Hardcoding '/tag/...' here breaks optional subpath deploys like '/ce/...'.
  const path = !trimmedTag
    ? joinTagRoute(baseUrl, '/tag/')
    : joinTagRoute(baseUrl, `/tag/${encodeURIComponent(trimmedTag)}`);

  return normalizedSessionSlug ? `${path}?session=${encodeURIComponent(normalizedSessionSlug)}` : path;
};

const QuestionTagDropdown = ({
  tags = [],
  baseUrl = '',
  sessionSlug = '',
  onTagSelect = null,
}: QuestionTagDropdownProps) => {
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
        {displayTags.map((tag) => {
          const usesModalSelect = typeof onTagSelect === 'function';

          return (
            <DropdownItem
              key={tag}
              tag={usesModalSelect ? 'button' : Link}
              type={usesModalSelect ? 'button' : undefined}
              to={usesModalSelect ? undefined : buildTagHref(tag, baseUrl, sessionSlug)}
              className={styles.item}
              onClick={(event: React.MouseEvent<HTMLElement>) => {
                event.stopPropagation();
                if (!usesModalSelect) return;
                event.preventDefault();
                onTagSelect(tag);
              }}
            >
              #{tag}
            </DropdownItem>
          );
        })}
      </DropdownMenu>
    </UncontrolledDropdown>
  );
};

export default QuestionTagDropdown;
