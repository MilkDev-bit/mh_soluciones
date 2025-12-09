FROM python:3.10-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DJANGO_SETTINGS_MODULE=config.settings.railway

WORKDIR /app

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential libpq-dev gcc curl jq && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN pip install --upgrade pip

COPY requirements/base.txt /app/requirements.txt
RUN pip install -r /app/requirements.txt

RUN pip install channels channels-redis daphne

COPY . /app

RUN SECRET_KEY=dummy DJANGO_SETTINGS_MODULE=config.settings.base python manage.py collectstatic --noinput --clear

COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Railway assigns PORT dynamically, expose common port for reference
EXPOSE 8000

# Note: Railway uses external health checks via healthcheckPath in railway.json
# Internal HEALTHCHECK is not needed and can cause issues with dynamic ports

ENTRYPOINT ["/app/entrypoint.sh"]
# CMD is not needed as entrypoint.sh directly starts Daphne with the configured PORT
