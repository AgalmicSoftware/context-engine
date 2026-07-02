# ADR-0005: MainSite Route Table Migration

## Status

Accepted.

## Context

`MainSite` is still a class component and the application shell. Its route
dispatch used to be interleaved with rendering and runtime orchestration, which
made route ordering hard to reason about while modernization work moved other
runtime effects behind ports.

Route dispatch is now classified by the pure
`resolveMainSiteRouteMatch` table in
`client/src/components/MainSite/routeTable.ts`. `MainSite.getMainView` remains
the caller that renders views and owns URL side effects.

## Decision

Keep route classification as pure data/functions and keep rendering in
`MainSite`.

The route table owns:

- ordered route keys;
- route matching and canonical-path metadata;
- extracted route parameters such as session token, survey ID, question ID, and
  SBT address;
- cache-wait metadata used by the caller.

`MainSite` owns:

- rendering lazy route components;
- navigation and URL side effects;
- session/cache/listener orchestration around the selected route.

## Golden Routes

The table is pinned by `routeTable.test.ts` for the core route list:

- `/session/:token`
- `/session/:token/questions`
- `/session/:token/docs`
- `/survey/:id/results`
- `/question/:id?session=...`
- `/sbt/:address`
- `/u/:address`
- `/admin`
- `/sponsor`
- `/new` canonicalization
- group aliases

Degenerate double-slash SBT address paths such as `//sbt/0x...` and
`//group/0x...` are intentionally classified as SBT detail routes. Well-formed
route behavior remains the compatibility target.

## Constraints

- Do not convert `MainSite` from a class component as part of route-table work.
- Do not move `contractScripts`, `sessionRegistry`, or `arweaveRetryHelpers`
  imports as part of route classification changes. Later domain-port lanes may
  move those runtime seams independently when they are behavior-pinned.
- Do not change route paths, query parameters, aliases, or `data-testid` values.
- Add or update table tests before changing route order or route metadata.
- Keep URL side effects in the caller unless a future route controller owns and
  tests the side effect explicitly.

## Consequences

Route matching can now be reviewed and tested without rendering the full shell.
The migration also gives future MainSite port work a stable seam: runtime effects
can move behind ports without re-litigating basic route classification.
