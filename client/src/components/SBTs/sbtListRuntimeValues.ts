import contractScripts from '../../utilities/web3/chainGateway.js';
import { createLogger } from '../../utilities/logging.js';
import { hasCachedCreateSbtForm } from '../../utilities/sbt/sbtCreateFormCache.js';
import { getDemoSessionMap } from '../../utilities/session/sessionDemoCompat.js';
import { bindSbtListRuntimePorts } from './sbtListRuntimePorts';
import { getVisibleSbtListSessionSlugsFromEntries } from './sbtListHelpers';
import type { SbtListPointerEventLike, UnknownRecord } from './sbtListTypes';

export const sbtLog = createLogger('sbt');

export const sbtListRuntimePorts = bindSbtListRuntimePorts({
  contractScripts: () => contractScripts,
  hasCachedCreateSbtForm: () => hasCachedCreateSbtForm,
});

export const DEMO_SESSION_MAP = getDemoSessionMap();

export const SBT_LIVE_PROGRESS_BRIDGE_MS = 2500;
export const SBT_LIVE_PROGRESS_BRIDGE_TAIL_BLOCKS = 5;
export const SBT_CHIP_PROGRESS_VISIBILITY_MIN_INTERVAL_MS = 5000;

export const FEATURED_CARD_INTERACTIVE_SELECTOR = [
  'button',
  'a',
  'input',
  'select',
  'textarea',
  '[role="button"]',
  '[role="link"]',
  '[data-featured-card-ignore-nav="true"]',
].join(', ');

export const getVisibleSessionSlugsFromEntries = (entries: unknown = []): string[] =>
  getVisibleSbtListSessionSlugsFromEntries(entries, { demoSessionMap: DEMO_SESSION_MAP });

export const isRecord = (value: unknown): value is UnknownRecord => !!value && typeof value === 'object';

export const isSbtListPointerEventLike = (value: unknown): value is SbtListPointerEventLike =>
  !!value && typeof value === 'object';
