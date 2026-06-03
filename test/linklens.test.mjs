import test from "node:test";
import assert from "node:assert/strict";
import { extractContext, extractTweetId, fxtwitterUrl, renderMarkdown } from "../bin/linklens.mjs";

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
