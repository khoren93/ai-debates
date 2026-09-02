# syntax=docker/dockerfile:1.7
# Two targets share one dependency layer:
#   api    — FastAPI (no ffmpeg)
#   worker — RQ worker with ffmpeg for the media (TTS/mixing) pipeline
FROM python:3.13-slim AS base

# uv for fast, reproducible installs (versions pinned in uv.lock)
COPY --from=ghcr.io/astral-sh/uv:0.12 /uv /uvx /bin/

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/opt/venv \
    PATH="/opt/venv/bin:$PATH"

WORKDIR /code

# Install dependencies first so this layer is cached between code changes.
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

COPY . .

# /media is the shared volume for generated audio (see docker-compose.yml).
RUN useradd --create-home --uid 1000 app && mkdir -p /media && chown -R app:app /code /media

FROM base AS api
USER app
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

FROM base AS worker
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*
USER app
CMD ["python", "-m", "app.worker"]
