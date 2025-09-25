FROM python:3.10-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential libpq-dev gcc curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN pip install --upgrade pip

COPY requirements/base.txt /app/requirements.txt
RUN pip install -r /app/requirements.txt

COPY . /app

RUN SECRET_KEY=dummy DEBUG=False ALLOWED_HOSTS=localhost \
    POSTGRES_DB=dummy POSTGRES_USER=dummy POSTGRES_PASSWORD=dummy DB_HOST=db DB_PORT=5432 \
    FRONTEND_URL=http://localhost:5173 REDIS_URL=redis://dummy:6379/0 \
    python manage.py collectstatic --noinput --clear

EXPOSE 8000

CMD ["sh", "-c", "python manage.py migrate && gunicorn config.asgi:application -k uvicorn.workers.UvicornWorker --workers 4 --bind 0.0.0.0:8000"]