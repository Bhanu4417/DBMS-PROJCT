# Architecture and DBMS-to-code mapping

## New local stack versus original

| Concern | New local direction / inspected code | Original design |
| --- | --- | --- |
| Web layer | Next.js UI and Node-runtime API route architecture | Separate frontend/backend described by existing project docs |
| Server data layer | Node.js built-in `node:sqlite`, DatabaseSync in `web/lib/api.mjs` | PostgreSQL DDL in `database/schema.sql` |
| Storage | Disposable **persisted file**, `web/lib/.data/campus.sqlite`, plus WAL/SHM | Client/server PostgreSQL database |
| Concurrency | `BEGIN IMMEDIATE`, one SQLite writer; WAL supports concurrent readers | PostgreSQL row locking with `SELECT ... FOR UPDATE` in capacity trigger |
| Reusable queries | `web/lib/queries.mjs` and reports module | SQL views in original DDL |

The inspected snapshot contains the local data layer, but no completed Next.js route/UI files in `web/app`. Next.js is the new architectural target, not a verified running deployment. **No PostgreSQL server is asserted to be running or used by the new version.**

“Temporary” means local/disposable lifecycle, not in-memory storage: commits survive process restarts while the file remains. Initialization and seeding happen on first creation; deleting the file after stopping the service resets it. This is not durable production hosting: ephemeral/serverless filesystems can discard it, and multiple instances do not share one local file.

## Why these choices rather than alternatives?

- Next.js combines UI and server routes in one project; a separate API service offers independent scaling but adds deployment coordination. Database code belongs in the Node server runtime, never a browser bundle or Edge runtime.
- SQLite removes the need to provision a server for a local demonstration; PostgreSQL is preferable for many concurrent writers, distributed access and stronger native typing. SQLite is still a DBMS, not a JSON-file substitute.
- `DatabaseSync` makes short local transactions straightforward; synchronous queries block the Node event loop, so this is not a claim of high-throughput architecture.
- Nine normalized tables avoid copied course/student facts. One giant sheet simplifies initial viewing but creates update, insert and delete anomalies. Joins recover readable reports.
- Surrogate IDs keep FKs short and stable. Natural/composite UNIQUE keys still enforce real identities; a surrogate alone does not prevent duplicate registrations.
- Association tables support team teaching and many enrollments. A single faculty_id on an offering would disallow team teaching; comma-separated IDs would lose relational integrity.
- Restrictive deletion protects academic history; cascading deletion could erase grades silently. Status changes such as Inactive or Dropped retain history.

## DBMS concept → code responsibility

| Topic | Concrete mapping / rationale |
| --- | --- |
| Data and DBMS | Student/course facts are data; SQLite manages storage, querying, transactions and constraints |
| Schema / instance | `web/lib/schema.mjs` defines structure; current rows are an instance, changed by DML |
| Three-schema architecture | UI/reports are external views; nine-table model is conceptual; file, indexes and WAL are internal storage |
| DDL | CREATE TABLE, UNIQUE, CHECK and CREATE INDEX declare invariant structure |
| DML | Prepared INSERT/UPDATE/DELETE in `api.mjs`; bound parameters separate values from SQL |
| Selection / projection | WHERE chooses rows; SELECT columns chooses attributes; SQL needs DISTINCT to mimic set projection's duplicate removal |
| Joins | Enrollment joins student and offering; LEFT JOIN preserves optional department or missing grade |
| Grouping / aggregates | GROUP BY collects offerings; COUNT/SUM/AVG summarize rows |
| HAVING / ORDER BY | HAVING filters groups after aggregation; ORDER BY controls presentation, not identity |
| Subquery | EXISTS tests dependent rows without multiplying parents; useful for safe reporting/deletion checks |
| Views | Original SQL views name reusable joins; new query strings serve similar reuse but are not claimed to be installed database views |
| Indexes | PK/UNIQUE indexes protect identity; FK/filter indexes speed reads at storage and write cost |
| Integrity | NOT NULL, FK, UNIQUE and CHECK defend the database even if UI validation is bypassed |
| Transactions | `transaction()` wraps each mutation in BEGIN IMMEDIATE / COMMIT, with ROLLBACK on failure |
| Concurrency / locks | Acquire the SQLite write transaction before count-and-insert; capacity triggers reject overflow and invalid reductions |
| Referential deletion | Every FK uses ON DELETE RESTRICT and ON UPDATE CASCADE; SQLite connection enables PRAGMA foreign_keys=ON |

## SQL examples (same relational model)

```sql
-- Selection, projection, join, ordering; unassigned students remain visible.
SELECT s.enrollment_number, d.department_code
FROM student s LEFT JOIN department d ON d.department_id = s.department_id
WHERE s.status = 'Active'
ORDER BY s.enrollment_number;

-- Count actual children, not the NULL-extended LEFT JOIN row.
SELECT o.offering_id, COUNT(e.enrollment_id) AS enrolled
FROM course_offering o
LEFT JOIN enrollment e ON e.offering_id = o.offering_id
 AND e.enrollment_status <> 'Dropped'
GROUP BY o.offering_id
HAVING COUNT(e.enrollment_id) >= 1
ORDER BY enrolled DESC, o.offering_id;

-- Subquery: courses that have never been offered.
SELECT c.course_code FROM course c
WHERE NOT EXISTS (
  SELECT 1 FROM course_offering o WHERE o.course_id = c.course_id
);
```

ACID: atomicity rolls back a failed mutation; consistency relies on constraints/triggers; isolation uses SQLite's transaction/locking rules; durability comes from committed file/journal storage subject to storage guarantees. WAL does not create multiple concurrent writers. A busy writer may time out (`busy_timeout=5000`) and the API can return 503 for retry. The original PostgreSQL row-lock implementation is a different mechanism; it is not copied literally into SQLite.

SQLite caveats: VARCHAR(n) does not itself enforce n; this service checks lengths in validation. Regex CHECKs rely on the connection's registered `regexp` function. SQLite REAL marks differ from PostgreSQL NUMERIC(5,2); do not promise fixed two-decimal storage. Application validation can be stricter than DDL (capacity 1–500 versus database capacity > 0).
