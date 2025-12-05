#!/bin/sh

set -e

echo "🚂 Iniciando entrypoint para Railway..."

# Railway provides environment variables directly, no need to fetch from secrets manager
if [ -z "$SECRET_KEY" ] || [ -z "$DATABASE_URL" ]; then
    echo "ERROR FATAL: SECRET_KEY o DATABASE_URL están vacías."
    echo "Asegúrate de configurar las variables de entorno en Railway."
    exit 1
fi

echo "✅ Variables de entorno detectadas correctamente."

# Set PORT default if not provided by Railway
export PORT=${PORT:-8000}

echo "📊 Puerto configurado: $PORT"

# Wait for database to be ready
echo "⏳ Esperando a que la base de datos esté lista..."
python -c "
import time
import dj_database_url
import psycopg2
import os

database_url = os.environ.get('DATABASE_URL')
config = dj_database_url.parse(database_url)

max_retries = 30
retry_count = 0

while retry_count < max_retries:
    try:
        conn = psycopg2.connect(
            dbname=config['NAME'],
            user=config['USER'],
            password=config['PASSWORD'],
            host=config['HOST'],
            port=config['PORT']
        )
        conn.close()
        print('✅ Base de datos lista!')
        break
    except psycopg2.OperationalError as e:
        retry_count += 1
        print(f'⏳ Esperando base de datos... intento {retry_count}/{max_retries}')
        time.sleep(2)
else:
    print('❌ No se pudo conectar a la base de datos después de 30 intentos')
    exit(1)
"

echo "🔄 Aplicando migraciones de base de datos..."
python manage.py migrate --noinput

echo "👤 Creando superusuario si no existe..."
python manage.py shell -c "
from django.contrib.auth import get_user_model
import os
User = get_user_model()
username = os.environ.get('DJANGO_SUPERUSER_USERNAME', 'admin')
email = os.environ.get('DJANGO_SUPERUSER_EMAIL', 'admin@example.com')
password = os.environ.get('DJANGO_SUPERUSER_PASSWORD', 'changeme123')
if not User.objects.filter(username=username).exists():
    User.objects.create_superuser(username, email, password)
    print('✅ Superusuario creado exitosamente')
else:
    print('ℹ️ Superusuario ya existe')
"

echo "🚀 Iniciando servidor en puerto $PORT..."

# Replace the port in the command if provided
if [ "$1" = "daphne" ]; then
    shift
    exec daphne -b 0.0.0.0 -p "$PORT" config.asgi:application
else
    exec "$@"
fi
