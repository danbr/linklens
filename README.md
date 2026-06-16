# LinkLens

LinkLens turns raw social links into structured context packs for coding agents.

It started from a common agent workflow: someone drops an X/Twitter link in chat, and the useful output is not a generic summary. The useful output is the original post, the quoted/article context, the signal, the risks, and the concrete way it maps to the operator's work.

## Install

```sh
npm install -g @danbr/linklens
```

For local development:

```sh
npm install
npm test
node bin/linklens.mjs "https://x.com/openai/status/123"
```

## Usage

```sh
linklens "https://x.com/user/status/123"
linklens "https://x.com/user/status/123" --json
linklens bookmarks ./bookmarks.json --out ./bookmark-brain
linklens adr-check
```

Markdown output includes:

- source metadata
- original post text
- quoted post/article context when available
- a reusable agent brief prompt

JSON output is suitable for downstream agent tools.

The bookmark importer accepts JSON, JSONL, or CSV exports from common X bookmark exporters and writes one markdown note per usable bookmark. Each note keeps the original link, post text, author, available engagement metrics, stable topic tags, and an agent prompt for mapping the saved idea into concrete work.

## Repo Decisions

Architecture and positioning decisions live in `docs/adr/`. Agents should read those records before changing source adapters, schemas, prompts, or public copy.

Run the guardrail with:

```sh
npm run adr:check
```

## Why this exists

Most link summarizers optimize for compression. Agents need something slightly different:

- deterministic fetching and context extraction
- enough raw material for a model to reason from
- explicit prompts that push from "interesting" to "what should we do?"
- a path to turn repeated workflows into skills

## AgentSkill

The `skill/` directory contains a compact AgentSkill wrapper for agents that support skill loading.

## Limits

Today LinkLens focuses on public X/Twitter status URLs via the fxtwitter API. More sources can be added as deterministic fetchers.

## License

MIT
