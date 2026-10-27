from datetime import datetime, timedelta, timezone

FMT = "%Y-%m-%dT%H:%M:%SZ"


def parse(s: str) -> datetime:
    return datetime.strptime(s, FMT).replace(tzinfo=timezone.utc)


def fmt(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime(FMT)


def add_hours(s: str, hours: float) -> str:
    return fmt(parse(s) + timedelta(hours=hours))


def hours_between(a: str, b: str) -> float:
    return (parse(b) - parse(a)).total_seconds() / 3600
