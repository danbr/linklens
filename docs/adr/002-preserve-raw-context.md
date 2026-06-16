# ADR-002: Preserve Raw Context Before Summarizing

Status: Accepted

## Context

Generic link summarizers compress too early. Coding agents need the original post, quoted context, article text, media references, and metadata before deciding what to do.

## Decision

LinkLens output must preserve raw source context before the agent brief prompt. Summaries and recommendations can be derived later, but the context pack should keep enough source material for another agent to inspect the reasoning trail.

## Consequences

Markdown output should include source metadata, original post text, quoted/article context when available, and an action-oriented prompt. JSON output should expose structured context for downstream tools.

## Enforcement

- `npm test` covers quote/article extraction and markdown prompt rendering.
- `npm run adr:check` requires this ADR to remain present.
