"""
Django settings for be project.

Generated by 'django-admin startproject' using Django 5.0.6.

For more information on this file, see
https://docs.djangoproject.com/en/5.0/topics/settings/

For the full list of settings and their values, see
https://docs.djangoproject.com/en/5.0/ref/settings/
"""

import os
from pathlib import Path
from datetime import timedelta
# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent


# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/5.0/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = "django-insecure-j=&_)ux49j@6hdnbf6dunf^vpq(8*40eke4(%&2!6ru3l3iu(@"

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

ALLOWED_HOSTS = ["localhost", "127.0.0.1", "django"]

MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

# Application definition

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'accounts',
    'games',
    'csp',
    'django_extensions',
    'django_password_validators',
    'django_password_validators.password_history',
    'django_password_validators.password_character_requirements',
    'channels'
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    'csp.middleware.CSPMiddleware'
]



CSP_DEFAULT_SRC = ("'self'", "ws://localhost:8000")
CSP_SCRIPT_SRC = ("'self'", "ws://localhost:8000")
CSP_STYLE_SRC = ("'self'", "ws://localhost:8000")
CSP_IMG_SRC = ("'self'", "data:", "ws://localhost:8000")
CSP_FONT_SRC = ("'self'", "ws://localhost:8000")
CSP_CONNECT_SRC = ("'self'", "ws://localhost:8000")
CSP_OBJECT_SRC = ("'none'", "ws://localhost:8000")
CSP_FRAME_SRC = ("'none'", "ws://localhost:8000")
CSP_REPORT_URI = '/csp-violation-report/'
CORS_ALLOW_CREDENTIALS = True

CORS_ALLOWED_ORIGINS = [
    "http://localhost:4200",
]

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',       # For anonymous users
        'rest_framework.throttling.UserRateThrottle',       # For authenticated users
        'rest_framework.throttling.ScopedRateThrottle',     # For scoped throttling
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '100000/day',
        'user': '1000000/day',
        'register': '1000000/hour',    # Example for a specific view
    },
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(days=1),  # Keep your original access token lifetime
    'REFRESH_TOKEN_LIFETIME': timedelta(days=2),  # Keep your original refresh token lifetime
    'ROTATE_REFRESH_TOKENS': True,  # Rotate refresh tokens upon use
    'BLACKLIST_AFTER_ROTATION': True,  # Blacklist old refresh tokens after they are used
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,  # Use your project's secret key
    'AUTH_HEADER_TYPES': ('Bearer',),  # Use the Bearer scheme for authentication
    'AUTH_TOKEN_CLASSES': ('rest_framework_simplejwt.tokens.AccessToken',),  # Token class for access tokens
    'TOKEN_BLACKLIST_ENABLED': True,  # Enable token blacklisting
}

ROOT_URLCONF = "be.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

ASGI_APPLICATION = 'be.asgi.application'
WSGI_APPLICATION = "be.wsgi.application"
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            'hosts': [(os.getenv('REDIS_HOST', 'redis'), int(os.getenv('REDIS_PORT', 6379)))],
        },
    },
}


# Database
# https://docs.djangoproject.com/en/5.0/ref/settings/#databases

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",           # Use PostgreSQL
        "NAME": os.getenv("POSTGRES_DB", "mydb"),            # Database name
        "USER": os.getenv("POSTGRES_USER", "user"),          # Database user
        "PASSWORD": os.getenv("POSTGRES_PASSWORD", "pass"),  # Database password
        "HOST": os.getenv("DB_HOST", "db"),                  # Host for PostgreSQL
        "PORT": os.getenv("DB_PORT", "5432"),                # PostgreSQL port
    }
}
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.Argon2PasswordHasher',
    'django.contrib.auth.hashers.PBKDF2PasswordHasher',
    'django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher',
    'django.contrib.auth.hashers.BCryptSHA256PasswordHasher',
    'django.contrib.auth.hashers.ScryptPasswordHasher',
]


SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'None' if not DEBUG else 'Lax'
CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SAMESITE = 'None' if not DEBUG else 'Lax'
SECURE_HSTS_INCLUDE_SUBDOMAINS = True



if not DEBUG:
    # Security settings for production only
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_SSL_REDIRECT = True
    SECURE_HSTS_SECONDS = 31536000  # One year
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_REFERRER_POLICY = 'no-referrer-when-downgrade'
    X_FRAME_OPTIONS = 'DENY'
else:
    # Development settings
    SESSION_COOKIE_SECURE = False
    CSRF_COOKIE_SECURE = False
    SECURE_SSL_REDIRECT = False
    SECURE_HSTS_SECONDS = 0
    SECURE_HSTS_INCLUDE_SUBDOMAINS = False
    SECURE_HSTS_PRELOAD = False
    SECURE_CONTENT_TYPE_NOSNIFF = False
    SECURE_REFERRER_POLICY = 'no-referrer'
    X_FRAME_OPTIONS = 'SAMEORIGIN'  # Allows iframe embedding in development
    # CORS_ALLOW_ALL_ORIGINS = True



import logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'DEBUG',
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'INFO',  # Adjust to DEBUG for more detailed output
            'propagate': True,
        },
        'game_debug': {
            'handlers': ['console'],
            'level': 'DEBUG',
            'propagate': False,
        },
    },
}


# Password validation
# https://docs.djangoproject.com/en/5.0/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django_password_validators.password_character_requirements.password_validation.PasswordCharacterValidator',
        'OPTIONS': {
            'min_length_digits': 1,
            'min_length_special': 1,
            'min_length_upper': 1,
            'min_length_lower': 1,
        }
    },
    {
        'NAME': 'django_password_validators.password_history.password_validation.UniquePasswordsValidator',
        'OPTIONS': {
            'last_passwords': 5,
        }
    },
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {
            'min_length': 12,
        }
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]



# Internationalization
# https://docs.djangoproject.com/en/5.0/topics/i18n/

LANGUAGE_CODE = "en-us"

TIME_ZONE = "UTC"

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/5.0/howto/static-files/

STATIC_URL = "static/"

# Default primary key field type
# https://docs.djangoproject.com/en/5.0/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

if not DEBUG:
    REST_FRAMEWORK['DEFAULT_RENDERER_CLASSES'] = (
        'rest_framework.renderers.JSONRenderer',
    )