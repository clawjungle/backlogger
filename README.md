# Backlogger

Backlogger is a hosted backlog viewer for the Jobcards project.

It reads these host-owned files from `jobcards`:
- `BACKLOG.yaml`
- `HISTORY.yaml`
- `DOMAIN.yaml`

## What it does

- shows the backlog as a flat, ordered list
- supports filter lenses like resource, concern, status, AI theme, and epic
- lets you select items and copy them for AI handoff
- shows item details beside the list
- runs under `/backlogger/` when hosted by `jobcards`

## How to use it

### Local dev

From this repo:

```bash
npm install
npm run dev
```

### Hosted mode

From `jobcards`:

```bash
./dev.sh start backlogger
```

Then open:
- `https://dev.ponelat.com/backlogger/`

## Config

Hosted mode reads its file paths from `jobcards/backlogger.config.json`.

The app expects `summary` as the short primary label and `description` for fuller detail.
