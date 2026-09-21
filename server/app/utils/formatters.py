import re


def paise_to_inr(paise: int) -> str:
    """Format integer paise into formatted INR currency string e.g. 150000 -> ₹1,500.00"""
    rupees = paise / 100.0
    return f"₹{rupees:,.2f}"


def format_phone(phone: str) -> str:
    """
    Standardize Indian phone number to +91XXXXXXXXXX.
    Strips spaces, dashes, parentheses.
    """
    cleaned = re.sub(r"[\s\-\(\)]", "", phone)
    if cleaned.startswith("+91"):
        return cleaned
    if cleaned.startswith("0") and len(cleaned) == 11:
        return f"+91{cleaned[1:]}"
    if len(cleaned) == 10:
        return f"+91{cleaned}"
    return cleaned


def is_valid_indian_phone(phone: str) -> bool:
    """Check if string is a valid 10-digit Indian phone number with optional +91 prefix."""
    pattern = r"^(\+91)?[6-9]\d{9}$"
    return bool(re.match(pattern, re.sub(r"[\s\-]", "", phone)))


def format_email(email: str) -> str:
    """
    Standardize email address by stripping surrounding whitespace and converting to lowercase.
    """
    return email.strip().lower()


def is_valid_email(email: str) -> bool:
    """
    Validate email address format according to standard email conventions.
    Ensures non-empty local-part, '@' symbol, domain name, and a valid top-level domain (TLD).
    """
    if not email or not isinstance(email, str):
        return False
    cleaned = email.strip()
    pattern = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$"
    return bool(re.match(pattern, cleaned))

