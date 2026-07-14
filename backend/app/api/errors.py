from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session


def delete_or_conflict(db: Session, delete_fn, *args, entity_name: str) -> None:
    """Run a CRUD delete, converting a FK-violation into a clean 409 instead of a 500."""
    try:
        delete_fn(db, *args)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot delete this {entity_name}: it is still referenced by other records.",
        )
