"""
IP real del cliente detrás de los proxies de Railway.

Antes se usaba `ipware.get_client_ip` con su orden por defecto (primer valor
de X-Forwarded-For). Ese valor puede venir del propio cliente, así que la IP
usada para bloquear fuerza bruta, limitar peticiones y validar `allowed_ips`
podía falsificarse (e incluso hacer bloquear la IP de otra persona). Además
django-ratelimit usaba REMOTE_ADDR, que detrás del proxy es la IP del proxy:
todos los usuarios compartían el mismo cupo de login.

Cadena en producción:
  navegador -> borde de Railway -> nginx del frontend -> backend (red privada)
  navegador -> borde de Railway -> backend (dominio público del backend)

El borde de Railway escribe `X-Real-IP` con la IP que se conectó y descarta
la que mande el cliente; el nginx del frontend la reenvía tal cual. Por eso se
usa ese encabezado (configurable con CLIENT_IP_HEADER).

Si el valor recibido no es una IP pública (p. ej. 100.64.x.x, la IP interna
del borde, mientras el nginx del frontend aún no esté actualizado), se cae al
primer valor público de X-Forwarded-For, que es el comportamiento anterior.
"""
import ipaddress

from django.conf import settings
from rest_framework import throttling


def _clean(value):
    value = (value or '').strip()
    if not value:
        return None
    try:
        return str(ipaddress.ip_address(value))
    except ValueError:
        return None


def _is_public(ip):
    try:
        return ipaddress.ip_address(ip).is_global
    except ValueError:
        return False


def get_client_ip(request):
    """Devuelve la IP del cliente o None. Acepta HttpRequest o Request de DRF."""
    meta = getattr(request, 'META', {}) or {}
    header = getattr(settings, 'CLIENT_IP_META_KEY', '')
    trusted = _clean(meta.get(header)) if header else None
    if trusted and _is_public(trusted):
        return trusted
    # Compatibilidad: proxy intermedio que todavía no reenvía X-Real-IP.
    for part in (meta.get('HTTP_X_FORWARDED_FOR') or '').split(','):
        ip = _clean(part)
        if ip and _is_public(ip):
            return ip
    return trusted or _clean(meta.get('REMOTE_ADDR'))


class _ClientIPIdentMixin:
    """Los throttles de DRF identifican por X-Forwarded-For completo, que el
    cliente puede rotar para saltarse el límite. Se usa la IP de confianza."""

    def get_ident(self, request):
        return get_client_ip(request) or 'unknown'


class AnonRateThrottle(_ClientIPIdentMixin, throttling.AnonRateThrottle):
    pass


class UserRateThrottle(_ClientIPIdentMixin, throttling.UserRateThrottle):
    pass


class ScopedRateThrottle(_ClientIPIdentMixin, throttling.ScopedRateThrottle):
    pass


def ratelimit_ip(request):
    """Para RATELIMIT_IP_META_KEY de django-ratelimit (no acepta None)."""
    return get_client_ip(request) or '0.0.0.0'
