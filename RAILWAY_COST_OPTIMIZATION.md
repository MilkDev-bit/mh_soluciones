# 💰 Guía de Optimización de Costos en Railway

## 📊 Resumen de Costos

Railway ofrece una estructura de precios transparente basada en uso de recursos.

### 💳 Planes Disponibles

| Plan | Precio Base | Créditos Incluidos | Recursos |
|------|-------------|---------------------|----------|
| **Trial** | Gratis | $5 crédito único | Limitado, ideal para pruebas |
| **Developer** | $5/mes | $5 en créditos | Para proyectos pequeños |
| **Hobby** | $0/mes | $0 | Paga solo por uso |
| **Pro** | $20/mes | $20 en créditos | Recursos adicionales |
| **Team** | Custom | Custom | Para equipos |

### 💡 Modelo de Facturación

Railway factura por **uso real** de recursos:

```
Costo Mensual = (Uso de CPU × Precio CPU) + (Uso de RAM × Precio RAM) + 
                (Uso de Disco × Precio Disco) + (Transferencia × Precio Transferencia)
```

#### Precios por Recurso (2024)

| Recurso | Precio | Unidad |
|---------|--------|--------|
| **vCPU** | $0.000463/min | ~$20/mes por vCPU completa |
| **RAM** | $0.000231/GB/min | ~$10/mes por GB |
| **Disco (Volume)** | $0.25/GB/mes | Fijo por GB |
| **Transferencia** | Incluida | Hasta 100 GB/mes gratis |

---

## 🎯 Estimación de Costos para MH Soluciones

### Escenario 1: Startup / Desarrollo (Recomendado para comenzar)

**Plan**: Developer ($5/mes) o Hobby (pay-as-you-go)

#### Recursos Utilizados

| Servicio | CPU | RAM | Disco | Costo Estimado |
|----------|-----|-----|-------|----------------|
| **Backend** | 0.25 vCPU | 512 MB | - | ~$7/mes |
| **Frontend** | 0.1 vCPU | 256 MB | - | ~$3/mes |
| **PostgreSQL** | Plugin | Plugin | 1 GB | Incluido* |
| **Redis** | Plugin | Plugin | 256 MB | Incluido* |
| **Volume** | - | - | 10 GB | $2.50/mes |
| **Total** | | | | **~$12.50/mes** |

\* Los plugins de PostgreSQL y Redis están incluidos en el plan con límites razonables

### Escenario 2: Producción Pequeña-Media

**Plan**: Hobby o Pro ($20/mes con créditos)

#### Recursos Utilizados

| Servicio | CPU | RAM | Disco | Costo Estimado |
|----------|-----|-----|-------|----------------|
| **Backend** | 0.5 vCPU | 1 GB | - | ~$15/mes |
| **Frontend** | 0.25 vCPU | 512 MB | - | ~$7/mes |
| **PostgreSQL** | Plugin | Plugin | 5 GB | Incluido* |
| **Redis** | Plugin | Plugin | 512 MB | Incluido* |
| **Volume** | - | - | 50 GB | $12.50/mes |
| **Total** | | | | **~$34.50/mes** |

**Con Plan Pro**: $20/mes + $14.50 adicional = **$34.50/mes total**

### Escenario 3: Producción con Alto Tráfico

**Plan**: Pro ($20/mes) + recursos adicionales

#### Recursos Utilizados

| Servicio | CPU | RAM | Disco | Costo Estimado |
|----------|-----|-----|-------|----------------|
| **Backend (2 instancias)** | 1 vCPU × 2 | 2 GB × 2 | - | ~$60/mes |
| **Frontend** | 0.5 vCPU | 1 GB | - | ~$15/mes |
| **PostgreSQL** | Plugin | Plugin | 10 GB | $10/mes |
| **Redis** | Plugin | Plugin | 1 GB | $5/mes |
| **Volume** | - | - | 100 GB | $25/mes |
| **Total** | | | | **~$115/mes** |

---

## 💡 Estrategias de Optimización

### 1. 🔧 Optimización de Recursos

#### Backend (Django)

**Reducir uso de CPU y RAM**:

```python
# config/settings/railway.py

# 1. Usar Gunicorn en lugar de Daphne si no necesitas WebSockets
# CMD: gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --threads 4

# 2. Optimizar workers de Gunicorn
WORKERS = 2  # En lugar de auto-detectar
THREADS = 4  # Multithreading reduce RAM

# 3. Configurar timeouts
TIMEOUT = 30  # Terminar requests lentas

# 4. Usar connection pooling agresivo
DATABASES = {
    'default': {
        # ...
        'CONN_MAX_AGE': 600,  # 10 minutos
        'OPTIONS': {
            'connect_timeout': 10,
            'options': '-c statement_timeout=30000'  # 30s timeout
        }
    }
}

# 5. Configurar cache agresivamente
CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': os.environ.get('REDIS_URL'),
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
        },
        'KEY_PREFIX': 'mh_cache',
        'TIMEOUT': 300,  # 5 minutos por defecto
    }
}
```

**Dockerfile optimizado**:

```dockerfile
# backend/Dockerfile

FROM python:3.10-slim-bookworm

# Reducir tamaño de imagen
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1
ENV PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Solo instalar dependencias necesarias
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libpq-dev \
        gcc && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Instalar requirements
COPY requirements/base.txt .
RUN pip install --no-cache-dir -r base.txt && \
    rm -rf /root/.cache

COPY . .

# Collectstatic en build (no en runtime)
RUN SECRET_KEY=dummy python manage.py collectstatic --noinput

EXPOSE 8000
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "2", "--threads", "4"]
```

#### Frontend (React + Nginx)

**Ya está optimizado**, pero puedes:

```nginx
# frontend/nginx.conf

# 1. Incrementar cache de assets
location /assets/ {
    expires 1y;  # Ya está
    add_header Cache-Control "public, immutable";
}

# 2. Comprimir más agresivamente
gzip_comp_level 6;  # Nivel 6 (balance entre CPU y compresión)
gzip_min_length 256;  # Comprimir archivos >256 bytes

# 3. Usar HTTP/2 (si Railway lo soporta)
listen 8080 http2;
```

### 2. 📦 Optimización de Almacenamiento

#### Railway Volumes

**Monitorear y limpiar**:

```bash
# Crear script de limpieza (backend/scripts/cleanup_media.py)
"""
Script para limpiar archivos media antiguos
"""
import os
from datetime import datetime, timedelta
from django.core.management.base import BaseCommand
from django.conf import settings

class Command(BaseCommand):
    def handle(self, *args, **options):
        # Eliminar archivos temporales mayores a 7 días
        media_root = settings.MEDIA_ROOT
        cutoff = datetime.now() - timedelta(days=7)
        
        for root, dirs, files in os.walk(media_root):
            for file in files:
                filepath = os.path.join(root, file)
                if os.path.getmtime(filepath) < cutoff.timestamp():
                    os.remove(filepath)
                    self.stdout.write(f"Deleted: {filepath}")
```

**Ejecutar periódicamente con Celery**:

```python
# backend/apps/core/tasks.py
from celery import shared_task
from django.core.management import call_command

@shared_task
def cleanup_old_media():
    call_command('cleanup_media')
```

#### Cloudflare R2 (Alternativa económica)

Si necesitas más de 50 GB, considera **Cloudflare R2**:

```
Costo por 100 GB:
- Railway Volume: $25/mes
- Cloudflare R2: $1.50/mes + operaciones

Ahorro: ~$23.50/mes (94%)
```

### 3. 🗄️ Optimización de Base de Datos

#### PostgreSQL

**Indexar correctamente**:

```python
# models.py

class Document(models.Model):
    # ...
    
    class Meta:
        indexes = [
            models.Index(fields=['created_at']),  # Para queries ordenadas
            models.Index(fields=['user', '-created_at']),  # Composite index
            models.Index(fields=['project', 'status']),  # Filtros comunes
        ]
```

**Usar select_related y prefetch_related**:

```python
# Antes (N+1 queries)
documents = Document.objects.all()
for doc in documents:
    print(doc.user.username)  # 1 query por documento

# Después (2 queries total)
documents = Document.objects.select_related('user').all()
for doc in documents:
    print(doc.user.username)  # Sin queries adicionales
```

**Limitar tamaño de base de datos**:

```python
# Archivar datos antiguos
from django.utils import timezone
from datetime import timedelta

# Mover datos antiguos a tabla de archivo
old_cutoff = timezone.now() - timedelta(days=365)
old_documents = Document.objects.filter(created_at__lt=old_cutoff)
# Exportar a S3 o eliminar según política
```

### 4. 🔴 Optimización de Redis

**Configurar expiración de keys**:

```python
# settings/railway.py

CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': REDIS_URL,
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
            'MAX_ENTRIES': 10000,  # Límite de entries
            'CULL_FREQUENCY': 4,  # Eliminar 1/4 cuando se llena
        }
    }
}

# Usar cache con timeout
from django.core.cache import cache

def get_user_data(user_id):
    key = f'user_data_{user_id}'
    data = cache.get(key)
    if data is None:
        data = User.objects.get(id=user_id)
        cache.set(key, data, timeout=300)  # 5 minutos
    return data
```

### 5. 📉 Reducir Costos de Transferencia

**CDN para archivos estáticos** (si necesitas):

```
Cloudflare (GRATIS):
- Cachea archivos estáticos automáticamente
- Reduce transferencia desde Railway
- Mejora velocidad global
```

**Configuración**:

1. Agregar dominio a Cloudflare
2. Activar "Auto Minify" para JS, CSS, HTML
3. Activar "Rocket Loader" para JS
4. Configurar reglas de cache:

```
Cache Level: Standard
Browser Cache TTL: 1 year
Edge Cache TTL: 1 month
```

### 6. ⚙️ Auto-Scaling Inteligente

**Escalar solo cuando sea necesario**:

```yaml
# railway.json (futuro)
{
  "autoscaling": {
    "minReplicas": 1,
    "maxReplicas": 3,
    "targetCPUUtilization": 70,
    "targetMemoryUtilization": 80
  }
}
```

**Por ahora**, monitorea manualmente:
- Si CPU > 80% constantemente → Escalar
- Si RAM > 90% constantemente → Escalar
- Si latencia > 500ms → Optimizar o escalar

---

## 📊 Monitoreo de Costos

### Railway Dashboard

1. **Usage Tab**: Ver uso de recursos en tiempo real
2. **Metrics Tab**: CPU, RAM, Network usage
3. **Billing Tab**: Costos acumulados del mes

### Alertas Recomendadas

```bash
# Configurar alertas cuando:
- Costo mensual > $30
- CPU > 80% por 30 minutos
- RAM > 90% por 30 minutos
- Disco > 80% de capacidad
```

### Herramientas de Monitoreo

**Gratuitas**:
- **UptimeRobot**: Monitoreo de uptime (50 monitors gratis)
- **Better Uptime**: Monitoreo de status pages (10 monitors gratis)

**Pagas pero valiosas**:
- **Sentry**: Error tracking ($26/mes para 50K eventos)
- **New Relic**: APM monitoring (gratis hasta 100 GB/mes)

---

## 💰 Comparación de Costos: AWS vs Railway

### Configuración Equivalente

| Servicio | AWS | Railway |
|----------|-----|---------|
| **Compute (Backend)** | EC2 t3.small | 0.5 vCPU, 1 GB RAM |
| **Compute (Frontend)** | EC2 t3.micro | 0.25 vCPU, 512 MB |
| **Database** | RDS db.t3.micro | PostgreSQL Plugin |
| **Cache** | ElastiCache t3.micro | Redis Plugin |
| **Storage** | S3 (100 GB) | Volume (50 GB) |
| **Load Balancer** | ALB | Incluido |
| **SSL Certificate** | ACM (gratis) | Incluido |

#### Costos Mensuales

| | AWS | Railway |
|---|-----|---------|
| **Compute** | $30 (EC2) | $22 |
| **Database** | $15 (RDS) | Incluido |
| **Cache** | $12 (ElastiCache) | Incluido |
| **Storage** | $3 (S3) | $12.50 |
| **Load Balancer** | $18 (ALB) | Incluido |
| **Transferencia** | $9 (100 GB) | Incluido |
| **Total** | **$87/mes** | **$34.50/mes** |

**Ahorro**: $52.50/mes = **60% menos**

---

## 🎯 Recomendaciones Finales

### Para Comenzar (Mes 1-3)

1. **Plan**: Developer ($5/mes) o Hobby
2. **Recursos**: Mínimos (Backend: 512 MB, Frontend: 256 MB)
3. **Storage**: Railway Volume (10 GB)
4. **Costo estimado**: $10-15/mes

### Producción Estable (Mes 4+)

1. **Plan**: Hobby o Pro ($20/mes si necesitas soporte)
2. **Recursos**: Ajustar según métricas reales
3. **Storage**: Railway Volume (30-50 GB) o migrar a Cloudflare R2
4. **Costo estimado**: $25-40/mes

### Escalamiento (Alto tráfico)

1. **Plan**: Pro ($20/mes)
2. **Backend**: Múltiples instancias con auto-scaling
3. **Storage**: Cloudflare R2 (más económico a escala)
4. **CDN**: Cloudflare (gratis)
5. **Costo estimado**: $60-100/mes

---

## 📈 ROI Estimado

### Comparación con AWS

```
Ahorro anual: ($87 - $35) × 12 = $624/año

Con escalamiento:
AWS: ~$150/mes = $1,800/año
Railway: ~$70/mes = $840/año
Ahorro: $960/año (53%)
```

### Tiempo de Desarrollo

```
Setup Railway: 2-4 horas
Setup AWS: 2-3 días

Ahorro de tiempo: ~16 horas
Valor (@ $50/hora): $800
```

**Total ROI primer año**: $624 (ahorro) + $800 (tiempo) = **$1,424**

---

## ✅ Checklist de Optimización

- [ ] Dockerfile optimizado (imagen pequeña, build cache)
- [ ] Gunicorn con workers/threads optimizados
- [ ] Database connection pooling configurado
- [ ] Redis cache configurado y usado
- [ ] Queries optimizadas (select_related, prefetch_related)
- [ ] Indexes en base de datos
- [ ] Cloudflare CDN configurado (si necesario)
- [ ] Limpieza automática de archivos antiguos
- [ ] Monitoreo de costos configurado
- [ ] Alertas de uso de recursos
- [ ] Logs centralizados (opcional)
- [ ] Error tracking (Sentry)

---

**Última actualización**: Diciembre 2024
**Versión**: 1.0
