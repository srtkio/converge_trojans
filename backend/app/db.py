import os

from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app import config
from app.models import Counter

DB_URL = os.environ.get("CONVERGE_DB_URL", "sqlite:///./converge.db")

if DB_URL == "sqlite://":
    engine = create_engine(DB_URL, connect_args={"check_same_thread": False}, poolclass=StaticPool)
else:
    engine = create_engine(DB_URL, connect_args={"check_same_thread": False})


def init_db() -> None:
    SQLModel.metadata.create_all(engine)


# Real user feedback must survive demo resets.
KEEP_ON_RESET = {"feedback"}


def wipe_db() -> None:
    tables = [t for t in SQLModel.metadata.sorted_tables if t.name not in KEEP_ON_RESET]
    SQLModel.metadata.drop_all(engine, tables=tables)
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine, expire_on_commit=False) as session:
        yield session


def next_id(session: Session, prefix: str) -> str:
    row = session.get(Counter, f"id:{prefix}") or Counter(key=f"id:{prefix}")
    row.value += 1
    session.add(row)
    return f"{prefix}_{row.value:03d}"


def now(session: Session) -> str:
    row = session.get(Counter, "clock")
    return row.text if row and row.text else config.SIM_START


def set_now(session: Session, value: str) -> None:
    row = session.get(Counter, "clock") or Counter(key="clock")
    row.text = value
    session.add(row)
