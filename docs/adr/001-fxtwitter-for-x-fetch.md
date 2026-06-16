# ADR-001: Fetch X/Twitter Through fxtwitter

Status: Accepted

## Context

X/Twitter pages are brittle for agent workflows. Direct browsing often fails, requires auth, or returns page chrome instead of stable tweet data.

## Decision

LinkLens fetches public X/Twitter status URLs through the fxtwitter API:

`https://api.fxtwitter.com/<username>/status/<tweet_id>`

The CLI must keep deterministic URL conversion for `x.com` and `twitter.com` status links.

## Consequences

This keeps LinkLens simple, unauthenticated, and source-grounded for public tweets. If fxtwitter breaks or rate-limits, LinkLens should add an explicit adapter fallback rather than silently browsing X directly.

## Enforcement

- `npm test` covers `fxtwitterUrl()`.
- `npm run adr:check` requires this ADR to remain present.
