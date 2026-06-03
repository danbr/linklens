---
name: linklens
description: "Fetch raw social links and turn them into operator-useful agent brief context."
---

# LinkLens

Use when a user drops a raw X/Twitter link or asks what to do with a social post.

## Workflow

1. Fetch the URL with `linklens <url>` or, for X/Twitter, fxtwitter directly.
2. Preserve the post, quoted post, article, and media context.
3. Separate signal from engagement bait.
4. Map the useful idea to the operator's current projects, constraints, and reusable workflows.
5. Call out risks or bad advice.
6. If the pattern has repeated 2-3 times, recommend or create a skill.

## Output

Keep Slack/chat responses short:

- Core idea
- Why it matters here
- Concrete action
- Skillify candidate, when relevant

Do not pretend a new or low-usage project has adoption. For grant/application links, verify the official source before recommending action.
