#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys
import time
from django.db import connections
from django.db.utils import OperationalError

def wait_for_db_connection(max_retries=10, delay=2):
    """
    Retry connection to the database until it is available or the maximum retries are reached.

    Parameters:
    - max_retries: int, the maximum number of retries before giving up.
    - delay: int, the delay between retries in seconds.
    """
    retries = 0
    while retries < max_retries:
        try:
            # Check if the default database connection is available
            connection = connections['default']
            connection.cursor()  # This will trigger an error if DB is not ready
            return True
        except OperationalError:
            retries += 1
            time.sleep(delay)
    return False

def main():
    """Run administrative tasks."""
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "be.settings")
    
    # Wait for the database connection before proceeding
    if not wait_for_db_connection():
        sys.exit("Database connection could not be established. Exiting.")
    
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc

    # Perform migrations automatically if no specific command is given
    if len(sys.argv) == 1:
        # Run migrations
        execute_from_command_line(['manage.py', 'makemigrations', 'accounts', 'games'])
        execute_from_command_line(['manage.py', 'migrate'])

    # Execute the provided command or the default Django command
    execute_from_command_line(sys.argv)

if __name__ == "__main__":
    main()
