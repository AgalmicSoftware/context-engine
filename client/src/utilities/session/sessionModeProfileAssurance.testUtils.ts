// Test-only support census. The testUtils suffix keeps it out of the production coverage universe.
import {
  SESSION_MODE_DEFAULT_REGISTRY_CHAIN_ID,
  SESSION_MODE_PRESET_IDS,
  cloneSessionModePreset,
} from './sessionModeProfilePresets';
import type {
  SessionModeAuthorityMode,
  SessionModeAuthorizationMechanism,
  SessionModeEncryptionMode,
  SessionModeExportScope,
  SessionModeIdentityMethod,
  SessionModeKeyProvider,
  SessionModePresetId,
  SessionModeProfile,
  SessionModeProfileSupportStatus,
  SessionModeResultsVisibility,
  SessionModeStorageBackend,
  SessionModeSurface,
} from './sessionModeProfileTypes';

type PayloadAccessControl = NonNullable<SessionModeProfile['storage']['payloadAccessControl']>;
type PayloadGate = NonNullable<PayloadAccessControl['gate']>;
type AccessMatch = NonNullable<SessionModeProfile['encryption']['accessConditions']>['match'];
type AccessConditionKind = NonNullable<
  SessionModeProfile['encryption']['accessConditions']
>['conditions'][number]['kind'];

// This is deliberately exhaustive. Adding an enum value requires an explicit support
// decision here before typecheck and the assurance tests can pass.
export const SESSION_MODE_DECLARED_SUPPORT = {
  preset: {
    fast_cheap_cloudflare: 'reachable',
    trustless_public_decentralized: 'reachable',
    custom: 'reachable',
  } satisfies Record<SessionModePresetId, SessionModeProfileSupportStatus>,
  authority: {
    worker_canonical: 'reachable',
    worker_with_public_anchor: 'schema_only',
    evm_registry_canonical: 'reachable',
    org_private_chain: 'unavailable',
  } satisfies Record<SessionModeAuthorityMode, SessionModeProfileSupportStatus>,
  storage: {
    cloudflare: 'reachable',
    arweave: 'reachable',
  } satisfies Record<SessionModeStorageBackend, SessionModeProfileSupportStatus>,
  encryption: {
    none: 'reachable',
    lit: 'reachable',
    worker_envelope: 'reachable',
  } satisfies Record<SessionModeEncryptionMode, SessionModeProfileSupportStatus>,
  keyProvider: {
    worker_secret: 'reachable',
    cloudflare_secrets_store: 'invalid',
    external_kms: 'invalid',
  } satisfies Record<SessionModeKeyProvider, SessionModeProfileSupportStatus>,
  identity: {
    passkey: 'reachable',
    wallet: 'reachable',
    telegram: 'schema_only',
    agent_grant: 'schema_only',
  } satisfies Record<SessionModeIdentityMethod, SessionModeProfileSupportStatus>,
  authorization: {
    worker_roles: 'reachable',
    worker_groups: 'schema_only',
    sbt_onchain: 'reachable',
    evm_address_allowlist: 'schema_only',
    telegram_account_role: 'schema_only',
    agent_grant: 'schema_only',
  } satisfies Record<SessionModeAuthorizationMechanism, SessionModeProfileSupportStatus>,
  surface: {
    web: 'reachable',
    telegram: 'reachable',
    miniApp: 'reachable',
    agentHttp: 'reachable',
    mcp: 'schema_only',
    ceCc: 'schema_only',
  } satisfies Record<SessionModeSurface, SessionModeProfileSupportStatus>,
  results: {
    private_admin: 'unavailable',
    participant_aggregate: 'reachable',
    session_member_aggregate: 'reachable',
    public_redacted_snapshot: 'unavailable',
    public_full_if_storage_public: 'reachable',
  } satisfies Record<SessionModeResultsVisibility, SessionModeProfileSupportStatus>,
  export: {
    admin_raw: 'reachable',
    all_session: 'reachable',
    selected_surfaces: 'unavailable',
    encrypted_envelopes_only: 'reachable',
  } satisfies Record<SessionModeExportScope, SessionModeProfileSupportStatus>,
  gate: {
    none: 'reachable',
    sbt_gate: 'schema_only',
    group_gate: 'schema_only',
    role_gate: 'reachable',
  } satisfies Record<PayloadGate, SessionModeProfileSupportStatus>,
  accessMatch: {
    any: 'reachable',
    all: 'reachable',
  } satisfies Record<AccessMatch, SessionModeProfileSupportStatus>,
  accessCondition: {
    worker_role: 'reachable',
    sbt_onchain: 'reachable',
    agent_grant_scope: 'reachable',
  } satisfies Record<AccessConditionKind, SessionModeProfileSupportStatus>,
} as const;

const customCloudflareProfile = (): SessionModeProfile => {
  const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
  profile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
  return profile;
};

const publicCloudflareProfile = (): SessionModeProfile => {
  const profile = customCloudflareProfile();
  profile.storage.payloadAccessControl = { gate: 'none', encryption: 'none' };
  profile.encryption = { mode: 'none' };
  profile.results.visibility = 'public_full_if_storage_public';
  profile.export.scope = 'all_session';
  return profile;
};

const roleGatedPlaintextCloudflareProfile = (): SessionModeProfile => {
  const profile = customCloudflareProfile();
  profile.storage.payloadAccessControl = {
    ...profile.storage.payloadAccessControl!,
    encryption: 'none',
  };
  profile.encryption = { mode: 'none' };
  return profile;
};

const litCloudflareProfile = (): SessionModeProfile => {
  const profile = customCloudflareProfile();
  profile.evm.registryChainId = SESSION_MODE_DEFAULT_REGISTRY_CHAIN_ID;
  profile.storage.payloadAccessControl = {
    ...profile.storage.payloadAccessControl!,
    encryption: 'lit',
  };
  profile.encryption = { mode: 'lit' };
  return profile;
};

const sbtEnvelopeProfile = (): SessionModeProfile => {
  const profile = customCloudflareProfile();
  const accessConditions = {
    match: 'all' as const,
    conditions: [
      { kind: 'worker_role' as const, role: 'reviewer' },
      {
        kind: 'sbt_onchain' as const,
        chainId: SESSION_MODE_DEFAULT_REGISTRY_CHAIN_ID,
        contract: '0x00000000000000000000000000000000000000aa',
        anyOrAll: 'any' as const,
      },
    ],
  };
  profile.evm.registryChainId = SESSION_MODE_DEFAULT_REGISTRY_CHAIN_ID;
  profile.authorization.mechanisms = ['worker_roles', 'sbt_onchain'];
  profile.storage.payloadAccessControl = {
    gate: 'role_gate',
    encryption: 'worker_envelope',
    accessConditions,
  };
  profile.encryption = { mode: 'worker_envelope', keyProvider: 'worker_secret', accessConditions };
  return profile;
};

const litArweaveProfile = (): SessionModeProfile => {
  const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED);
  profile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
  profile.encryption = { mode: 'lit' };
  profile.results.visibility = 'participant_aggregate';
  profile.export.scope = 'encrypted_envelopes_only';
  return profile;
};

const multiSurfaceProfile = (): SessionModeProfile => {
  const profile = customCloudflareProfile();
  profile.surfaces.telegram = true;
  profile.surfaces.miniApp = true;
  profile.surfaces.agentHttp = true;
  profile.results.visibility = 'session_member_aggregate';
  profile.export.scope = 'encrypted_envelopes_only';
  return profile;
};

export type SessionModeAssuranceFixture = {
  id: string;
  profile: SessionModeProfile;
};

export const createReachableSessionModeFixtures = (): SessionModeAssuranceFixture[] => [
  {
    id: 'cloudflare-worker-envelope',
    profile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
  },
  {
    id: 'decentralized-arweave-public',
    profile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED),
  },
  { id: 'cloudflare-public', profile: publicCloudflareProfile() },
  { id: 'cloudflare-role-gated-plaintext', profile: roleGatedPlaintextCloudflareProfile() },
  { id: 'cloudflare-lit', profile: litCloudflareProfile() },
  { id: 'cloudflare-worker-envelope-sbt', profile: sbtEnvelopeProfile() },
  { id: 'arweave-lit', profile: litArweaveProfile() },
  { id: 'cloudflare-multi-surface', profile: multiSurfaceProfile() },
];

export type SessionModeStatusSentinel = {
  id: string;
  dimension: keyof typeof SESSION_MODE_DECLARED_SUPPORT;
  value: string;
  expectedStatus: SessionModeProfileSupportStatus;
  expectedIssueCode: string;
  profile: SessionModeProfile;
};

const statusSentinel = (
  id: string,
  dimension: SessionModeStatusSentinel['dimension'],
  value: string,
  expectedStatus: SessionModeProfileSupportStatus,
  expectedIssueCode: string,
  mutate: (profile: SessionModeProfile) => void,
  base: () => SessionModeProfile = customCloudflareProfile,
): SessionModeStatusSentinel => {
  const profile = base();
  mutate(profile);
  return { id, dimension, value, expectedStatus, expectedIssueCode, profile };
};

const publicAnchorProfile = (): SessionModeProfile => {
  const profile = customCloudflareProfile();
  profile.authority.mode = 'worker_with_public_anchor';
  profile.evm.registryChainId = SESSION_MODE_DEFAULT_REGISTRY_CHAIN_ID;
  return profile;
};

export const createUnsupportedSessionModeSentinels = (): SessionModeStatusSentinel[] => [
  statusSentinel(
    'public-anchor-authority',
    'authority',
    'worker_with_public_anchor',
    'schema_only',
    'schema_only_authority',
    (profile) => {
      profile.authority.mode = 'worker_with_public_anchor';
      profile.evm.registryChainId = SESSION_MODE_DEFAULT_REGISTRY_CHAIN_ID;
    },
  ),
  statusSentinel('private-chain-authority', 'authority', 'org_private_chain', 'unavailable', 'reserved', (profile) => {
    profile.authority.mode = 'org_private_chain';
  }),
  ...(['cloudflare_secrets_store', 'external_kms'] as const).map((keyProvider) =>
    statusSentinel(`${keyProvider}-key-provider`, 'keyProvider', keyProvider, 'invalid', 'reserved', (profile) => {
      profile.encryption.keyProvider = keyProvider;
    }),
  ),
  ...(['telegram', 'agent_grant'] as const).map((method) =>
    statusSentinel(
      `${method}-identity`,
      'identity',
      method,
      'schema_only',
      'schema_only_identity_method',
      (profile) => {
        profile.identity.enabled.push(method);
      },
    ),
  ),
  ...(['worker_groups', 'telegram_account_role', 'agent_grant'] as const).map((mechanism) =>
    statusSentinel(
      `${mechanism}-authorization`,
      'authorization',
      mechanism,
      'schema_only',
      'schema_only_authorization_mechanism',
      (profile) => {
        profile.authorization.mechanisms.push(mechanism);
      },
    ),
  ),
  statusSentinel(
    'address-allowlist-authorization',
    'authorization',
    'evm_address_allowlist',
    'schema_only',
    'schema_only_authorization_mechanism',
    (profile) => {
      profile.authorization.mechanisms.push('evm_address_allowlist');
    },
    publicAnchorProfile,
  ),
  ...(['mcp', 'ceCc'] as const).map((surface) =>
    statusSentinel(`${surface}-surface`, 'surface', surface, 'schema_only', 'schema_only_surface', (profile) => {
      profile.surfaces[surface] = true;
    }),
  ),
  ...(['private_admin', 'public_redacted_snapshot'] as const).map((visibility) =>
    statusSentinel(
      `${visibility}-results`,
      'results',
      visibility,
      'unavailable',
      'results_visibility_not_implemented',
      (profile) => {
        profile.results.visibility = visibility;
      },
    ),
  ),
  statusSentinel(
    'selected-surfaces-export',
    'export',
    'selected_surfaces',
    'unavailable',
    'selected_surface_export_not_implemented',
    (profile) => {
      profile.export = { scope: 'selected_surfaces', surfaceFilter: ['web'] };
    },
  ),
  ...(['sbt_gate', 'group_gate'] as const).map((gate) =>
    statusSentinel(`${gate}-payload-gate`, 'gate', gate, 'schema_only', 'schema_only_payload_gate', (profile) => {
      if (profile.storage.payloadAccessControl) profile.storage.payloadAccessControl.gate = gate;
    }),
  ),
];
