# LinkLens Bookmark Brain

Verdict: build on the tweet by making LinkLens ingest exported X bookmarks into agent-readable markdown notes. This is more useful than a standalone consumer app today because Dan already runs Slack-as-command, App Factory, and link-driven signal capture.

Signal: Ole Lehmann's 2026-06-02 post argues that bookmark rot is now easy to fix by exporting X bookmarks, dropping them into a knowledge folder, and letting an agent split them into searchable markdown notes.

Risks:
- Export schemas vary across userscripts and browser extensions.
- Bookmark text can be noisy engagement bait; notes need an explicit agent prompt to separate signal from vibes.
- This should stay local until Dan approves any external sync, scraping, posting, or paid service.

Next command:

```sh
cd /Users/hedy/.openclaw/workspace/hedy/linklens
npm test
node bin/linklens.mjs bookmarks /path/to/bookmarks.json --out ../research/bookmark-brain
```

Work units:
- Done: add `linklens bookmarks <export-file> --out <notes-folder>`.
- Done: support JSON, JSONL, and CSV exports with common bookmark field aliases.
- Done: render each bookmark as markdown with source, author, metrics, stable topic tags, and an agent action prompt.
- Next: run Dan's real X bookmark export through it.
- Next: add search/synthesis command once the first real export shows the schema and volume.

Verification gates:
- `npm test` passes.
- A fixture export writes one note per usable bookmark.
- Generated notes include original link, text, author if available, tags, metrics, and the App Factory/OpenClaw mapping prompt.
