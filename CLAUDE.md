# AI Debates — developer guide

Full-stack app that orchestrates structured debates between LLMs via OpenRouter and streams
them to the browser in real time.

## Layout

```
backend/            FastAPI API + RQ worker (Python 3.12+, managed with uv)
  app/main.py         FastAPI app, middleware, admin panel, /api/health
  app/worker.py       RQ worker entrypoint (`python -m app.worker`)
  app/core/           config (pydantic-settings), db (async SQLAlchemy), redis, logging, ratelimit
  app/api/            routers: debates, models, presets, stream (SSE)
  app/services/       orchestrator (RQ jobs), scheduler (turn order), prompt_builder,
                      openrouter_client, events (pub/sub), queue_manager
  app/services/media/ audio pipeline: script (markdown→speech), tts/ (elevenlabs, edge),
                      ffmpeg, highlights (LLM picks shorts), jobs (build_media_job), timeline
  app/schemas/timeline.py  Timeline contract shared with frontend/src/api/timeline.ts
  app/models/         SQLAlchemy ORM models
  app/schemas/        Pydantic request/response schemas
  migrations/         Alembic (async env)
  tests/              pytest (pure unit tests, no DB/Redis needed)
frontend/           React 19 + Vite 8 + Tailwind 4 + TypeScript
  src/api/            axios client, typed API functions, shared types
  src/hooks/          useDebateStream (SSE), useSpeech (browser TTS), useDebateMedia (polling)
  src/components/     TurnBubble, ParticipantsBar, StatusBadge, RoundDivider,
                      MediaPanel (audio + video UI), RenderPanel (browser MP4 export)
  src/video/          Remotion compositions (DebateLong 16:9, DebateShort 9:16) + render.ts
  src/pages/          DebateHistory (/), CreateDebate (/create), DebateLive (/debate/:id)
docker-compose.yml  full stack; docker-compose.dev.yml = only Postgres + Redis for native dev
```

## Commands

Backend (run from `backend/`):

```bash
uv sync                                   # create .venv and install (incl. dev tools)
uv run uvicorn app.main:app --reload      # API on :8000 (docs at /api/docs)
RQ_SIMPLE_WORKER=true uv run python -m app.worker   # worker for both queues (SimpleWorker avoids fork issues on macOS)
uv run python -m app.worker --queues media          # media-only worker (needs ffmpeg on PATH)
uv run alembic upgrade head               # apply migrations
uv run alembic revision --autogenerate -m "describe change"
uv run ruff check . && uv run ruff format .   # lint + format
uv run pyright                            # type check
uv run pytest -q                          # tests
```

Frontend (run from `frontend/`):

```bash
npm install
npm run dev        # Vite on :5173, proxies /api -> http://localhost:8000 (incl. SSE)
npm run check      # tsc + eslint
npm run build
```

Infrastructure:

```bash
docker compose -f docker-compose.dev.yml up -d   # Postgres :5432 + Redis :6379 for native dev
docker compose up -d --build                     # full stack on http://localhost (migrations auto-run)
./deploy.sh                                      # production (adds docker-compose.prod.yml)
```

## Architecture and data flow

1. `POST /api/debates` validates `DebateConfig`, stores the debate (`status=queued`), stores an
   optional user OpenRouter key in Redis (`debate:{id}:provider_key`, TTL) — never in Postgres —
   and enqueues `start_debate_job`.
2. The worker chains RQ jobs: `start_debate_job` → `process_turn_job(seq_index)` per turn →
   `conduct_verdict_job` → `finish_debate_job`. Each job opens its own blocking DB session
   (`NullPool`, safe across RQ forks).
3. `scheduler.build_schedule()` is the single source of truth for turn order:
   each round = moderator (intro / transition) + every debater; debater turn types are
   `opening` / `rebuttal` / `closing` (or `argument` for single-round debates). The verdict
   (`turn_type=verdict`, `round_id=verdict`) is appended after the last scheduled turn.
4. `openrouter_client.stream_chat_completion()` streams deltas and returns usage
   (tokens + cost). On HTTP 400 with a system prompt it retries once with the system prompt
   merged into the user message. Mid-stream `{"error": ...}` chunks raise `OpenRouterError`.
5. The worker publishes events to Redis channel `debate:{id}`; `GET /api/debates/{id}/stream`
   relays them as SSE and closes on a terminal event (or immediately if the debate is already
   finished).

SSE events: `connected`, `debate_started`, `turn_started`, `turn_delta`, `turn_completed`,
`turn_error`, `debate_completed`, `debate_error`, `debate_stopped`.
`turn_completed` / `turn_error` carry the full serialized turn (same shape as `TurnOut`).

Debate statuses: `queued | running | completed | error | stopped`.
Stopping: `POST /api/debates/{id}/stop` sets the status, sets `debate:{id}:stop` in Redis
(checked by the worker every few chunks) and publishes `debate_stopped`.

### Media pipeline (audio on the server, video in the browser)

6. `POST /api/debates/{id}/media` (finished debates only) stores the chosen TTS options in
   `debates.media_json`, sets `media_status=queued` and enqueues `build_media_job` on the
   `media` RQ queue (`MEDIA_JOB_TIMEOUT`). An optional user ElevenLabs key goes to Redis
   (`debate:{id}:tts_key`), never to Postgres. ElevenLabs builds on the system key are
   rate-limited per IP per day (`MEDIA_CREATE_RATE_LIMIT`; admin session or `X-Media-Token` bypass).
7. The job cleans each turn's Markdown (`media/script.py`), synthesizes it with the provider
   (`elevenlabs` with word timestamps / forced-alignment fallback, or the free `edge` voices),
   normalizes loudness with ffmpeg, caches per-turn WAV+JSON by content hash under
   `MEDIA_ROOT/{debate_id}/turns/`, mixes `full.wav`/`full.mp3`, asks a cheap LLM for
   short-video highlights and writes `timeline.json` (`app/schemas/timeline.py`).
   Progress lives in `media_json` (polled by `GET /api/debates/{id}/media`); `media_status`
   is `none | queued | running | ready | error`.
8. Files are served by `MediaStaticFiles` at `/api/media/files/{debate_id}/...` (Range
   requests work). The frontend `MediaPanel` plays the track with karaoke words and renders
   MP4s **in the visitor's browser** via `@remotion/web-renderer` — the server never encodes video.
   `output_style=spoken` in `DebateConfig` asks the models for plain spoken prose with
   optional `[emotion]` tags, which ElevenLabs v3 understands.

## Conventions

- Python: ruff (line length 100, isort), pyright `standard`, type hints everywhere,
  `logging` instead of `print`. Keep worker code synchronous except the streaming loop.
- Schema changes: edit `app/models/models.py`, then `uv run alembic revision --autogenerate`.
  Timestamps are timezone-aware (`DateTime(timezone=True)`, UTC). JSON columns use `default=dict`.
- API responses use Pydantic models from `app/schemas/schemas.py`; keep `frontend/src/api/types.ts`
  in sync with them.
- Frontend: strict TS, `eslint-plugin-react-hooks` v7 (React Compiler rules: no synchronous
  setState in effects, no mutation during render). API calls go through `src/api/*`, never raw axios.
- Tests are pure (no DB/Redis). Use `httpx.MockTransport` via `OpenRouterClient(transport=...)`
  for client tests. Put integration checks behind Docker.

## Gotchas

- `.env` is shared by Docker and native dev: leave `DATABASE_URL`/`REDIS_URL` unset so the
  localhost defaults apply natively; docker-compose injects the container URLs.
- Postgres stays on major version 15 in compose — bumping it requires migrating the volume.
- The `frontend` container name (`ai-debates-frontend-1`) is referenced by the external Caddy
  on the production host via the `caddy_net` network.
- `DEBATE_CREATE_RATE_LIMIT` (per IP per hour) protects the system OpenRouter key; set 0 to disable.
- Media: `MEDIA_ROOT` is `./media` natively and the `media_data` volume (`/media`) in Docker;
  the worker image target installs ffmpeg, the api target does not. Docker runs `worker`
  (`--queues default`) and `media-worker` (`--queues media`); natively one worker takes both.
- Without `ELEVENLABS_API_KEY` the UI offers only the free Edge voices (unofficial API, few
  voices per language) or a user-supplied ElevenLabs key.
- Old rows may have `turn_type=moderator_comment` and inline `"[Error ...]"` text; both are still
  handled (`scheduler.MODERATOR_TURN_TYPES`, `lib/format.isErrorTurn`).
