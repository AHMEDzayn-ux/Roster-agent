from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.appeal import Appeal
from app.models.audit import AuditLog
from app.models.enums import AppealStatus, RequestStatus
from app.models.weekly_cycle import WeeklyCycle
from app.models.weekly_request import WeeklyRequest
from app.schemas.appeal import AppealCreate, AppealReview


class AppealError(Exception):
    def __init__(self, detail: str, status_code: int = 400):
        self.detail = detail
        self.status_code = status_code
        super().__init__(detail)


def list_appeals(db: Session, status_filter: AppealStatus | None = None) -> list[Appeal]:
    query = db.query(Appeal)
    if status_filter is not None:
        query = query.filter(Appeal.status == status_filter)
    return query.order_by(Appeal.id.desc()).all()


def list_appeals_for_agent(db: Session, agent_id: int) -> list[Appeal]:
    return db.query(Appeal).filter(Appeal.agent_id == agent_id).order_by(Appeal.id.desc()).all()


def get_appeal(db: Session, appeal_id: int) -> Appeal | None:
    return db.query(Appeal).filter(Appeal.id == appeal_id).first()


def create_appeal(db: Session, agent_id: int, payload: AppealCreate) -> Appeal:
    request = db.query(WeeklyRequest).filter(WeeklyRequest.id == payload.weekly_request_id).first()
    if request is None:
        raise AppealError("Weekly request not found", status_code=404)
    if request.agent_id != agent_id:
        raise AppealError("You can only appeal your own requests", status_code=403)
    if request.status != RequestStatus.denied:
        raise AppealError("Only a denied request can be appealed")

    cycle = db.query(WeeklyCycle).filter(WeeklyCycle.id == request.week_cycle_id).first()
    now = datetime.now(timezone.utc)
    if now < cycle.publish_date or now > cycle.appeal_deadline:
        raise AppealError("Appeals may only be submitted on the day the roster is published")

    existing = (
        db.query(Appeal)
        .filter(Appeal.weekly_request_id == request.id, Appeal.status == AppealStatus.pending)
        .first()
    )
    if existing is not None:
        raise AppealError("This request already has a pending appeal")

    appeal = Appeal(
        weekly_request_id=request.id,
        agent_id=agent_id,
        appeal_reason=payload.appeal_reason,
        status=AppealStatus.pending,
    )
    db.add(appeal)
    request.status = RequestStatus.appealed
    db.commit()
    db.refresh(appeal)
    return appeal


def review_appeal(db: Session, appeal: Appeal, review: AppealReview, resolver_id: int) -> Appeal:
    if appeal.status != AppealStatus.pending:
        raise AppealError("This appeal has already been resolved")

    request = db.query(WeeklyRequest).filter(WeeklyRequest.id == appeal.weekly_request_id).first()
    old_status = request.status

    appeal.status = review.status
    appeal.manager_response = review.manager_response
    appeal.resolved_by = resolver_id
    appeal.resolved_at = datetime.now(timezone.utc)

    # Approving an appeal re-opens the request for the solver to reconsider on
    # the next regeneration (spec §2.8: manager "may regenerate the roster"
    # after review) — it never grants the request directly; the solver still
    # has final say (see Slice 3 decision). Denying leaves the denial standing.
    request.status = RequestStatus.pending if review.status == AppealStatus.approved else RequestStatus.denied

    db.add(
        AuditLog(
            actor_id=resolver_id,
            action_type="appeal_resolved",
            target_type="weekly_request",
            target_id=request.id,
            old_value=old_status.value,
            new_value=request.status.value,
            reason=review.manager_response,
        )
    )

    db.commit()
    db.refresh(appeal)
    return appeal
