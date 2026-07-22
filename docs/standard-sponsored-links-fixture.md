# Standard Sponsored Links Fixture

This is a temporary public fixture for launch/demo convenience. It exists so a
hosted Context Engine deployment can publish a small set of ready-to-use
sponsored `/new` links without waiting for a full claimed-link service.

The tracked fixture is:

- `client/public/standard-sponsored-links.json`

When the client is built, the file is served as:

- `/standard-sponsored-links.json` for root deployments
- `<PUBLIC_URL>/standard-sponsored-links.json` for subpath deployments

## Important Warning

Sponsored setup URLs are bearer grants. A full URL shaped like
`/new?sponsored=<txId>#k=<secret>` lets whoever has the link decrypt and use the
sponsored bundle until it is consumed, expires, or is rotated.

Do not put durable production secrets in this fixture. Only publish links that
are intentionally public, limited, disposable, and safe to lose.

When creating fixture links through `/sponsor`, use a separate low-budget
resource profile. Prefer provider-side spend caps or prepaid keys for AI,
short expirations, small faucet balances, disposable Arweave/Lit payer wallets,
and credentials that can be revoked without affecting normal sessions. Never
publish a sponsored URL backed by unrestricted production API keys.

## Fixture Shape

```json
{
  "version": 1,
  "temporaryFixture": true,
  "links": [
    {
      "label": "Sponsored setup 1",
      "url": "https://contextengine.sh/new?sponsored=<txId>#k=<secret>",
      "active": true
    }
  ]
}
```

The checked-in fixture keeps all slots inactive and empty. To use it for a
temporary public deployment:

1. Create sponsored URLs through `/sponsor` using resource-limited, disposable
   keys and short expirations.
2. Paste up to ten URLs into the fixture.
3. Set only intentionally available links to `"active": true`.
4. Rebuild and redeploy the client, or upload the JSON file to the GitHub/static
   host that the deployment reads from.
5. Remove or set `"active": false` after a link is used, expires, or fails.

## Temporary Contract

- The manifest is operator-managed. It does not know whether a link has already
  been clicked.
- A link is "unused" only if the operator has left it active in the manifest.
- The existing sponsored deploy/faucet grants remain the final safety check.
- The fixture does not enforce spend limits. Budget limits must come from the
  credentials, wallets, provider account settings, or the future replacement
  service.
- If a stale link is clicked, the `/session/new` sponsored-bundle flow should
  fail through the normal malformed/expired/used-link states.

## Removal Plan

Replace this fixture with a worker-backed claim service. The replacement should
return one currently available sponsored link without publishing the whole pool
and track resource budgets so public sponsored links cannot silently run up AI,
storage, faucet, or Lit costs.
