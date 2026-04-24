# AI Story Copilot Agents Guide

## Product Frame
- This repo is a monorepo. Keep frontend and backend ready to evolve together; do not reshape it into a frontend-only layout.
- The core business unit is `Story Beat` / “故事节拍”. Do not use “paragraph” for this concept in code or docs.
- Mobile portrait is the primary target. Desktop should remain readable, but mobile interaction quality comes first.

## Structure
- `apps/web`: current H5 web app.
- `apps/api`: reserved for future Node.js or serverless backend work.
- `packages/shared`: reserved for shared types, utilities, and business logic.
- `prompts/*.txt`: long prompt templates that are expected to change often.
- `docs/`: architecture and product notes.

## LLM Rules
- Use OpenRouter from the web app for the first version.
- Settings store the OpenRouter API key and model choice in browser local storage.
- Keep prompt engineering editable through plain text files under `prompts/`.
- A single generation should return one new `Story Beat`, two short next-step synopsis suggestions, and an updated rolling summary.

## UX Rules
- Story reading is a vertical timeline.
- The connector action between beats is the “overflow menu button”.
- Rollback keeps alternate branches instead of deleting them.
- Suggestion selection must be a two-step flow: choose first, confirm second.

## Implementation Defaults
- Prefer plain JavaScript modules unless the user explicitly asks to lock in a frontend framework.
- Keep the LLM service boundary isolated so the app can switch from direct OpenRouter calls to a backend proxy later.
- Persist settings and story data separately so story data can be cleared without losing API settings.

