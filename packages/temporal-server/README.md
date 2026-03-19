# temporal-server

Workspace wrapper for running the local Temporal development server under the repo's root `bun dev` process graph.

## Environment

- Root `.env.local` is the authoritative env file for `bun dev` and the direct package `dev` script.
- `TEMPORAL_SERVER_IP` defaults to `127.0.0.1`
- `TEMPORAL_SERVER_PORT` defaults to `7233`
- `TEMPORAL_UI_PORT` defaults to `8233`
- `TEMPORAL_DB_FILENAME` defaults to `.temporal/dev.sqlite3`
- `TEMPORAL_HEADLESS=1` disables the Temporal Web UI
