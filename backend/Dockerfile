FROM python:3.10-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
# Railway uses PORT environment variable
ENV PORT=8000

WORKDIR /app

# Install system dependencies (removed AWS CLI for Railway)
RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential libpq-dev gcc curl jq && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN pip install --upgrade pip

COPY requirements/base.txt /app/requirements.txt
RUN pip install -r /app/requirements.txt

RUN pip install channels channels-redis daphne

COPY . /app

RUN SECRET_KEY=dummy python manage.py collectstatic --noinput --clear

# Railway dynamically assigns port
EXPOSE ${PORT}

COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

ENTRYPOINT ["/app/entrypoint.sh"]
# Use Railway's PORT variable with fallback
CMD ["sh", "-c", "daphne -b 0.0.0.0 -p ${PORT:-8000} config.asgi:application"]