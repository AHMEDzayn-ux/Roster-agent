from sqlalchemy.orm import Session

from app.models.solver_config import SolverWeights
from app.schemas.solver_config import SolverWeightsUpdate

SINGLETON_ID = 1


def get_or_create_solver_weights(db: Session) -> SolverWeights:
    weights = db.query(SolverWeights).filter(SolverWeights.id == SINGLETON_ID).first()
    if weights is None:
        weights = SolverWeights(id=SINGLETON_ID)
        db.add(weights)
        db.commit()
        db.refresh(weights)
    return weights


def update_solver_weights(db: Session, weights: SolverWeights, update: SolverWeightsUpdate) -> SolverWeights:
    for field, value in update.model_dump(exclude_unset=True).items():
        setattr(weights, field, value)
    db.commit()
    db.refresh(weights)
    return weights
