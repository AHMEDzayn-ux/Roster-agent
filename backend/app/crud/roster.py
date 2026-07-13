from sqlalchemy.orm import Session

from app.models.roster import ConflictReport, Roster, RosterAssignment, SatisfactionMetric


def get_roster(db: Session, roster_id: int) -> Roster | None:
    return db.query(Roster).filter(Roster.id == roster_id).first()


def list_assignments(db: Session, roster_id: int) -> list[RosterAssignment]:
    return db.query(RosterAssignment).filter(RosterAssignment.roster_id == roster_id).all()


def list_conflicts(db: Session, roster_id: int) -> list[ConflictReport]:
    return db.query(ConflictReport).filter(ConflictReport.roster_id == roster_id).all()


def list_satisfaction_metrics(db: Session, roster_id: int) -> list[SatisfactionMetric]:
    return db.query(SatisfactionMetric).filter(SatisfactionMetric.roster_id == roster_id).all()
