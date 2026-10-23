# Session Worker publication upgrades

Upgrading an existing Session Worker requires its coordinator binding and a
review of any older question or survey corrections whose intended precedence
depended on the uploader's current admin role. No live inventory, config
migration, or republication runs automatically during an upgrade or read.

## Rollout order and mixed versions

Old Workers do not write the explicit admin publication stamp. A new client
reading an old Worker's unstamped history can therefore select the original
version while old interview or results readers still select a later correction
using current admin roles. Mixed versions do not guarantee agreement on the
canonical question or survey.

Plan a coordinated maintenance window or restrict affected traffic while the
upgrade is incomplete. Complete config preflight, upgrade the affected Workers
before enabling the new client, then review the inventory and republish any
intended corrections with a current admin through the upgraded Worker. Verify
that client hydration, interview catalogs, results reports, and retained agent
readers all select the same intended versions before reopening traffic. Rolling
back only one reader can restore the disagreement; preserve the inventory and
coordinate any rollback across the affected surfaces. No deployment ordering or
traffic restriction is applied automatically.

## Legacy config preflight

Before routing traffic to the new Worker, verify `CE_SESSION_COORDINATOR` binds
the SQLite-backed `SessionWriteCoordinator` class and that the
`ce-session-write-coordinator-v1` migration is installed. Public, ungated
content routes need current coordinator config too. Public `/session-config`
discovery alone does not exercise that dependency.

For a session that has no durable config authority yet, securely inspect an
operator-exported local copy of `session:{slug}:config`. It must parse as a JSON
object and pass the existing public-config normalization and secret checks.
Historical `allowOrigins` and `deployHelperEnabled` forms remain normalized;
missing optional AI policy fields do not prevent initialization. Malformed
JSON, non-object records, and forbidden credential-bearing public fields must
be repaired before first-use seeding. Never paste config values into public
reports or logs.

The local check below prints only a fixed result, never config values or field
paths. Run it from the repository root with Node 20.19+; point the environment
variable at the protected local export. It does not contact a Worker or mutate
the file.

```bash
CE_LEGACY_CONFIG_FILE=/private/path/session-config.json node --input-type=module <<'NODE'
import { readFile } from 'node:fs/promises';
import { normalizeWorkerConfigRecord } from './workers/sessionCorsWorker/sessionConfigNormalization.js';
import { findForbiddenCloudflareDeploymentTokenPath, findForbiddenWorkerConfigSecretPath } from './workers/shared/workerSessionConfig.mjs';
try {
  const raw = JSON.parse(await readFile(process.env.CE_LEGACY_CONFIG_FILE, 'utf8'));
  const config = normalizeWorkerConfigRecord(raw, { slug: 'preflight' });
  const valid = !!config && !findForbiddenCloudflareDeploymentTokenPath(config) && !findForbiddenWorkerConfigSecretPath(config);
  console.log(valid ? 'legacy_config_ready' : 'legacy_config_migration_required');
  process.exitCode = valid ? 0 : 1;
} catch {
  console.log('legacy_config_unreadable_or_invalid');
  process.exitCode = 1;
}
NODE
```

Keep a protected backup and arrange any credential relocation through the
supported session-secret workflow before removing it from public config. This
release does not infer a secret destination or migrate credentials. Before
durable authority exists, an operator must repair the legacy record using their
authorized deployment procedure; normal admission cannot initialize an invalid
record. Once authority exists, use signed Admin config writes: editing its KV
projection cannot replace coordinator authority. Do not delete durable state to
force re-import.

The permanent first-use failure is `503` with
`Stored legacy session config requires operator migration before use.`
The coordinator also identifies it as `session_config_migration_required`.
Storage or coordinator outages instead use
`Session config coordination is unavailable; retry.` with bounded retry/backoff.
Neither response reveals stored values or admits a cached config.

## Inventory and republish intended corrections

1. With authorized operator access, page through all question and survey index
   rows and group versions by resource and payload ID. Follow every cursor;
   an empty filtered page does not imply completion. Preserve the original rows
   and references in a protected inventory.
2. Identify IDs where the intended published version is a later correction but
   that version lacks the exact server-recorded `uploadAuthority: "admin"`
   stamp. Current roles and old `uploaderIsAdmin` flags cannot prove historical
   publication authority. Have the session owner confirm the intended payload.
3. If a correction should remain canonical, sign in as a current session admin
   and upload the approved payload again through the normal authenticated
   `/storage/upload` flow, preserving its question/survey ID. Do not backfill
   admin stamps or rewrite old metadata by hand.
4. After publication and storage propagation, verify the new listed row has the
   admin stamp and the intended content is selected by client hydration, the
   interview catalog, and results analysis. Hidden IDs remain hidden until an
   explicit admin visibility change. Retain old references for audit history.

Readers select the newest explicitly stamped admin version, otherwise the
earliest ordinary version. Equal timestamps use storage ID code-unit ordering:
descending for admin versions, ascending for ordinary versions. An unstamped
later correction may therefore stop winning after upgrade. Reading a record
does not migrate it, and later admin promotion/removal never changes a completed
upload's authority stamp.

Publication now rechecks the admitted revision and authorization epoch after
external payload storage. A stale completion returns `409` before its index or
initial owner record is written. Its bytes may remain orphaned; they are absent
from listing and canonical version selection. A KV-only orphan remains readable
by its opaque ID under current access rules. Upload retries are not deduplicated
and may create another reference; do not treat a failed upload as published.

## Hosted faucet compatibility

The hosted wizard now requests `workerAuthority.participantScopes: ["faucet_self"]`
(alongside the session's other grants). Current Workers issue the existing
`faucet` route scope only through their self-recipient and daily-limit handling.
Older Workers ignore `faucet_self`; older deploy helpers reject it during config
validation. Upgrade both before enabling the option. Do not translate the grant
back to `faucet` for an older Worker, whose route lacks the participant limits.

Local builds using the 0.6.14 release pin remain subject to both this limitation
and the missing publication stamp described above. Update the fallback pin only
after a compatible Worker release is published and its manifest is verified.
