# Backlogger

Backlogger is a hosted backlog viewer.

## What it does

- shows the backlog as a flat, ordered list
- supports filter lenses like resource, concern, status, AI theme, and epic
- lets you select items and copy them for AI handoff
- shows item details beside the list

## How to use it

### Local dev

```bash
npm install
npm run dev
```

### Hosted mode

Run it through the host project that provides the backlog files, then open the configured `/backlogger/` route.

## Data model

Backlogger expects items to use:
- `summary` as the short primary label
- `description` for fuller detail
