# Worker authorization for Lit key release

New Lit authorities use `worker-signed-v1`. A scoped Lit usage API key can invoke the registered Action, but cannot choose a different requester, RPC endpoint, or reply destination. The Action requires a short-lived authorization signed by the session Worker before it checks the gate or uses a PKP.

## What changes for participants

- A member signs in as usual. The Worker authenticates that wallet, approves the chain and HTTPS RPC, and signs the exact request. The Action verifies the signature, checks SBT ownership, and encrypts the content key back to that Worker request. The Worker returns the key through the authenticated route.
- Someone with a copied scoped Lit usage key cannot claim to be a member by inserting a holder's wallet address. There is no valid Worker signature for that claim.
- A copied signed request can be replayed within its lifetime, but every replay returns an encrypted reply bound to the original Worker's ephemeral key. The copied request does not grant the replaying caller a readable content key.
- An author can still encrypt for an SBT group without owning its SBT. Decryption still checks Any/All gate ownership.

The Worker operator remains trusted and sees content keys. Lit account administrators and anyone able to change PKP/group/Action permissions remain trusted: an account management key can authorize a different Action. This is not end-to-end encryption or protection from those operators. The new restriction applies to scoped execution credentials without management authority.

## Protocol and storage

`shared/litChipotleAction.mjs` is the canonical Action factory used by the Worker, frontend, and CE-CC catalogs. Provisioning embeds the session slug, independent Worker signer address, and PKP ID as constants before deriving the Action CID. The source never trusts a signer supplied in `jsParams`, and the Worker never executes participant-supplied source.

The Worker generates `litAuthorizationPrivateKey` and reserves it in an encrypted per-session coordinator record before making remote provisioning calls. Concurrent first bootstraps receive the same durable signer. Completed provisioning commits matching Lit credentials and secrets as one coordinator update, then projects the encrypted secrets and public config to KV. An interrupted projection returns a retryable failure and retains an encrypted repair journal; later setup, config, and admin secret operations repair the pair before proceeding. Admin secret edits use the same session queue and return a retryable failure while repair is blocked, so an old Lit journal cannot overwrite an acknowledged later edit. This is independent of Lit API keys, wallet login keys, and API-key scopes. Reprovisioning preserves this signer. It is excluded from admin-settable secret fields, status output, participant responses, browser caches, and sponsored exports. Public configuration carries `litAuthorizationVersion` and `litAuthorizationSigner` alongside `litApiBase`, `litGroupId`, `litPkpId`, and `litActionCid`.

The EIP-191 signature covers a stable JSON message prefixed by `Context Engine Lit authorization v1` and a newline. Fields bind the version, authoritative session slug (including the empty default slug), operation, authenticated requester address, chain, exact approved RPC, policy fingerprint, PKP, Action CID, digest of the exact message/ciphertext, issued/expiry timestamps, random request ID, and ephemeral reply public key. Lifetime is at most 60 seconds; future issue times allow five seconds of clock skew. The Action rechecks expiry around key operations. Wrapped keys remain policy-bound v2 JSON, so an unrelated gate cannot unwrap an existing ciphertext.

Decrypt replies use P-256 ECDH, HKDF-SHA256, and AES-256-GCM. The signed authorization text is authenticated as additional data and its Keccak-256 digest supplies the HKDF salt; the HKDF info is `Context Engine Lit reply v1`. Each Action execution creates a fresh keypair and 12-byte IV. The Worker keeps its corresponding private key in memory for that request, validates the encrypted reply, and discards response internals before responding. Missing/malformed encrypted replies never fall back to legacy plaintext responses. The request ID binds a request; it is not a persisted single-use nonce.

## Upgrade and cutover

Deploying new Worker code alone does not update existing Lit Actions or protect old ciphertext. Old or incomplete authorization configuration fails closed; admin status reports `ready: false` and `needsFreshAuthority: true`.

1. Deploy the updated Worker and use its existing signed admin `lit-chipotle-bootstrap-session` or `lit-chipotle-provision` action with `freshAuthority: true` in the signed request body. Keep the session's account management key available on the Worker. This is an explicit authority replacement; ordinary retry/bootstrap calls do not silently upgrade an old authority.
2. The Worker creates a fresh group, fresh PKP, new Action specialized for that session, and new usage key. The new group contains only that Action and PKP. The usage key receives execute permission for that group and no management permissions. Supplied old group/PKP/Action identifiers are not reused for the replacement.
3. Confirm admin status, then test encryption and decryption with both an eligible and ineligible wallet. Keep the Worker's private signing secret private; copying the public configuration to another Worker does not transfer signing authority.
4. Retire old usage keys and old Action/PKP group permissions through the account's management tools after deciding what historical access to preserve. Never attach an old unsigned Action to the new PKP, even if its request claims the new Action CID. That would restore a bypass.

The cutover applies to newly encrypted content. Historical ciphertext stays under its old PKP and Action; this change does not migrate it or undo previous disclosure. Keep required historical access separately, or decrypt and re-encrypt selected content under the fresh authority before retiring that access. Do not claim old stored keys are retroactively protected.

A failed provisioning attempt keeps the independent signer in the coordinator for retries, without an early whole-secrets KV write. A completed bootstrap with matching config/secret is idempotent. A failure after remote resources were created can leave unused Lit groups or wallets; inspect those before cleanup. This repository change does not itself deploy, mutate live KV, provision paid Lit resources, or revoke old permissions.

## Verification

Local tests execute the specialized Action with real ethers v5 signature verification and WebCrypto, using an ethers v6 Worker signer. They cover the direct unsigned bypass, signature/context mutations, expiry, Any/All decisions, non-holder authoring, reply-key substitution, replay confidentiality, legacy fail-closed behavior, secret scrubbing, and fresh PKP/group isolation. The runtime smoke harness exercises Worker routes and encrypted storage with a simulated Lit transport. Run `node --test workers/sessionCorsWorker/chipotleClient.test.mjs workers/sessionCorsWorker/adminRequestDispatch.test.mjs workers/sessionCorsWorker/sessionLitAuthorizationCoordinator.test.mjs` for the protocol, admin, and persistence checks.

A hosted smoke run is a separate operational step requiring authorized paid credentials. Local tests do not prove the deployed Action, live permissions, hosted clock, or provider configuration.
