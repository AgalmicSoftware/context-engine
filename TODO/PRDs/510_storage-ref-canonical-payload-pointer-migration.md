# PRD 510: Canonical Payload Pointer Naming Migration

## Status

Planned. This PRD records the follow-up naming migration after the dual-field
storage routing lane stabilizes.

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
- emit only opaque `storageRef` for Cloudflare writes unless a documented
  compatibility path strictly requires a real Arweave pointer;
- do not change smart contract interfaces.

## Scope

This migration covers CE payload storage: session context, documents, media,
questions, surveys, responses, and generated artifacts. Cloudflare storage is
not user preference/profile storage and must not become a place for long-lived
profile preferences.

## Non-Goals

- Rename every existing `arweaveTxId`, `questionHash`, `surveyHash`, or
  `responseHash` call site in this slice.
- Fake Arweave transaction ids for Cloudflare payloads.
- Expose raw Cloudflare bucket paths, account ids, worker tokens, long-lived
  URLs, secrets, or private key material.
- Change Solidity interfaces or historical on-chain event meanings.

## Migration Plan

1. Make all readers `storageRef`-aware while preserving legacy fallback reads.
2. Keep emitting dual fields for Arweave/Lit-Arweave writes.
3. Route Cloudflare payload writes through opaque worker refs and worker
   authorization.
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
