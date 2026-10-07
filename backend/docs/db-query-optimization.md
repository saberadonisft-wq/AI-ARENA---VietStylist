# Targeted DB query optimization

This change removes the unconditional catalog join/distinct, adds indexes for AI history, article sources, occasion lookup and outfit cursors, and removes the duplicate outfit-version index. Existing PostgreSQL base-schema checksums stay unchanged.

The AI gallery uses `ai_media_library` for ordered pages and `ai_job_media` for the purposes of only the selected images. Migration backfills existing V3 receipts in batches of 500. Database triggers keep both tables in sync with receipt inserts, input/result changes and deletions, including writes from existing generation code. Images must belong to the job owner and have image type. Failed jobs still contribute valid input photos; missing, foreign and malformed references do not. Existing media status and preview/access authorization are preserved.

`GET /api/outfits/page?limit=30&cursor=...` returns `{items,next_cursor}`. Account cards, collection selection and the publisher load additional pages on request. The publisher separately fetches an explicitly selected initial outfit if it is outside the first page. `GET /api/outfits/{id}/versions` uses the same envelope and requires ownership. `GET /api/outfits/count` gives the stylist count without loading snapshots. The legacy array endpoint returns the latest 50 outfits; clients needing the full collection must use the page endpoint.

## Applying the migration

PostgreSQL migrations are `pg_004_query_indexes` and `pg_005_ai_media_library`. SQLite uses `015_query_indexes` and `016_ai_media_library`.

Use a backup of the selected database and a brief maintenance window for API/worker writes. Deploy the matching backend and frontend together with the migration; older readiness checks expect the previous migration set. From `backend`, with the intended database configuration:

```powershell
python scripts/migrate.py --dry-run
python scripts/migrate.py
python scripts/migrate.py --check
```

The PostgreSQL dry run rolls back all DDL/backfill; the real migration is one transaction. It does not seed, replace existing business rows, rewrite snapshots, or change R2 objects. Index creation is ordinary transactional DDL and can block writes during the maintenance window.

Afterwards check readiness, catalog filtering, gallery paging, outfit preview/open, and the next outfit page. Returning to older code requires the corresponding pre-migration database state; retaining the new code and rolling back the failed migration transaction is the preferred recovery before reopening traffic.

Local verification covers focused repository/API/migration tests, PostgreSQL fresh-schema and old-schema upgrade probes in rollback-only schemas, TypeScript and two browser pagination flows. These checks do not establish production latency or a completed production migration.
