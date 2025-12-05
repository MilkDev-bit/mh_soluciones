#!/bin/sh

set -e
set -x

echo "Iniciando entrypoint..."

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

echo "Variables de entorno exportadas correctamente."

echo "Aplicando migraciones de base de datos..."
python manage.py migrate --noinput

echo "Creando superusuario si no existe..."
python manage.py shell -c "
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username='$DJANGO_SUPERUSER_USERNAME').exists():
    User.objects.create_superuser('$DJANGO_SUPERUSER_USERNAME', '$DJANGO_SUPERUSER_EMAIL', '$DJANGO_SUPERUSER_PASSWORD')
    print('Superusuario creado exitosamente')
else:
    print('Superusuario ya existe')
"

echo "Iniciando servidor Daphne para Django Channels..."

exec "$@"