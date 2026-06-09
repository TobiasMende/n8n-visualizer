# Security Policy

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report vulnerabilities privately via GitHub's
[Report a vulnerability](https://github.com/TobiasMende/n8n-visualizer/security/advisories/new)
form (repository **Security** tab → **Report a vulnerability**). This opens a
private advisory visible only to the maintainers.

Please include:

- A description of the issue and its impact.
- Steps to reproduce (a minimal proof of concept if possible).
- Affected version / commit and deployment context (self-hosted, the public
  instance, local).

We aim to acknowledge reports within a few days and will keep you updated on
remediation. Once a fix is released, we're happy to credit you in the advisory
unless you prefer to stay anonymous.

## Scope

This app acts as a **server-side proxy**: it fetches workflows from a
user-supplied n8n host and renders them. Security-relevant areas include:

- **SSRF** — outbound fetches to user-supplied hosts (`server/ingest/safe-fetch.ts`).
- **Request handling** — body-size limits, the per-IP rate limiter
  (`server/ratelimit/`), and the pagination deadline.
- **Client-side rendering** — escaping and link validation for uploaded /
  fetched workflow data.

API keys are sent to the app's server only to fetch workflows, held in memory
for the request, and never persisted server-side. Findings that weaken any of
the above are in scope.

## Supported versions

This is an actively developed project; security fixes target the latest `main`.
There are no long-term support branches.
