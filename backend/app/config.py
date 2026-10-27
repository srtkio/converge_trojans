"""Static rules from docs/CONTRACTS.md. Change here, not in engine code."""

CATEGORIES: dict[str, dict] = {
    "pothole": {"department": "roads", "sla_hours": 48, "severity": 3},
    "streetlight": {"department": "electrical", "sla_hours": 24, "severity": 2},
    "water_leak": {"department": "water", "sla_hours": 12, "severity": 4},
    "garbage": {"department": "sanitation", "sla_hours": 24, "severity": 2},
    "sewage": {"department": "water", "sla_hours": 12, "severity": 4},
    "other": {"department": "general", "sla_hours": 72, "severity": 2},
    "health_service": {"department": "health", "sla_hours": 24, "severity": 3},
    "bin_overflow": {"department": "sanitation", "sla_hours": 12, "severity": 3},
}

DUPLICATE_RADIUS_M = 150
DUPLICATE_WINDOW_H = 72
RELATED_RADIUS_M = 400

# Unordered pairs of categories where one issue plausibly causes or worsens the other.
DEPENDENT_CATEGORIES: set[frozenset[str]] = {
    frozenset({"water_leak", "pothole"}),
    frozenset({"sewage", "water_leak"}),
    frozenset({"sewage", "pothole"}),
    frozenset({"bin_overflow", "sewage"}),
}

URGENT_WORDS = ("danger", "accident", "flood", "urgent", "injur", "child", "hospital", "school")

SIM_START = "2026-10-27T09:00:00Z"

# v2 root cause: higher rank = further upstream. A group's cause is its highest-ranked incident.
CAUSE_RANK = {"bin_overflow": 4, "sewage": 3, "water_leak": 2, "pothole": 1}
CAUSE_EXPLANATION = {
    frozenset({"water_leak", "pothole"}): "escaping water washes out the road base, so potholes form above leaks",
    frozenset({"sewage", "water_leak"}): "sewer overflow and water-main leaks often share a failed pipe trench",
    frozenset({"sewage", "pothole"}): "sewage seepage softens the road base",
    frozenset({"bin_overflow", "sewage"}): "overflowing bins block drains, so sewage backs up into the street",
}

# v3: flag incidents not yet started with less than this share of their SLA left.
AT_RISK_SHARE = 0.25
