import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  checkAdrs,
  extractContext,
  extractTweetId,
  fxtwitterUrl,
  normalizeBookmark,
  parseBookmarkExport,
  renderBookmarkNote,
  renderMarkdown,
  requiredAdrFiles
} from "../bin/linklens.mjs";

test("extracts x.com tweet ids", () => {
  assert.deepEqual(extractTweetId("https://x.com/alice/status/123?s=20"), {
    username: "alice",
    id: "123"
  });
});

test("extracts twitter.com tweet ids", () => {
  assert.equal(
    fxtwitterUrl("https://twitter.com/bob/status/456"),
    "https://api.fxtwitter.com/bob/status/456"
  );
});

test("extracts quote article context", () => {
  const context = extractContext({
    url: "https://x.com/a/status/1",
    text: "read this",
    author: { name: "A", screen_name: "a", followers: 10 },
    quote: {
      url: "https://x.com/b/status/2",
      text: "article",
      author: { screen_name: "b" },
      article: {
        title: "A useful article",
        preview_text: "Preview",
        content: {
          blocks: [{ text: "First paragraph" }, { text: "Second paragraph" }]
        }
      }
    }
  });

  assert.equal(context.quote.articleTitle, "A useful article");
  assert.match(context.quote.articleText, /Second paragraph/);
});

test("renders a reusable agent prompt", () => {
  const markdown = renderMarkdown({
    sourceUrl: "https://x.com/a/status/1",
    author: { name: "A", handle: "a" },
    text: "raw idea",
    metrics: {},
    quote: null,
    article: null,
    media: []
  });

  assert.match(markdown, /Agent brief prompt/);
  assert.match(markdown, /reusable skill/);
});

test("parses json bookmark exports", () => {
  const records = parseBookmarkExport(
    JSON.stringify({
      bookmarks: [
        {
          url: "https://x.com/alice/status/123",
          text: "AI pricing workflow",
          author_handle: "alice"
        }
      ]
    }),
    "bookmarks.json"
  );

  assert.equal(records.length, 1);
  assert.equal(records[0].author_handle, "alice");
});

test("normalizes common bookmark export fields", () => {
  const bookmark = normalizeBookmark({
    tweetUrl: "https://x.com/alice/status/123",
    fullText: "Build an agent workflow for app growth",
    username: "@alice",
    likes: "42"
  });

  assert.equal(bookmark.sourceUrl, "https://x.com/alice/status/123");
  assert.equal(bookmark.author.handle, "alice");
  assert.equal(bookmark.metrics.likes, 42);
});

test("renders bookmark notes with stable topic tags", () => {
  const note = renderBookmarkNote(
    normalizeBookmark({
      url: "https://x.com/alice/status/123",
      text: "Claude Code agent workflow for iOS app growth",
      screen_name: "alice"
    })
  );

  assert.match(note, /bookmark\/ai/);
  assert.match(note, /bookmark\/apps/);
  assert.match(note, /Agent Prompt/);
});

test("ADR check passes for the repository decision records", async () => {
  const result = await checkAdrs(path.resolve(import.meta.dirname, ".."));

  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(requiredAdrFiles.length, 5);
});

test("ADR check catches unsupported adoption claims", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "linklens-adr-"));
  const adrDir = path.join(root, "docs", "adr");
  await mkdir(adrDir, { recursive: true });

  await writeFile(path.join(adrDir, "000-index.md"), "# Index\n", "utf8");
  for (const filename of requiredAdrFiles.filter((file) => file !== "000-index.md")) {
    await writeFile(
      path.join(adrDir, filename),
      `# ${filename}\n\nStatus: Accepted\n\n## Enforcement\n\n- Test fixture.\n`,
      "utf8"
    );
  }
  await writeFile(path.join(root, "README.md"), "LinkLens is trusted by serious teams.\n", "utf8");

  const result = await checkAdrs(root);

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /unsupported adoption claim/);
});
