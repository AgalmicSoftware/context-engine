# PRD 510: Canonical Payload Pointer Naming Migration

## Status

Planned. This PRD records the follow-up naming migration after the dual-field
storage routing lane stabilizes.

Current slice note, 2026-05-08: Cloudflare-backed session payload storage now
uses `storageRef` compatibility for docs/context, questions, surveys,
responses, generated artifacts, media, and images while preserving legacy
Arweave pointer fields where the existing contract ABI requires them.

## Problem

Context Engine payload records still expose Arweave-specific top-level pointer
names such as `arweaveTxId`, survey hash, question hash, and response hash.
Those fields remain necessary for current smart contract compatibility, but new
client, worker, and agent surfaces also need a backend-agnostic pointer because
payloads may live in Arweave, Lit-Arweave, or Cloudflare session storage.

## Decision

The long-term canonical top-level payload pointer should be named and
conceptualized as `storageRef`.

During the current slice:

- keep legacy `arweaveTxId` / Arweave hash fields for compatibility;
- add `storageRef` to new off-chain, client cache, worker, and agent shapes;
- read `storageRef` first and fall back to `arweaveTxId`;
- emit both `arweaveTxId` and `storageRef` for Arweave and Lit-Arweave writes;
- emit opaque Cloudflare `storageRef` values and, where existing contract
  `bytes32` pointer fields are the only compatibility path, write the same
  opaque 32-byte base64url Cloudflare ID into the legacy on-chain pointer field;
- do not change smart contract interfaces.

The existing Surveys contract fields are opaque `bytes32` values. They do not
validate Arweave transaction shape on-chain, so Cloudflare session payload
pointers can use those fields as long as the worker returns IDs that round-trip
through the existing bytes32/base64url helper boundary. Those IDs are not
Arweave transaction IDs; `storageRef.backend = "cloudflare"` is the canonical
disambiguator.

## Scope

This migration covers CE payload storage: session context, documents, media,
questions, surveys, responses, and generated artifacts. Cloudflare storage is
not user preference/profile storage and must not become a place for long-lived
profile preferences. The only exception in the current agent lane is the
private Telegram demo bridge, which may store demo onboarding preferences,
suggested response drafts, temporary action IDs, event logs, and Telegram demo
account state. It must call the canonical session worker storage/API surface for
real session questions, surveys, responses, docs, and context.

## Non-Goals

- Rename every existing `arweaveTxId`, `questionHash`, `surveyHash`, or
  `responseHash` call site in this slice.
- Fake Arweave transaction ids for Cloudflare payloads.
- Expose raw Cloudflare bucket paths, account ids, worker tokens, long-lived
  URLs, secrets, or private key material.
- Change Solidity interfaces or historical on-chain event meanings.
- Add storage-backend mutation or migration for existing sessions. Storage
  backend selection is creation-time `/new` config for this lane.

## Migration Plan

1. Make all readers `storageRef`-aware while preserving legacy fallback reads.
2. Keep emitting dual fields for Arweave/Lit-Arweave writes.
3. Route Cloudflare payload writes through opaque bytes32-compatible worker refs
   and worker authorization.
4. After readers and public/agent consumers are storageRef-aware, rename the
   canonical top-level pointer in docs and API schemas to `storageRef`.
5. Leave `arweaveTxId` as a deprecated compatibility alias for Arweave-backed
   records until downstream consumers no longer require it.

## Acceptance Criteria

- Old Arweave consumers still receive `arweaveTxId` for Arweave-backed question,
  survey, and response payloads.
- New consumers receive `storageRef` for Arweave, Lit-Arweave, and Cloudflare
  payloads.
- Cloudflare refs are opaque and worker-mediated.
- Public release stripping continues to remove private CE-CC, agent-native, and
  Telegram bridge artifacts.
