"""Shared leave-request date logic (which calendar dates a leave request
covers) — used by both the solver and Excel-import re-validation."""
from datetime import date, timedelta

LEAVE_TYPES = {"leave_full", "leave_half", "leave_multi"}


def leave_dates(request_type: str, start_date: date, end_date: date | None) -> list[date]:
    if request_type in ("leave_full", "leave_half"):
        return [start_date]
    if request_type == "leave_multi":
        end = end_date or start_date
        days = (end - start_date).days + 1
        return [start_date + timedelta(days=i) for i in range(days)]
    return []
