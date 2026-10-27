"""Parent/child helpers shared by assign, sla and rootcause (kept dependency-free)."""
from sqlmodel import Session

from app.models import Incident

# Terminal states: no SLA checks, no crew, no replanning, no root-cause grouping.
# "rejected" = an operator (head/command) judged the complaint invalid (fake, not civic, ...).
CLOSED_STATES = frozenset({"verified_closed", "rejected"})


def waiting_on_parent(session: Session, inc: Incident) -> bool:
    """A child waits while its parent's repair is not verified and it has no completion of its own."""
    if not inc.parent_incident_id or inc.completed_at is not None:
        return False
    parent = session.get(Incident, inc.parent_incident_id)
    return parent is not None and parent.status not in CLOSED_STATES
