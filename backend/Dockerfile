# A self-contained binary avoids pulling the desktop/audio/graphics dependency
# tree of Debian's ffmpeg package into the API image just to decode one frame.
# Pinned to the amd64/multi-arch manifest resolved and exercised by QA. Keeping
# the digest makes a rebuild use the same executable rather than a moved tag.
FROM mwader/static-ffmpeg:7.1@sha256:a8090df5f5608daef387e1b2e93b98aaacb4d92153ad904e7d715c725724fca4 AS ffmpeg

# ─── Stage 1: Build ───
FROM python:3.11-slim AS builder
WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

# The lock first, then the project without re-resolving. `pip install .` alone
# took whatever was newest on PyPI at build time, so the same commit produced a
# different image every time and there was no "roll back to the last good
# backend". requirements.lock is the concrete answer; pyproject.toml stays the
# abstract declaration. --no-deps on the second line is what stops pip from
# quietly resolving past the pins it was just given.
COPY pyproject.toml requirements.lock ./
RUN pip install --no-cache-dir --prefix=/install -r requirements.lock && \
    pip install --no-cache-dir --prefix=/install --no-deps .

# ─── Stage 2: Production ───
FROM python:3.11-slim AS runner
WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends libpq5 curl && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /install /usr/local
COPY --from=ffmpeg /ffmpeg /usr/local/bin/ffmpeg

RUN useradd --system --uid 1001 appuser && \
    mkdir -p /app/storage/media && \
    chown -R appuser:appuser /app

COPY --chown=appuser:appuser . .

USER appuser
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8000/healthz || exit 1

CMD ["sh", "/app/scripts/start-production.sh"]
