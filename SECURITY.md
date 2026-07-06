# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest on the current default branch | Yes |

## Reporting a Vulnerability

If you discover a security vulnerability in Context Engine, **please do not open a public issue.**

Report it privately through one of these channels:

1. **Email:** `[redacted-email]`
2. **GitHub private advisory:** [Report a vulnerability](https://github.com/AgalmicSoftware/context-engine/security/advisories/new)

### What to include

- Description of the vulnerability
- Steps to reproduce or a proof of concept
- Affected components
- Potential impact
- Suggested fix (if any)

### What to expect

- We aim to acknowledge reports within **48 hours**.
- We will follow up with status updates as we validate and remediate the issue.
- We will coordinate disclosure timing with you when a report is confirmed.

### Scope

The following are in scope:

- Smart contracts
- Worker endpoints
- Client-side cryptography and encryption flows
- Authentication and authorization flows

### Out of scope

- Social engineering
- Phishing
- Denial-of-service attacks against public testnets

### Credit

We are happy to credit responsible reporters after a fix is available unless you prefer to remain anonymous.


## Security Practices

- All secrets use environment variables or worker KV — never committed to code
- Repository security reviews have been run in Codex using GPT-5.4 and Claude Opus 4.6 against the Trail of Bits methodology skill/runbook; those findings informed remediation work but do not replace a formal external audit
- A formal third-party security audit remains a project goal for a future release
- SBT-gated encryption uses Lit Protocol access control conditions
- CORS policies enforced at the worker level
