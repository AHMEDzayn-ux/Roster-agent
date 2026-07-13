from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_manager
from app.crud import solver_config as crud
from app.db.session import get_db
from app.schemas.solver_config import SolverWeightsOut, SolverWeightsUpdate

router = APIRouter(prefix="/api/solver-config", tags=["solver-config"], dependencies=[Depends(require_manager)])


@router.get("", response_model=SolverWeightsOut)
def get_solver_weights(db: Session = Depends(get_db)) -> SolverWeightsOut:
    return crud.get_or_create_solver_weights(db)


@router.patch("", response_model=SolverWeightsOut)
def update_solver_weights(payload: SolverWeightsUpdate, db: Session = Depends(get_db)) -> SolverWeightsOut:
    weights = crud.get_or_create_solver_weights(db)
    return crud.update_solver_weights(db, weights, payload)
