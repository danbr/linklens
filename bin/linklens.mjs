#!/usr/bin/env node

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { inspect } from "node:util";

export function extractTweetId(input) {
  const text = String(input || "").trim();
  const match = text.match(/(?:x|twitter)\.com\/([^/\s?]+)\/status\/(\d+)/i);
  if (!match) return null;
  return { username: match[1], id: match[2] };
}

export function fxtwitterUrl(input) {
  const parsed = extractTweetId(input);
  if (!parsed) {
    throw new Error("Expected an x.com or twitter.com status URL.");
  }
  return `https://api.fxtwitter.com/${parsed.username}/status/${parsed.id}`;
}

export async function fetchTweet(input, fetchImpl = fetch) {
  const res = await fetchImpl(fxtwitterUrl(input), {
    headers: { accept: "application/json" }
  });
  if (!res.ok) throw new Error(`fxtwitter request failed: ${res.status}`);

  const payload = await res.json();
  if (payload.code !== 200 || !payload.tweet) {
    throw new Error(payload.message || "No tweet returned.");
  }
  return payload.tweet;
}

function blocksToText(blocks = []) {
  return blocks
    .map((block) => String(block.text || "").trim())
    .filter(Boolean)
    .join("\n\n");
}

export function extractContext(tweet) {
  const quote = tweet.quote || null;
  const article = quote?.article || tweet.article || null;
  const media = tweet.media?.all || tweet.media?.photos || tweet.media?.videos || [];

  return {
    sourceUrl: tweet.url,
    author: {
      name: tweet.author?.name || null,
      handle: tweet.author?.screen_name || null,
      followers: tweet.author?.followers || null
    },
    createdAt: tweet.created_at || null,
    text: tweet.text || "",
    metrics: {
      replies: tweet.replies || 0,
      reposts: tweet.retweets || 0,
      likes: tweet.likes || 0,
      bookmarks: tweet.bookmarks || 0,
      views: tweet.views || 0
    },
    quote: quote
      ? {
          sourceUrl: quote.url,
          author: quote.author?.screen_name || null,
          text: quote.text || "",
          articleTitle: quote.article?.title || null,
          articlePreview: quote.article?.preview_text || null,
          articleText: blocksToText(quote.article?.content?.blocks)
        }
      : null,
    article: article
      ? {
          title: article.title || null,
          preview: article.preview_text || null,
          text: blocksToText(article.content?.blocks)
        }
      : null,
    media: media.map((item) => ({
      type: item.type,
      url: item.url || item.thumbnail_url || item.media_info?.original_img_url || null
    }))
  };
}

export function renderMarkdown(context) {
  const lines = [];
  lines.push("# LinkLens context pack");
  lines.push("");
  lines.push(`Source: ${context.sourceUrl}`);
  if (context.author.handle) {
    lines.push(`Author: ${context.author.name || context.author.handle} (@${context.author.handle})`);
  }
  if (context.createdAt) lines.push(`Created: ${context.createdAt}`);
  lines.push("");
  lines.push("## Original post");
  lines.push(context.text || "(empty)");
  lines.push("");

  if (context.quote) {
    lines.push("## Quoted context");
    lines.push(`Source: ${context.quote.sourceUrl}`);
    if (context.quote.author) lines.push(`Author: @${context.quote.author}`);
    if (context.quote.text) lines.push(context.quote.text);
    if (context.quote.articleTitle) lines.push(`Article: ${context.quote.articleTitle}`);
    if (context.quote.articlePreview) lines.push(context.quote.articlePreview);
    if (context.quote.articleText) {
      lines.push("");
      lines.push(context.quote.articleText);
    }
    lines.push("");
  }

  if (context.article && !context.quote?.articleText) {
    lines.push("## Article context");
    if (context.article.title) lines.push(`Article: ${context.article.title}`);
    if (context.article.preview) lines.push(context.article.preview);
    if (context.article.text) {
      lines.push("");
      lines.push(context.article.text);
    }
    lines.push("");
  }

  lines.push("## Agent brief prompt");
  lines.push("Extract the core idea, discard engagement bait, and map the useful part to concrete actions for the operator. Include risks, next steps, and whether this should become a reusable skill.");
  return `${lines.join("\n").trim()}\n`;
}

function stableTags(text) {
  const lower = String(text || "").toLowerCase();
  const tagRules = [
    ["ai", /\b(ai|agent|llm|claude|codex|openai|prompt)\b/],
    ["apps", /\b(app|apps|ios|iphone|app store|mobile)\b/],
    ["growth", /\b(growth|marketing|viral|creator|content|ugc|ads?)\b/],
    ["pricing", /\b(pric(?:e|ing)|monetiz|subscription|revenue|paid)\b/],
    ["product", /\b(product|feature|mvp|prototype|design|ux)\b/],
    ["ops", /\b(workflow|system|process|automation|pipeline|ops)\b/]
  ];

  const tags = tagRules.filter(([, pattern]) => pattern.test(lower)).map(([tag]) => tag);
  return tags.length ? tags : ["inbox"];
}

function slugify(input, fallback = "bookmark") {
  const slug = String(input || "")
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || fallback;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (quoted && char === '"' && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (!quoted && char === ",") {
      row.push(cell);
      cell = "";
    } else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  if (rows.length < 2) return [];

  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]))
  );
}

function parseJsonish(text) {
  const parsed = JSON.parse(text);
  if (Array.isArray(parsed)) return parsed;
  for (const key of ["bookmarks", "tweets", "items", "data"]) {
    if (Array.isArray(parsed?.[key])) return parsed[key];
  }
  return [parsed];
}

export function parseBookmarkExport(text, filename = "bookmarks.json") {
  const trimmed = String(text || "").trim();
  if (!trimmed) return [];

  if (filename.endsWith(".jsonl")) {
    return trimmed
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  }
  if (filename.endsWith(".csv")) return parseCsv(trimmed);
  return parseJsonish(trimmed);
}

function pick(record, keys) {
  for (const key of keys) {
    const value = record?.[key];
    if (value !== undefined && value !== null && String(value).trim()) return value;
  }
  return "";
}

export function normalizeBookmark(record) {
  const sourceUrl = pick(record, ["url", "tweet_url", "tweetUrl", "link", "href", "sourceUrl"]);
  const text = pick(record, ["text", "full_text", "fullText", "tweet", "content", "body"]);
  const authorHandle = pick(record, ["author_handle", "authorHandle", "screen_name", "username", "handle"]);
  const authorName = pick(record, ["author_name", "authorName", "name", "author"]);
  const createdAt = pick(record, ["created_at", "createdAt", "date", "time", "timestamp"]);
  const tags = pick(record, ["tags", "tag", "topics"]);
  const metrics = {
    likes: Number(pick(record, ["likes", "favorite_count", "favoriteCount"]) || 0),
    reposts: Number(pick(record, ["retweets", "reposts", "retweet_count", "retweetCount"]) || 0),
    bookmarks: Number(pick(record, ["bookmarks", "bookmark_count", "bookmarkCount"]) || 0),
    views: Number(pick(record, ["views", "view_count", "viewCount"]) || 0)
  };

  return {
    sourceUrl,
    text,
    author: {
      name: authorName || null,
      handle: String(authorHandle || "").replace(/^@/, "") || null
    },
    createdAt: createdAt || null,
    tags: Array.isArray(tags) ? tags : String(tags || "").split(/[,\s]+/).filter(Boolean),
    metrics
  };
}

export function renderBookmarkNote(bookmark) {
  const tags = [...new Set([...(bookmark.tags || []), ...stableTags(bookmark.text)])];
  const lines = [];
  lines.push("---");
  lines.push(`source: ${bookmark.sourceUrl || ""}`);
  if (bookmark.author.handle) lines.push(`author: ${bookmark.author.name || bookmark.author.handle}`);
  if (bookmark.createdAt) lines.push(`created: ${bookmark.createdAt}`);
  lines.push(`tags: ${tags.map((tag) => `bookmark/${tag}`).join(", ")}`);
  lines.push("---");
  lines.push("");
  lines.push(`# ${bookmark.author.handle ? `@${bookmark.author.handle}` : "X bookmark"}`);
  lines.push("");
  if (bookmark.sourceUrl) lines.push(`Source: ${bookmark.sourceUrl}`);
  if (bookmark.author.handle) {
    const displayName = bookmark.author.name
      ? `${bookmark.author.name} (@${bookmark.author.handle})`
      : `@${bookmark.author.handle}`;
    lines.push(`Author: ${displayName}`);
  }
  lines.push("");
  lines.push("## Saved Post");
  lines.push(bookmark.text || "(empty)");
  lines.push("");
  lines.push("## Metadata");
  lines.push(`Likes: ${bookmark.metrics.likes || 0}`);
  lines.push(`Reposts: ${bookmark.metrics.reposts || 0}`);
  lines.push(`Bookmarks: ${bookmark.metrics.bookmarks || 0}`);
  lines.push(`Views: ${bookmark.metrics.views || 0}`);
  lines.push("");
  lines.push("## Agent Prompt");
  lines.push("Decide whether this bookmark contains a product hypothesis, growth tactic, workflow improvement, or reject reason. Map anything useful to App Factory, OpenClaw/Hedy, iOS growth, or the content engine.");
  return `${lines.join("\n").trim()}\n`;
}

export async function importBookmarks(inputFile, outDir) {
  const text = await readFile(inputFile, "utf8");
  const records = parseBookmarkExport(text, path.basename(inputFile));
  await mkdir(outDir, { recursive: true });

  const written = [];
  const seen = new Set();
  for (const record of records) {
    const bookmark = normalizeBookmark(record);
    if (!bookmark.sourceUrl && !bookmark.text) continue;

    const base = slugify(bookmark.sourceUrl || bookmark.text);
    const filename = `${base}${seen.has(base) ? `-${seen.size + 1}` : ""}.md`;
    seen.add(base);
    const filePath = path.join(outDir, filename);
    await writeFile(filePath, renderBookmarkNote(bookmark), "utf8");
    written.push(filePath);
  }

  return written;
}

export const requiredAdrFiles = [
  "000-index.md",
  "001-fxtwitter-for-x-fetch.md",
  "002-preserve-raw-context.md",
  "003-cli-json-first.md",
  "004-no-fake-adoption-claims.md"
];

const fakeAdoptionPatterns = [
  /\btrusted by\b/i,
  /\bused by thousands\b/i,
  /\b\d+[km]?\+?\s+(?:users|customers|teams|companies|maintainers)\b/i,
  /\bwidely adopted\b/i,
  /\bproven at scale\b/i
];

export async function checkAdrs(repoRoot = process.cwd()) {
  const adrDir = path.join(repoRoot, "docs", "adr");
  const errors = [];

  for (const filename of requiredAdrFiles) {
    const filePath = path.join(adrDir, filename);
    try {
      const text = await readFile(filePath, "utf8");
      if (!/^Status:\s+Accepted/m.test(text) && filename !== "000-index.md") {
        errors.push(`${filePath}: missing "Status: Accepted"`);
      }
      if (!/## Enforcement/.test(text) && filename !== "000-index.md") {
        errors.push(`${filePath}: missing enforcement section`);
      }
    } catch {
      errors.push(`${filePath}: missing required ADR`);
    }
  }

  for (const relativePath of ["README.md", "APPLICATION.md", "skill/SKILL.md"]) {
    const filePath = path.join(repoRoot, relativePath);
    try {
      await access(filePath);
      const text = await readFile(filePath, "utf8");
      for (const pattern of fakeAdoptionPatterns) {
        if (pattern.test(text)) {
          errors.push(`${filePath}: possible unsupported adoption claim: ${pattern}`);
        }
      }
    } catch {
      // Optional positioning files should not make the ADR check fail.
    }
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

function usage() {
  return `Usage:
  linklens <x.com status url> [--json]
  linklens bookmarks <export-file> --out <notes-folder>
  linklens adr-check

Examples:
  linklens https://x.com/openai/status/123
  linklens https://x.com/openai/status/123 --json
  linklens bookmarks ./bookmarks.json --out ./bookmark-brain
  linklens adr-check`;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h") || args.length === 0) {
    console.log(usage());
    return;
  }

  if (args[0] === "bookmarks") {
    const inputFile = args[1];
    const outIndex = args.indexOf("--out");
    const outDir = outIndex >= 0 ? args[outIndex + 1] : null;
    if (!inputFile || !outDir) throw new Error("Expected: linklens bookmarks <export-file> --out <notes-folder>");
    const written = await importBookmarks(inputFile, outDir);
    console.log(`Wrote ${written.length} bookmark notes to ${outDir}`);
    return;
  }

  if (args[0] === "adr-check") {
    const result = await checkAdrs();
    if (!result.ok) {
      for (const error of result.errors) console.error(error);
      process.exitCode = 1;
      return;
    }
    console.log(`ADR check passed (${requiredAdrFiles.length} required files)`);
    return;
  }

  const asJson = args.includes("--json");
  const url = args.find((arg) => !arg.startsWith("-"));
  const tweet = await fetchTweet(url);
  const context = extractContext(tweet);
  process.stdout.write(asJson ? `${JSON.stringify(context, null, 2)}\n` : renderMarkdown(context));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error?.stack || inspect(error));
    process.exit(1);
  });
}
