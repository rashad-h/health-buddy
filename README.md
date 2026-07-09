# Swipe-to-Ship

Mobile web app for reviewing GitHub PRs as swipeable decision cards. Built for a hackathon demo.

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
# fill OPENROUTER_API_KEY, GITHUB_TOKEN, GITHUB_PR_NUMBER
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Env

See `.env.example`. Token needs PR read/write + contents read.

## Scripts

- `npm run dev` — local server
- `npm run build` — production build
- `npm run start` — serve build
