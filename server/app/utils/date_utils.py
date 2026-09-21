from datetime import date, datetime, timezone
from typing import Optional


def get_utc_now() -> datetime:
    """Return current timezone-aware UTC datetime."""
    return datetime.now(timezone.utc)


def get_today_str() -> str:
    """Return today's date in YYYY-MM-DD string format (UTC)."""
    return get_utc_now().strftime("%Y-%m-%d")


def parse_date(date_str: str) -> date:
    """Parse YYYY-MM-DD string into date object."""
    return datetime.strptime(date_str, "%Y-%m-%d").date()


def format_iso(dt: Optional[datetime]) -> Optional[str]:
    """Format datetime to ISO string."""
    if not dt:
        return None
    return dt.isoformat()
