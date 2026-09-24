# Studio image generation

Studio submits `POST /api/v3/generation/jobs` with the existing synthesis payload
and a stable `idempotency_key`. It receives HTTP 202 with `job_id`, `status`,
`result` and `error`. Poll `GET /api/v3/generation/jobs/{job_id}` until status is
`completed` or `failed`. Both endpoints require the current account; another
account receives 404 for the job.

The existing `POST /api/v3/generation/synthesize` remains compatible and waits
for the same job. A duplicate handled by another process can return
`GENERATION_IN_PROGRESS` with the job ID in error details.

## Persistence and retries

- Receipts use the existing `ai_jobs` table with task type `v3_generation`;
  no database migration is needed.
- Keys are scoped to the owner. A repeated key with different input returns 409.
  An identical request returns its existing receipt and does not call Gemini again.
- Each new job consumes the shared AI allowance of 10/minute and 100/day per
  account. Polling and receipt replay consume no additional AI allowance.
- The API process executes accepted jobs independently of HTTP disconnects.
  The legacy worker excludes these jobs. This is not a restartable job queue.
- A job has a 180-second processing deadline and a 240-second receipt lease.
  Shutdown or an expired lease reports interruption. Uncertain provider calls
  are never replayed automatically; a new attempt requires a new key.
- Storage SDK operations already running in a thread may finish after a timeout.
  Provider billing cannot be rolled back, and a process crash between storing
  media and saving its receipt can leave an unlinked asset.

The browser retains the accepted request/key and job ID in account-scoped
session storage, so reloading the same tab/outfit can resume polling. It stores
neither photo bytes nor signed image URLs there. Fetch a fresh media access URL
to retry image display without generating another image. A receipt survives on
the server even after the browser session closes, but there is currently no
cross-session generation history UI.

## Verification

Run `pytest tests/test_generation_jobs.py tests/test_v3_generation.py` and the
Studio Playwright tests. They use isolated data and mock provider/storage calls;
passing them does not establish available Gemini quota or generated image quality.
