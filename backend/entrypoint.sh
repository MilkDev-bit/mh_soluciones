#!/bin/sh

set -e

echo "🚀 Iniciando entrypoint..."

# Ensure media directory exists
mkdir -p /app/mediafiles /app/staticfiles
chmod -R 777 /app/mediafiles

# Detect Railway environment
if [ -n "$RAILWAY_ENVIRONMENT" ] || [ -n "$RAILWAY_PROJECT_ID" ]; then
    echo "🚂 Entorno Railway detectado."
    echo "Railway environment: ${RAILWAY_ENVIRONMENT:-production}"
    
    # Railway provides environment variables directly
    # No need to fetch from secrets manager
    
    # Add Railway-specific hosts to ALLOWED_HOSTS if not already present
    if [ -n "$RAILWAY_PUBLIC_DOMAIN" ]; then
        export ALLOWED_HOSTS="${ALLOWED_HOSTS},${RAILWAY_PUBLIC_DOMAIN}"
        echo "Added Railway domain to ALLOWED_HOSTS: $RAILWAY_PUBLIC_DOMAIN"
    fi
    
elif [ -n "$AWS_EXECUTION_ENV" ] && command -v aws > /dev/null; then
    echo "Entorno ECS detectado. Obteniendo secretos..."
    
    SECRET_CONTENT=$(aws secretsmanager get-secret-value \
        --secret-id "mh-soluciones/prod" \
        --region "us-east-2" \
        --query SecretString \
        --output text)

    if [ -n "$SECRET_CONTENT" ]; then
        echo "Secretos obtenidos. Parseando formato JSON..."
        
        export SECRET_KEY=$(echo "$SECRET_CONTENT" | jq -r '.SECRET_KEY')
        export DATABASE_URL=$(echo "$SECRET_CONTENT" | jq -r '.DATABASE_URL')
        export REDIS_URL=$(echo "$SECRET_CONTENT" | jq -r '.REDIS_URL')
        export GOOGLE_DRIVE_ROOT_FOLDER_ID=$(echo "$SECRET_CONTENT" | jq -r '.GOOGLE_DRIVE_ROOT_FOLDER_ID')
        export GOOGLE_CLIENT_ID=$(echo "$SECRET_CONTENT" | jq -r '.GOOGLE_CLIENT_ID')
        export GOOGLE_CLIENT_SECRET=$(echo "$SECRET_CONTENT" | jq -r '.GOOGLE_CLIENT_SECRET')
        export BACKEND_URL=$(echo "$SECRET_CONTENT" | jq -r '.BACKEND_URL')
        export FRONTEND_URL=$(echo "$SECRET_CONTENT" | jq -r '.FRONTEND_URL')
        
        BASE_ALLOWED_HOSTS=$(echo "$SECRET_CONTENT" | jq -r '.ALLOWED_HOSTS')
        export ALLOWED_HOSTS="$BASE_ALLOWED_HOSTS,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16"
        
        export DJANGO_SUPERUSER_EMAIL=$(echo "$SECRET_CONTENT" | jq -r '.DJANGO_SUPERUSER_EMAIL')
        export DJANGO_SUPERUSER_PASSWORD=$(echo "$SECRET_CONTENT" | jq -r '.DJANGO_SUPERUSER_PASSWORD')
        export DJANGO_SUPERUSER_USERNAME=$(echo "$SECRET_CONTENT" | jq -r '.DJANGO_SUPERUSER_USERNAME')

        echo "Variables exportadas correctamente"
        echo "ALLOWED_HOSTS configurado para: $ALLOWED_HOSTS"

    else
      echo "ERROR FATAL: No se pudo obtener el contenido de Secrets Manager."
      exit 1
    fi
else
    echo "Entorno local o sin AWS CLI. Usando variables de entorno existentes."
fi

if [ -z "$SECRET_KEY" ] || [ -z "$DATABASE_URL" ]; then
    echo "ERROR FATAL: SECRET_KEY o DATABASE_URL están vacías."
    exit 1
fi

echo "✅ Variables de entorno exportadas correctamente."

# Set PORT from environment or default
export PORT=${PORT:-8080}
echo "📊 Puerto configurado: $PORT"
echo "📍 Daphne will bind to 0.0.0.0:$PORT"
echo "🔍 Environment:"
echo "   - RAILWAY_ENVIRONMENT: ${RAILWAY_ENVIRONMENT:-not set}"
echo "   - RAILWAY_SERVICE_NAME: ${RAILWAY_SERVICE_NAME:-not set}"

# Wait for database to be ready
echo "⏳ Esperando a que la base de datos esté lista..."
python -c "
import time
import sys
import os

import dj_database_url
import psycopg2

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
        sys.exit(0)
    except psycopg2.OperationalError as e:
        retry_count += 1
        print(f'⏳ Esperando base de datos... intento {retry_count}/{max_retries}')
        time.sleep(2)

print(f'❌ No se pudo conectar a la base de datos después de {max_retries} intentos')
sys.exit(1)
"

if [ $? -ne 0 ]; then
    echo "❌ Error: No se pudo conectar a la base de datos"
    exit 1
fi

echo "📊 Aplicando migraciones de base de datos..."
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

# [RENDIMIENTO] Antes esto bloqueaba el arranque hasta 60 s en cada deploy o
# reinicio (la app no respondía mientras tanto). Ahora corre en segundo plano.
echo "📤 Reintentando documentos pendientes de subir a Drive (en segundo plano)..."
( timeout 120 python manage.py retry_pending_uploads > /tmp/retry_pending_uploads.log 2>&1 \
    || echo "⚠️ retry_pending_uploads terminó con error/timeout (ver /tmp/retry_pending_uploads.log)" ) &

echo "✅ Configuración completada"
# ============================================================================
# SERVIDOR
# [RENDIMIENTO] Antes: UN solo proceso Daphne para toda la app. En ASGI, Django
# ejecuta las vistas síncronas (todas las de la API) en un único hilo por
# proceso, así que las peticiones de todos los usuarios se atendían en fila:
# si una tardaba (reporte, subida, consulta pesada), las demás esperaban.
# Ahora: Gunicorn con N workers Uvicorn (ASGI, sigue soportando WebSockets).
#   WEB_CONCURRENCY  número de procesos (por defecto 3; súbelo si tu plan de
#                    Railway tiene más RAM; cada proceso usa ~150-250 MB)
#   ASGI_SERVER=daphne  vuelve al servidor anterior si lo necesitas.
# Con varios procesos las notificaciones WebSocket necesitan Redis (REDIS_URL)
# para compartir el channel layer; sin Redis se usa 1 solo proceso.
# ============================================================================
WORKERS="${WEB_CONCURRENCY:-3}"
if [ -z "$REDIS_URL" ]; then
    echo "⚠️ REDIS_URL no definido: se usa 1 proceso para no romper las notificaciones en tiempo real"
    WORKERS=1
fi

echo "✅ Configuración completada"
echo "📍 Health check disponible en http://localhost:$PORT/health/"

if [ $# -eq 0 ] || [ "$1" = "daphne" ] || [ "$1" = "web" ]; then
    if [ "${ASGI_SERVER:-gunicorn}" = "daphne" ]; then
        echo "🚀 Iniciando Daphne en puerto $PORT..."
        exec daphne -b 0.0.0.0 -p "$PORT" \
            --access-log - \
            --proxy-headers \
            --application-close-timeout 300 \
            --ping-interval 20 \
            --ping-timeout 30 \
            config.asgi:application
    fi
    echo "🚀 Iniciando Gunicorn + Uvicorn ($WORKERS procesos) en puerto $PORT..."
    export FORWARDED_ALLOW_IPS="${FORWARDED_ALLOW_IPS:-*}"
    exec gunicorn config.asgi:application \
        --worker-class uvicorn.workers.UvicornWorker \
        --workers "$WORKERS" \
        --bind "0.0.0.0:$PORT" \
        --timeout 300 \
        --graceful-timeout 30 \
        --keep-alive 5 \
        --max-requests 1000 \
        --max-requests-jitter 100 \
        --access-logfile - \
        --forwarded-allow-ips "$FORWARDED_ALLOW_IPS"
else
    exec "$@"
fi
