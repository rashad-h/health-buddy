# Swipe-to-Ship

**Code review, rebuilt for a phone.**

**Live demo →** [open the app](https://health-buddy-taupe.vercel.app)

---

## Summary

Swipe-to-Ship turns a GitHub pull request into **high-level decision cards** you can review on your phone — small visual chunks instead of an endless diff.

Each card explains one meaningful change in plain English, with risk, a tiny code proof (≤6 lines), and a Mermaid flow diagram when the path changes. Trivial noise (renames, formatting, lockfiles) collapses into a single housekeeping card.

Swipe **right to ship**, **left to hold**. On hold, speak your objection — voice becomes a polished review comment. When the deck is done, one tap posts a real GitHub review (`COMMENT` or `REQUEST_CHANGES`). The app never merges, never approves, and never changes code.

Built for remote / on-the-go review: judgment first, laptop optional.

---

## Why it exists

PR review on mobile is broken: tiny diffs, no context, no judgment. Swipe-to-Ship turns a diff into **decisions**, not files — so you can review like a principal engineer from your pocket.

## Demo flow

1. Pick a PR from the deck list  
2. Swipe through 3–6 decision cards (+ one housekeeping card for the noise)  
3. Hold one with voice → AI polishes it into a review comment  
4. Submit → real `COMMENT` or `REQUEST_CHANGES` on GitHub  

No merge. No approve. No code changes from the app — comments only.

## What makes a card

| Piece | Purpose |
| --- | --- |
| Plain-English title + summary | The *decision*, not the filename |
| Why it matters + risk | Consequence, not churn |
| Key change (≤6 lines) | Proof of the point |
| Mermaid flow | Before → after when the path changes |

Trivial renames, formatting, and lockfile noise collapse into a single housekeeping card.

## Stack

Next.js · TypeScript · Tailwind · framer-motion · Mermaid · OpenRouter (`deepseek/deepseek-v4-flash`) · GitHub REST (Octokit) · Web Speech API

## Safety

Hard-locked to review events **`COMMENT`** and **`REQUEST_CHANGES`**. The app cannot merge, push, or send `APPROVE`.

## Run it

```bash
cp .env.example .env.local
# OPENROUTER_API_KEY + GITHUB_TOKEN (PR read/write, contents read)
npm install && npm run dev
```

Built for a hackathon. Bias: **demo works flawlessly on a phone.**
