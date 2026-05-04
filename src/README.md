# LLM Benchmark - Developer Setup

Results dashboard and benchmark runner for evaluating LLM SQL generation against Tinybird.

Live at: https://llm-benchmark.tinybird.live/

## Quick start

```bash
npm install
cp .env.example .env
# Fill in the values (see below)
npm run dev
```

Open http://localhost:3000 to see the results dashboard.

## Environment variables

Copy `.env.example` to `.env` and fill in the values.

**For the web app** (`npm run dev`): No additional env vars needed beyond what Vercel provides (OTel config).

**For the benchmark** (`npm run benchmark`): You need `OPENROUTER_API_KEY` and the two Tinybird vars (`TINYBIRD_API_HOST`, `TINYBIRD_WORKSPACE_TOKEN`). See `.env.example`.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Next.js dev server (Turbopack) |
| `npm run benchmark` | Run benchmark for all configured models |
| `npm run benchmark -- --model=provider/model` | Run benchmark for a single model |
| `npm run benchmark -- --model=provider/model --debug` | Single model with verbose logging |
| `npm run fetch-models` | Fetch available models from OpenRouter API |
| `npm run check-new-models` | Check for new models locally (no API call) |
| `npm run manage-failed-models` | CLI to list/add/remove failed models |
| `npm run backfill-metadata` | Backfill model metadata (created date, name) from OpenRouter |
| `npm run merge-pr-results` | Merge results from open benchmark PRs into main (one-time) |
| `npm run build` | Production build |
| `npm run start` | Start production server |

## Project structure

```
src/
  benchmark/          Benchmark runner, OpenRouter client, results
  src/app/            Next.js App Router (dashboard UI)
  src/components/     React components (table, filters, code preview)
  src/lib/            Data loading hooks and utilities
  tinybird/           Tinybird datasources and endpoint definitions
  benchmark-config.json   Models to benchmark (by provider)
  failed-models.json      Models that failed benchmarking
  untested-models.json    Models discovered but not yet tested
  model-metadata.json     Per-model metadata (created date, display name)
```

## How the auto-discovery pipeline works

1. **Auto-discover** (`.github/workflows/auto-discover-models.yml`): Runs daily at 08:17 UTC. Fetches all models from OpenRouter, compares against tested/untested/failed lists, triggers `benchmark-append` for up to 5 new models per run (60s delay between).

2. **Benchmark-append** (`.github/workflows/benchmark-append.yml`): Benchmarks a single model (50 SQL questions against Tinybird). On success, creates a PR with results and an LLM-generated review comment. Auto-merges if the review is positive. On failure, adds the model to `failed-models.json`.

3. **Model tracking files**:
   - `benchmark-config.json`: Models that have been successfully benchmarked
   - `untested-models.json`: Models known but not yet tested (refreshed on each discovery run)
   - `failed-models.json`: Models that failed benchmarking (excluded from future runs)
   - `model-metadata.json`: Created timestamps and display names from OpenRouter

## GitHub repo variables

These are set in GitHub Settings > Variables and used by the workflows. Forks can configure their own values. See `.env.example` for reference.

| Variable | Default | Purpose |
|---|---|---|
| `PR_ASSIGNEES` | *(none)* | Comma-separated GitHub usernames to assign benchmark PRs |
| `REVIEW_MODEL` | `openai/gpt-5.4-nano` | OpenRouter model ID used for LLM review of benchmark results |
| `AUTO_MERGE` | `true` | Set to `false` to disable auto-merge on positive review |

## Tech stack

- Next.js 15 + React 19 + Tailwind CSS 4
- Vercel AI SDK + OpenRouter provider (all LLM calls go through OpenRouter)
- Tinybird for SQL execution and results storage
