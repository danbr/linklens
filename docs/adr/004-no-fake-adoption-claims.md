# ADR-004: No Fake Adoption Claims

Status: Accepted

## Context

Early OSS tools often drift into inflated positioning: implied adoption, vague traction, or claims that outrun the evidence. That damages trust.

## Decision

LinkLens must not claim adoption, user scale, maintainer demand, or ecosystem traction unless the claim is backed by explicit evidence in the repo or a cited external source.

## Consequences

Applications, grant text, README copy, and agent briefs should describe LinkLens as an existing CLI/tooling wedge and planned direction. They should not imply proven market pull unless the evidence exists.

## Enforcement

- `npm run adr:check` scans key public-positioning files for common fake-adoption phrasing.
- Future positioning changes should add evidence links or keep claims modest.
