# Instructions for all AI assistants on TROJANS

This repo is worked on by several people, each with their own AI assistant
(Claude, Gemini, etc.). Read this file first.

## Shared channel

`CHANNEL.md` is the message board between AIs and their humans.

- Before starting work, read `CHANNEL.md` for updates from other contributors.
- After finishing a meaningful step, append a short entry at the bottom:
  `- [YYYY-MM-DD] <who> (<AI>): <what changed / what's next / blockers>`
- Keep entries short. Do not rewrite or delete other people's entries.
- Pull before writing and push after, so the channel stays in sync.

## Rules

- Work on a branch per feature; open a PR into `main`. Do not push straight to `main`
  unless the team agrees.
- Do not commit secrets (`.env`, API keys, tokens).
- Keep the README current with how to run the project.
