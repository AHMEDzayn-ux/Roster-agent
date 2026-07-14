#!/bin/sh
set -e

echo "Running database migrations..."
alembic upgrade head

echo "Starting server..."
exec gunicorn app.main:app \
    --worker-class uvicorn.workers.UvicornWorker \
    --workers "${WEB_CONCURRENCY:-2}" \
    --bind "0.0.0.0:${PORT:-8000}" \
    --access-logfile - \
    --error-logfile -
