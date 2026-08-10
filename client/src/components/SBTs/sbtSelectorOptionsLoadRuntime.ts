import { normalizeSessionSlug } from '../../utilities/session/sessionNaming.js';
import { shouldDiscoverSbtForSessionConfig } from './sbtSelectorSessionRuntimeHelpers';

type OptionsLoadGuard = {
  generation: number;
  slug: string;
  targetSig: string;
};

type CapabilityHost = {
  getDisplayLookupSessionConfig: (slug: unknown) => unknown;
  props: { sessionConfig?: unknown };
  shouldUsePropsSessionConfigForSlug: (slug: unknown) => boolean;
};

type SbtOptionsPayload = {
  fallbackSlug?: unknown;
  featuredEntries?: unknown;
  ignoredSet?: unknown;
  loadingOptions?: boolean;
  sbtList?: unknown;
  scopeMode?: unknown;
  targetSlugs?: unknown;
};

type SbtOptionsLoadingPatch = {
  loadingOptions: boolean;
};

type OptionsLoadHost = CapabilityHost & {
  _inflightSbtOptionsRequestSig: string;
  _isMounted: boolean;
  _lastSbtOptionsRequestSig: string;
  _loadSbtOptionsInflight: Promise<unknown> | null;
  _pendingSbtOptionsForceReload: boolean;
  _pendingSbtOptionsReload: boolean;
  _sbtOptionsLoadCoordinator: SbtOptionsLoadCoordinator;
  applySbtOptions: (options: SbtOptionsPayload) => unknown;
  loadSBTOptions: (options: { force: boolean }) => unknown;
  setState: (patch: SbtOptionsLoadingPatch) => unknown;
  state: { loadingOptions: boolean };
};

export class SbtOptionsLoadCoordinator {
  private activeTargetSig = '';
  private generation = 0;

  begin(targetSig: string, slug: string): OptionsLoadGuard {
    this.generation += 1;
    this.activeTargetSig = targetSig;
    return { generation: this.generation, slug, targetSig };
  }

  invalidate(targetSig: string): void {
    this.generation += 1;
    this.activeTargetSig = targetSig;
  }

  isCurrent(guard: OptionsLoadGuard, canDiscover: (slug: string) => boolean): boolean {
    return (
      guard.generation === this.generation &&
      guard.targetSig === this.activeTargetSig &&
      (!guard.slug || canDiscover(guard.slug))
    );
  }
}

export const canDiscoverSbtForSelector = (host: CapabilityHost, slug: unknown): boolean =>
  shouldDiscoverSbtForSessionConfig({
    sessionConfig: host.shouldUsePropsSessionConfigForSlug(slug)
      ? host.props.sessionConfig || null
      : host.getDisplayLookupSessionConfig(slug),
    sessionSlug: slug,
  });

export const resetUnsupportedSelectedSbtHydration = (
  host: OptionsLoadHost & {
    _selectedSbtHydrationSig: string;
    clearSelectedSbtHydrationRetry: () => void;
  },
  slug: unknown,
): boolean => {
  if (!normalizeSessionSlug(slug) || canDiscoverSbtForSelector(host, slug)) return false;
  host.clearSelectedSbtHydrationRetry();
  host._selectedSbtHydrationSig = '';
  return true;
};

export const disableUnsupportedSbtOptions = (
  host: OptionsLoadHost,
  args: { scopeMode: string; sessionConfigSig: string; slug: string },
): null => {
  host._sbtOptionsLoadCoordinator.invalidate(`disabled:${args.slug}:${args.sessionConfigSig}`);
  host._lastSbtOptionsRequestSig = '';
  host._inflightSbtOptionsRequestSig = '';
  host._loadSbtOptionsInflight = null;
  host._pendingSbtOptionsReload = false;
  host._pendingSbtOptionsForceReload = false;
  host.applySbtOptions({
    sbtList: {},
    featuredEntries: [],
    ignoredSet: new Set(),
    fallbackSlug: args.slug,
    loadingOptions: false,
    scopeMode: args.scopeMode,
    targetSlugs: [],
  });
  return null;
};

export const queueChangedSbtOptionsRequest = (
  host: OptionsLoadHost,
  args: {
    forceReload: boolean;
    requestSig: string;
    scopeMode: string;
    slug: string;
    targetSlugs: string[];
  },
): Promise<unknown> | null => {
  host._sbtOptionsLoadCoordinator.invalidate(`queued:${args.requestSig}`);
  host._pendingSbtOptionsReload = true;
  host._pendingSbtOptionsForceReload = host._pendingSbtOptionsForceReload || args.forceReload;
  host.applySbtOptions({
    sbtList: {},
    featuredEntries: [],
    ignoredSet: new Set(),
    fallbackSlug: args.slug,
    loadingOptions: true,
    scopeMode: args.scopeMode,
    targetSlugs: args.targetSlugs,
  });
  return host._loadSbtOptionsInflight;
};

export const settleSbtOptionsLoad = async (
  host: OptionsLoadHost,
  args: {
    buildLoadingPatch: () => SbtOptionsLoadingPatch;
    isCurrent: () => boolean;
    onError: (error: unknown) => void;
    requestSig: string;
    run: Promise<unknown>;
  },
): Promise<void> => {
  try {
    await args.run;
    if (args.isCurrent()) host._lastSbtOptionsRequestSig = args.requestSig;
  } catch (error) {
    if (args.isCurrent()) {
      if (host._lastSbtOptionsRequestSig === args.requestSig) host._lastSbtOptionsRequestSig = '';
      if (host._isMounted && host.state.loadingOptions) host.setState(args.buildLoadingPatch());
      args.onError(error);
    }
  } finally {
    if (host._loadSbtOptionsInflight === args.run) {
      host._loadSbtOptionsInflight = null;
      if (host._inflightSbtOptionsRequestSig === args.requestSig) host._inflightSbtOptionsRequestSig = '';
      const shouldRerun = host._pendingSbtOptionsReload;
      const rerunForce = host._pendingSbtOptionsForceReload;
      host._pendingSbtOptionsReload = false;
      host._pendingSbtOptionsForceReload = false;
      if (shouldRerun && host._isMounted) void host.loadSBTOptions({ force: rerunForce });
    }
  }
};
