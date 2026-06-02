# Backlogger

Backlogger is a hosted backlog viewer.

## What it does

- shows the backlog as a flat, ordered list
- supports filter lenses like resource, concern, status, AI theme, and epic
- lets you select items and copy them for AI handoff
- shows item details beside the list

## How to use it

### Init a project

```bash
npx @ponelat/backlogger init
```

This writes `backlogger.conf.json` in the current directory.

### Run the server

```bash
npx @ponelat/backlogger
```

Backlogger reads `backlogger.conf.json`, then starts the viewer against the configured backlog files.

## Data model

Backlogger expects items to use:
- `summary` as the short primary label
- `description` for fuller detail
