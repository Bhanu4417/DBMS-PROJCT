-- CampusOS captured application SQL events (redacted).
-- Run with Ctrl+Enter in the SQL activity SQLite connection.
-- Re-run to refresh; this is not a complete historical DB audit.
SELECT timestamp, method, path, role, request_success,
       duration_ms, rows_reported, sql_template, request_id
FROM recent_operations;
