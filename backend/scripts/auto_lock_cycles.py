"""Locks every weekly cycle whose Saturday-midnight lock_timestamp has
passed (spec §2.2: automatic hard cutoff, no manual finalize step).

Meant to run on a schedule outside the web process — e.g. a cron job or
systemd timer hitting this script every few minutes:

    */5 * * * * /path/to/.venv/bin/python /path/to/backend/scripts/auto_lock_cycles.py

Kept separate from the FastAPI app so it doesn't start a background thread
inside every uvicorn worker (or every test run) — POST /api/roster/{id}/lock
is the admin-triggerable equivalent for manual use and testing.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.session import SessionLocal
from app.services.roster_lifecycle import auto_lock_due_cycles


def main() -> None:
    db = SessionLocal()
    try:
        locked_ids = auto_lock_due_cycles(db)
        if locked_ids:
            print(f"Auto-locked weekly cycle(s): {locked_ids}")
        else:
            print("No weekly cycles due for auto-lock.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
