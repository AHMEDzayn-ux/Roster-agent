from sqlalchemy.orm import Session

from app.models.audit import AuditLog
from app.models.weekly_request import WeeklyRequest


def list_audit_log(
    db: Session, action_type: str | None = None, target_type: str | None = None
) -> list[AuditLog]:
    query = db.query(AuditLog)
    if action_type is not None:
        query = query.filter(AuditLog.action_type == action_type)
    if target_type is not None:
        query = query.filter(AuditLog.target_type == target_type)
    return query.order_by(AuditLog.timestamp.desc()).all()


def list_audit_log_for_agent(db: Session, agent_id: int) -> list[AuditLog]:
    """Entries transparently relevant to this agent: overrides of their own
    weekly requests (target_type='weekly_request', target_id = one of theirs)."""
    request_ids = [
        r.id for r in db.query(WeeklyRequest.id).filter(WeeklyRequest.agent_id == agent_id).all()
    ]
    if not request_ids:
        return []
    return (
        db.query(AuditLog)
        .filter(AuditLog.target_type == "weekly_request", AuditLog.target_id.in_(request_ids))
        .order_by(AuditLog.timestamp.desc())
        .all()
    )
