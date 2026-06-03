#!/usr/bin/env node

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

function usage() {
  return `Usage:
  linklens <x.com status url> [--json]

Examples:
  linklens https://x.com/openai/status/123
  linklens https://x.com/openai/status/123 --json`;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h") || args.length === 0) {
    console.log(usage());
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
