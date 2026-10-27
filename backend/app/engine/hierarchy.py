"""Parent/child helpers shared by assign, sla and rootcause (kept dependency-free)."""
from sqlmodel import Session

from app.models import Incident


def waiting_on_parent(session: Session, inc: Incident) -> bool:
    """A child waits while its parent's repair is not verified and it has no completion of its own."""
    if not inc.parent_incident_id or inc.completed_at is not None:
        return False
    parent = session.get(Incident, inc.parent_incident_id)
    return parent is not None and parent.status != "verified_closed"
