"""Ensures a weekly cycle exists for each of the next few Mondays, so agents
always have upcoming weeks open for requests without a manager creating each one
by hand. Idempotent — safe to run repeatedly; it only creates weeks that don't
already have a cycle.

Meant to run on a schedule outside the web process — e.g. a daily cron job:

    30 0 * * * /path/to/.venv/bin/python /path/to/backend/scripts/ensure_weekly_cycles.py

The manual POST /api/weekly-cycles endpoint stays for exceptions (skipping a
holiday week, or creating a specific out-of-band week).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.crud.weekly_cycle import ensure_upcoming_cycles
from app.db.session import SessionLocal


def main() -> None:
    db = SessionLocal()
    try:
        created = ensure_upcoming_cycles(db)
        if created:
            print(f"Created weekly cycle(s) for: {[c.week_start_date.isoformat() for c in created]}")
        else:
            print("Upcoming weekly cycles already exist; nothing to create.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
