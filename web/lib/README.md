# Local server API

Requires Node.js with built-in `node:sqlite` / `DatabaseSync` (verified on Node 26.8.1). No Python, PostgreSQL, or external database driver is used.

`app/api/[...path]/route.js` runs in the Node runtime and serves `/api/*`. `lib/api.mjs` exports `createService({ filename, seed })` and lazy singleton `dispatch(method, url, body)`. Dispatch is synchronous and returns `{ status, body, headers? }`. Tests use a dedicated temporary database below `web/tests` and remove it afterward.

The default disposable local file is `web/lib/.data/campus.sqlite` (plus SQLite WAL/SHM files). It is initialized and deterministically seeded only on first creation. Stop the server and remove `.data` to reset it. Keep this runtime directory out of version control/deployment artifacts. All database paths must resolve inside the workspace; outside paths and escaping symlinks are rejected.

The schema contains nine normalized tables, restrictive foreign keys, uniqueness/check constraints, and capacity triggers. Every mutation uses a synchronous `BEGIN IMMEDIATE` transaction. Capacity is checked for inserts, updates/reactivation/moves, and offering reductions. Deletes preserve dependent academic history.

Lists return `{ items, total, page, page_size, pages }` with search, resource filters, whitelisted sorting and pagination. Joined details, select options, dashboard, report catalog/groups/CSV, and health match the existing frontend contracts. CSV protects against spreadsheet formula injection.

Run from the workspace root:

```sh
node --test web/tests/api.test.mjs
```
