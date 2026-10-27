import logging
import os

from sqlalchemy import inspect, text
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app import config
from app.models import Counter

log = logging.getLogger(__name__)

def _normalise(url: str) -> str:
    # Render/Heroku hand out postgres:// or postgresql:// URLs; use the psycopg 3 driver.
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url


DB_URL = _normalise(os.environ.get("CONVERGE_DB_URL", "sqlite:///./converge.db"))

if DB_URL == "sqlite://":
    engine = create_engine(DB_URL, connect_args={"check_same_thread": False}, poolclass=StaticPool)
elif DB_URL.startswith("sqlite"):
    engine = create_engine(DB_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DB_URL, pool_pre_ping=True)


def add_missing_columns(target=None) -> list[str]:
    """Add columns that the models have but an existing table lacks (all new ones are nullable).

    create_all() only creates missing tables, so a database created before a release would
    otherwise fail on the first query that touches a new column.

    Additive only: nullable columns, no defaults (no table rewrite), never drops or renames, and
    safe to run on every boot (already-present columns are skipped).
    """
    target = target or engine
    inspector = inspect(target)
    if_not_exists = "IF NOT EXISTS " if target.dialect.name == "postgresql" else ""
    added = []
    with target.begin() as conn:
        for table in SQLModel.metadata.sorted_tables:
            if not inspector.has_table(table.name):
                continue
            have = {c["name"] for c in inspector.get_columns(table.name)}
            for col in table.columns:
                if col.name in have:
                    continue
                if not col.nullable or col.primary_key:
                    log.warning("not adding non-nullable column %s.%s automatically", table.name, col.name)
                    continue
                ddl = col.type.compile(dialect=target.dialect)
                conn.execute(text(f'ALTER TABLE "{table.name}" ADD COLUMN {if_not_exists}"{col.name}" {ddl}'))
                added.append(f"{table.name}.{col.name}")
    if added:
        log.info("added columns: %s", ", ".join(added))
    return added


def init_db() -> None:
    SQLModel.metadata.create_all(engine)
    add_missing_columns()


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
