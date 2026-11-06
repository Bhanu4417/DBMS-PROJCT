# Presentation windows and SQL activity

- Helium: admin at http://localhost:3000 (isolated local browser profile).
- Chromium: student portal at the same URL (different profile, independent cookie).
- DBeaver: local presentation workspace and `Presentation_SQL_Log.sql` opened.

## DBeaver activity connection

Database type: SQLite. Database file: `<repository>/.presentation/sql-activity.sqlite`.
Select this connection for the opened SQL editor and execute `Presentation_SQL_Log.sql` with Ctrl+Enter. Re-execute to refresh the grid. If DBeaver requests its SQLite driver, allow the driver download.

```sql
SELECT * FROM recent_operations;
```

This is a **separate captured-log database**, not the college database. To inspect college records, add another SQLite connection pointing to `<repository>/web/lib/.data/campus.sqlite`; use read-only inspection during a demo.

The running `web/scripts/presentation-panels.mjs` helper polls the admin-only `/api/dbviewer` every second and mirrors its masked templates, request outcomes and timings into the capture database. It does not write to the academic database or execute arbitrary user SQL. Request UUID + event ID deduplicate observations. No parameters/password/session statements are copied. Browser profiles, session state and captured logs are gitignored under `.presentation/`.

**Not all historical operations can be recovered.** The source holds only the latest 200 in-memory events. Restart clears that source; a burst of over 200 events between captures may be missed. The local mirror retains successfully observed events until removed, but is not a durable production audit system. Snapshot reads may dominate it. Use the UI/API while the helper runs to generate further activity; re-run the DBeaver query to see updates.

## Restarting locally

Start `npm run dev`. Launch two dedicated browser profiles inside `.presentation/`, with Helium's remote-debugging port 9223 and Chromium's 9224, then run:

```sh
node web/scripts/presentation-panels.mjs
```

The helper signs in using the shipped demo accounts; do not use it on a public deployment. Remote debugging ports are intended for this local presentation only. Close the dedicated browsers and stop the helper when finished.

GUI status: browser sessions were verified authenticated via the application API. DBeaver launched and opened the SQL file; automatic GUI execution of its result grid was not verified. If it asks for connection selection, select the activity SQLite file and run the query manually.
