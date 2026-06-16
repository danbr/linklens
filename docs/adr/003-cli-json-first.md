# ADR-003: CLI and JSON First

Status: Accepted

## Context

LinkLens is most useful as agent infrastructure, not a UI-first product. Agents and scripts need predictable command output, stable schemas, and testable behavior.

## Decision

LinkLens ships as a CLI-first tool. Human-readable markdown is the default output, and machine-readable JSON must remain available for source context packs.

## Consequences

New source adapters and importers should start as CLI commands with test coverage. UI, hosted API, or dashboard work can come later, but must not replace the deterministic CLI path.

## Enforcement

- `npm test` covers exported parser/renderer behavior.
- `npm run adr:check` requires this ADR to remain present.
