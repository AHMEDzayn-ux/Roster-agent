"""Shared leave-balance delta sync: given a weekly_request's status *before*
this operation and the newly-decided honored/denied outcome, adjusts the
agent's leave balance by only the delta — decrementing a newly-honored
request, refunding one that flips from approved to denied, and doing
nothing when the outcome hasn't changed. Used by both solver-driven roster
generation and Excel-import re-validation, so balance correctness is
identical regardless of which path changed the roster.
"""
from decimal import Decimal

from sqlalchemy.orm import Session

from app.crud.weekly_request import requested_days
from app.models.enums import RequestStatus, RequestType
from app.models.leave_balance import LeaveBalance
from app.models.weekly_request import WeeklyRequest


class LeaveBalanceSyncError(Exception):
    def __init__(self, detail: str):
        self.detail = detail
        super().__init__(detail)


def sync_leave_balance(db: Session, request: WeeklyRequest, old_status: RequestStatus, honored: bool) -> None:
    days = requested_days(request.request_type, request.requested_start_date, request.requested_end_date)
    was_applied = old_status == RequestStatus.approved

    if honored and not was_applied:
        delta = days
    elif not honored and was_applied:
        delta = -days
    else:
        return  # no change in outcome; balance already reflects it

    balance = (
        db.query(LeaveBalance)
        .filter(
            LeaveBalance.agent_id == request.agent_id,
            LeaveBalance.year == request.requested_start_date.year,
        )
        .first()
    )
    if balance is None:
        raise LeaveBalanceSyncError(
            f"No leave balance configured for agent {request.agent_id} for {request.requested_start_date.year}"
        )

    if request.request_type == RequestType.leave_half:
        balance.half_days_taken = Decimal(balance.half_days_taken) + delta
    else:
        balance.leave_days_taken = Decimal(balance.leave_days_taken) + delta
    balance.remaining_balance = Decimal(balance.remaining_balance) - delta
