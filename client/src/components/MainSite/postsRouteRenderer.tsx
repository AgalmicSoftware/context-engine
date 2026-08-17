import React from 'react';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import InitialRouteBoundary from '../ErrorBoundary/InitialRouteBoundary';
import LazyFallback from '../Shared/LazyFallback';
import { PostsPage } from './routeLazyComponents.js';

export const renderPostsRoute = () => (
  <InitialRouteBoundary fallback={<LazyFallback label="Loading Posts..." />}>
    <div data-testid={E2E_TESTIDS.PAGE_POSTS_ROOT}>
      <PostsPage />
    </div>
  </InitialRouteBoundary>
);
