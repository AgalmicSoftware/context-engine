# Retired separate Agent Bridge source

New sessions use [Agent HTTP in the Session Worker](../sessionCorsWorker/agent/README.md).
The separate runtime, installer and bundle target have been removed. Existing
Bridge deployments and storage are unchanged; no migration or resource retirement
is performed by this source change. `PUBLIC_RELEASE_CUTOVER` remains solely to
preserve the audited public-history boundary for historical commits.
