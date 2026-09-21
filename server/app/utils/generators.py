import random
import string
from datetime import datetime, timezone


def generate_referral_code(prefix: str = "", length: int = 6) -> str:
    """Generate a unique uppercase alphanumeric referral code (e.g. ARJUN8942 or FIT9341)."""
    clean_prefix = "".join(filter(str.isalpha, prefix)).upper()[:4]
    random_chars = "".join(random.choices(string.ascii_uppercase + string.digits, k=length))
    return f"{clean_prefix}{random_chars}" if clean_prefix else f"FIT{random_chars}"


def generate_receipt_number() -> str:
    """Generate sequential-style receipt number e.g. FIT-2024-893412."""
    year = datetime.now(timezone.utc).year
    random_num = random.randint(100000, 999999)
    return f"FIT-{year}-{random_num}"
