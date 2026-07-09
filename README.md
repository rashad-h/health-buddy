# Swipe-to-Ship

**Code review, rebuilt for a phone.**

Open a pull request. Get a stack of decision cards — plain English, risk, a tiny code proof, and a flow diagram when it matters. Swipe right to ship. Swipe left to hold and speak your objection. One tap posts a real GitHub review.

**Live demo →** [open the app](https://health-buddy-taupe.vercel.app)

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
