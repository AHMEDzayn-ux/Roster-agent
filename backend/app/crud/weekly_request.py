from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.enums import RequestStatus, RequestType, WeeklyCycleStatus
from app.models.leave_balance import LeaveBalance
from app.models.weekly_cycle import WeeklyCycle
from app.models.weekly_request import WeeklyRequest
from app.schemas.weekly_request import WeeklyRequestCreate, WeeklyRequestReview, WeeklyRequestUpdate

LEAVE_REQUEST_TYPES = {RequestType.leave_full, RequestType.leave_half, RequestType.leave_multi}


class WeeklyRequestError(Exception):
    def __init__(self, detail: str, status_code: int = 400):
        self.detail = detail
        self.status_code = status_code
        super().__init__(detail)


def requested_days(request_type: RequestType, start, end) -> Decimal:
    if request_type == RequestType.leave_half:
        return Decimal("0.5")
    if request_type == RequestType.leave_full:
        return Decimal("1")
    if request_type == RequestType.leave_multi:
        return Decimal((end - start).days + 1)
    return Decimal("0")


def list_requests(db: Session, week_cycle_id: int | None = None, agent_id: int | None = None) -> list[WeeklyRequest]:
    query = db.query(WeeklyRequest)
    if week_cycle_id is not None:
        query = query.filter(WeeklyRequest.week_cycle_id == week_cycle_id)
    if agent_id is not None:
        query = query.filter(WeeklyRequest.agent_id == agent_id)
    return query.order_by(WeeklyRequest.created_at.desc()).all()


def get_request(db: Session, request_id: int) -> WeeklyRequest | None:
    return db.query(WeeklyRequest).filter(WeeklyRequest.id == request_id).first()


def _get_leave_balance_or_error(db: Session, agent_id: int, year: int) -> LeaveBalance:
    balance = (
        db.query(LeaveBalance)
        .filter(LeaveBalance.agent_id == agent_id, LeaveBalance.year == year)
        .first()
    )
    if balance is None:
        raise WeeklyRequestError(f"No leave balance configured for this agent for {year}")
    return balance


def create_request(db: Session, agent_id: int, request_in: WeeklyRequestCreate) -> WeeklyRequest:
    cycle = db.query(WeeklyCycle).filter(WeeklyCycle.id == request_in.week_cycle_id).first()
    if cycle is None:
        raise WeeklyRequestError("Weekly cycle not found", status_code=404)

    now = datetime.now(timezone.utc)
    if cycle.status == WeeklyCycleStatus.locked or now > cycle.request_deadline:
        raise WeeklyRequestError("The request window for this weekly cycle has closed")

    denial_reason = None
    days = requested_days(request_in.request_type, request_in.requested_start_date, request_in.requested_end_date)

    if request_in.request_type in LEAVE_REQUEST_TYPES:
        balance = _get_leave_balance_or_error(db, agent_id, request_in.requested_start_date.year)
        if days > balance.remaining_balance:
            raise WeeklyRequestError(
                f"Requested {days} day(s) exceeds remaining leave balance of {balance.remaining_balance}"
            )

    request = WeeklyRequest(
        week_cycle_id=request_in.week_cycle_id,
        agent_id=agent_id,
        request_type=request_in.request_type,
        requested_start_date=request_in.requested_start_date,
        requested_end_date=request_in.requested_end_date,
        half_day_portion=request_in.half_day_portion,
        requested_shift_id=request_in.requested_shift_id,
        reason=request_in.reason,
        status=RequestStatus.pending,
        denial_reason=denial_reason,
    )
    db.add(request)
    db.commit()
    db.refresh(request)
    return request


def _assert_editable_window(db: Session, request: WeeklyRequest) -> None:
    """A request may be edited/withdrawn by its owner only while it is still
    pending and the cycle's request window is open."""
    if request.status != RequestStatus.pending:
        raise WeeklyRequestError("Only pending requests can be changed")
    cycle = db.query(WeeklyCycle).filter(WeeklyCycle.id == request.week_cycle_id).first()
    now = datetime.now(timezone.utc)
    if cycle is None or cycle.status == WeeklyCycleStatus.locked or now > cycle.request_deadline:
        raise WeeklyRequestError("The request window for this weekly cycle has closed")


def update_request(db: Session, request: WeeklyRequest, update: WeeklyRequestUpdate) -> WeeklyRequest:
    _assert_editable_window(db, request)

    days = requested_days(update.request_type, update.requested_start_date, update.requested_end_date)
    if update.request_type in LEAVE_REQUEST_TYPES:
        balance = _get_leave_balance_or_error(db, request.agent_id, update.requested_start_date.year)
        if days > balance.remaining_balance:
            raise WeeklyRequestError(
                f"Requested {days} day(s) exceeds remaining leave balance of {balance.remaining_balance}"
            )

    request.request_type = update.request_type
    request.requested_start_date = update.requested_start_date
    request.requested_end_date = update.requested_end_date
    request.half_day_portion = update.half_day_portion
    request.requested_shift_id = update.requested_shift_id
    request.reason = update.reason
    db.commit()
    db.refresh(request)
    return request


def delete_request(db: Session, request: WeeklyRequest) -> None:
    _assert_editable_window(db, request)
    db.delete(request)
    db.commit()


def review_request(db: Session, request: WeeklyRequest, review: WeeklyRequestReview) -> WeeklyRequest:
    """Pre-solver manager triage: deny-only (see WeeklyRequestReview). No balance impact —
    leave balances are only ever touched by the solver at roster generation time."""
    now = datetime.now(timezone.utc)
    cycle = db.query(WeeklyCycle).filter(WeeklyCycle.id == request.week_cycle_id).first()
    if cycle is not None and (cycle.status == WeeklyCycleStatus.locked or now > cycle.lock_timestamp):
        raise WeeklyRequestError("This weekly cycle is locked; requests can no longer be reviewed")

    request.status = RequestStatus.denied
    request.denial_reason = review.denial_reason
    db.commit()
    db.refresh(request)
    return request
