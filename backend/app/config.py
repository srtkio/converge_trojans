"""Static rules from docs/CONTRACTS.md. Change here, not in engine code."""

CATEGORIES: dict[str, dict] = {
    "pothole": {"department": "roads", "sla_hours": 48, "severity": 3},
    "streetlight": {"department": "electrical", "sla_hours": 24, "severity": 2},
    "water_leak": {"department": "water", "sla_hours": 12, "severity": 4},
    "garbage": {"department": "sanitation", "sla_hours": 24, "severity": 2},
    "sewage": {"department": "water", "sla_hours": 12, "severity": 4},
    "other": {"department": "general", "sla_hours": 72, "severity": 2},
}

DUPLICATE_RADIUS_M = 150
DUPLICATE_WINDOW_H = 72
RELATED_RADIUS_M = 400

# Unordered pairs of categories where one issue plausibly causes or worsens the other.
DEPENDENT_CATEGORIES: set[frozenset[str]] = {
    frozenset({"water_leak", "pothole"}),
    frozenset({"sewage", "water_leak"}),
    frozenset({"sewage", "pothole"}),
}

URGENT_WORDS = ("danger", "accident", "flood", "urgent", "injur", "child", "hospital", "school")

SIM_START = "2026-10-27T09:00:00Z"
