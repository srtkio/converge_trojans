"""v3: real tester feedback. Wall-clock timestamps; never touched by /sim/reset."""
import uuid
from datetime import UTC, datetime

from sqlmodel import Session, select

from app.models import Feedback


def _now() -> str:
    # Microseconds, so "newest first" is well defined even when two people rate in the same second.
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


def submit(session: Session, rating: int, comment: str, role: str, page: str | None,
           incident_id: str | None) -> Feedback:
    fb = Feedback(id=f"fb_{uuid.uuid4().hex[:10]}", rating=rating, comment=comment.strip(), role=role,
                  page=page, incident_id=incident_id, created_at=_now())
    session.add(fb)
    session.flush()
    return fb


def all_feedback(session: Session) -> list[Feedback]:
    return list(session.exec(select(Feedback).order_by(Feedback.created_at.desc(), Feedback.id.desc())).all())


def summary(session: Session) -> dict:
    items = all_feedback(session)

    def avg(xs):
        return round(sum(xs) / len(xs), 2) if xs else None

    by_role: dict[str, list[int]] = {}
    for f in items:
        by_role.setdefault(f.role, []).append(f.rating)
    return {
        "count": len(items),
        "average": avg([f.rating for f in items]),
        "distribution": {str(n): sum(1 for f in items if f.rating == n) for n in range(1, 6)},
        "by_role": {r: {"count": len(v), "average": avg(v)} for r, v in sorted(by_role.items())},
        "recent": [f.to_api() for f in items if f.comment][:5],
    }
