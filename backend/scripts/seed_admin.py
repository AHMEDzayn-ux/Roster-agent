"""Bootstrap the first manager account. Run once after migrations:

    python scripts/seed_admin.py <email> <password>
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.crud.user import create_user, get_user_by_email
from app.db.session import SessionLocal
from app.models.enums import UserRole
from app.schemas.auth import UserCreate


def main() -> None:
    if len(sys.argv) != 3:
        print("Usage: python scripts/seed_admin.py <email> <password>")
        sys.exit(1)

    email, password = sys.argv[1], sys.argv[2]
    db = SessionLocal()
    try:
        if get_user_by_email(db, email) is not None:
            print(f"User {email} already exists.")
            return
        user = create_user(db, UserCreate(email=email, password=password, role=UserRole.manager))
        print(f"Created manager user: {user.email} (id={user.id})")
    finally:
        db.close()


if __name__ == "__main__":
    main()
