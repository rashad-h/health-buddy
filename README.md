# Swipe-to-Ship

This repo is Swipe-to-Ship: a mobile web app for reviewing GitHub PRs as swipeable decision cards. Built for a hackathon demo.

The demo PR is the PR for branch `demo/security-hardening-fb6c` in this same repository.

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind
- framer-motion (swipe deck)
- mermaid (optional flow diagrams)
- OpenRouter (`deepseek/deepseek-v4-flash`) for card generation + voice rewrite
- Octokit for GitHub PR read + review comments only

## Safety

Reviews may only use GitHub events **COMMENT** or **REQUEST_CHANGES**. The app never merges, never pushes code, and never sends `APPROVE`.

## Setup

```bash
cp .env.example .env.local
# fill OPENROUTER_API_KEY, GITHUB_TOKEN, and GITHUB_PR_NUMBER
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Env

See `.env.example`. Required: `OPENROUTER_API_KEY`, `GITHUB_TOKEN`, and `GITHUB_PR_NUMBER`.
Defaults stay pointed at `rashad-h/health-buddy`. Token needs PR read/write + contents read.

## Scripts

- `npm run dev` — local server
- `npm run build` — production build
- `npm run start` — serve build
