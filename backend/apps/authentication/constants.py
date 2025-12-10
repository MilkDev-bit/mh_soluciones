"""
Security constants shared across the authentication system.
"""

# Special characters required for password validation
# This pattern is shared between validators and frontend validation
SPECIAL_CHARS_PATTERN = r'[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/;~`]'

# Password validation requirements
PASSWORD_MIN_LENGTH = 12
PASSWORD_EXPIRY_DAYS = 90

# Account lockout settings
MAX_FAILED_LOGIN_ATTEMPTS = 5
ACCOUNT_LOCKOUT_MINUTES = 30

# Session security
SESSION_INACTIVITY_MINUTES = 15
SESSION_WARNING_MINUTES = 14

# Rate limiting
RATE_LIMIT_LOGIN_ATTEMPTS = 5  # per minute
RATE_LIMIT_WINDOW = '1m'  # 1 minute
