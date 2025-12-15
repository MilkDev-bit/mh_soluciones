"""
Test settings for running Django tests with SQLite database
"""
from .base import *

# Use SQLite for testing
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}

# Disable debug for tests
DEBUG = False

# Use a simpler password hasher for faster tests
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.MD5PasswordHasher',
]

# Disable migrations for faster tests
class DisableMigrations:
    def __contains__(self, item):
        return True
    
    def __getitem__(self, item):
        return None

# MIGRATION_MODULES = DisableMigrations()

# Set required secret key for tests
SECRET_KEY = 'test-secret-key-for-testing-only'

# Disable external services for tests
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True

# Disable email sending in tests
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

# Google Drive - use dummy values for tests
GOOGLE_DRIVE_ROOT_FOLDER_ID = 'test-folder-id'

# Allowed hosts for tests
ALLOWED_HOSTS = ['*']
