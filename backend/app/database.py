"""Database engine, session factory and FastAPI session dependency."""
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True, echo=settings.sql_echo)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    """Declarative base shared by every ORM model."""


def get_db() -> Generator[Session, None, None]:
    """Yield a request-scoped session and always close it afterwards."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
