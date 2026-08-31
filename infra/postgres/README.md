# PostgreSQL migrations

The numbered SQL files are forward-only bootstrap migrations for PostgreSQL 16.
Docker Compose mounts this directory into `docker-entrypoint-initdb.d`, so they
run in lexical order on a new database volume.

Runtime requests must set the tenant before querying tenant-owned tables:

```sql
BEGIN;
SET LOCAL app.tenant_id = '00000000-0000-0000-0000-000000000001';
-- tenant-scoped queries
COMMIT;
```

The `amazon_ai_app` role is intentionally `NOBYPASSRLS`. Migration and backup
jobs should use a separate administrative credential. Raw objects, provenance,
audit events, published home compositions, and approval events are append-only.

