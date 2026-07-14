"""Auto-publishes every weekly cycle whose Friday-night publish_date (Saturday
00:00) has passed, but only when the roster has zero conflicts; rosters with
unmet requests are left as drafts for the manager to review.

Meant to run on a schedule outside the web process — e.g. a cron job or systemd
timer hitting this script every few minutes:

    */5 * * * * /path/to/.venv/bin/python /path/to/backend/scripts/auto_publish_cycles.py

Kept separate from the FastAPI app (like auto_lock_cycles.py) so it doesn't start
a background thread inside every uvicorn worker or test run —
POST /api/roster/{id}/publish is the admin-triggerable equivalent.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.session import SessionLocal
from app.services.roster_lifecycle import auto_publish_due_cycles


def main() -> None:
    db = SessionLocal()
    try:
        result = auto_publish_due_cycles(db)
        if result["published"]:
            print(f"Auto-published weekly cycle(s): {result['published']}")
        if result["held"]:
            print(f"Held for manual review (conflicts): {result['held']}")
        if not result["published"] and not result["held"]:
            print("No weekly cycles due for auto-publish.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
