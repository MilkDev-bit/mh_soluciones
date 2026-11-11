"""
Utilidades para Web Push Notifications con VAPID.
"""
import os
import json
import logging
from typing import Dict, Optional, List, TYPE_CHECKING
from pywebpush import webpush, WebPushException
from django.conf import settings

if TYPE_CHECKING:
    from django.contrib.auth.models import User

logger = logging.getLogger(__name__)


class VAPIDConfig:
    """
    Configuración de VAPID obtenida de variables de entorno.
    """
    def __init__(self):
        self.subject = os.environ.get('VAPID_SUBJECT')
        self.public_key = os.environ.get('VAPID_PUBLIC_KEY')
        self.private_key = os.environ.get('VAPID_PRIVATE_KEY')
        
    def is_valid(self) -> bool:
        """
        Verifica que todas las credenciales VAPID estén configuradas.
        """
        return bool(
            self.subject and 
            self.public_key and 
            self.private_key and
            self.subject.strip() and
            self.public_key.strip() and
            self.private_key.strip()
        )
    
    def get_public_key(self) -> Optional[str]:
        """
        Retorna la clave pública VAPID.
        """
        return self.public_key if self.is_valid() else None
    
    def validate_on_startup(self):
        """
        Valida que las variables de entorno VAPID existan al iniciar.
        Lanza una advertencia si no están configuradas.
        """
        if not self.is_valid():
            missing = []
            if not self.subject or not self.subject.strip():
                missing.append('VAPID_SUBJECT')
            if not self.public_key or not self.public_key.strip():
                missing.append('VAPID_PUBLIC_KEY')
            if not self.private_key or not self.private_key.strip():
                missing.append('VAPID_PRIVATE_KEY')
            
            logger.warning(
                f"VAPID configuration incomplete. Missing variables: {', '.join(missing)}. "
                "Web Push Notifications will not work until these are configured."
            )
            return False
        
        logger.info("VAPID configuration validated successfully.")
        return True


# Instancia global de configuración VAPID
vapid_config = VAPIDConfig()


# Códigos del servicio push que significan "esta suscripción ya no sirve".
GONE_STATUSES = (404, 410)


def deliver_push(subscription_info: Dict, data: Dict, ttl: int = 3600) -> Dict:
    """
    Envía una notificación push y devuelve el detalle del resultado:
    {'ok': bool, 'status': int|None, 'reason': str}.
    """
    if not vapid_config.is_valid():
        return {'ok': False, 'status': None, 'reason': 'VAPID no configurado'}

    try:
        response = webpush(
            subscription_info=subscription_info,
            data=json.dumps(data),
            vapid_private_key=vapid_config.private_key,
            vapid_claims={"sub": vapid_config.subject},
            ttl=ttl,
        )
        logger.info(f"Push notification sent successfully. Status: {response.status_code}")
        return {'ok': True, 'status': response.status_code, 'reason': ''}

    except WebPushException as e:
        # [FIX] `if e.response and ...` nunca era verdadero: un Response con
        # 4xx se evalúa como False. Hay que comparar con None.
        resp = getattr(e, 'response', None)
        status_code = resp.status_code if resp is not None else None
        body = ''
        if resp is not None:
            try:
                body = (resp.text or '')[:300]
            except Exception:
                body = ''
        logger.error(f"WebPush error ({status_code}): {e} {body}")
        return {'ok': False, 'status': status_code, 'reason': body or str(e)[:300]}

    except Exception as e:
        logger.error(f"Error sending push notification: {e}")
        return {'ok': False, 'status': None, 'reason': str(e)[:300]}


def send_push_notification(subscription_info: Dict, data: Dict, ttl: int = 3600) -> bool:
    """Compatibilidad: True si se envió."""
    return deliver_push(subscription_info, data, ttl)['ok']


def send_notification_to_user_detailed(user: 'User', notification_data: Dict) -> Dict:
    """
    Envía a todas las suscripciones activas del usuario.
    Devuelve {'active': n, 'sent': n, 'failures': [{'status', 'reason'}]}.

    [FIX] Antes CUALQUIER falla (un 500 momentáneo del servicio push, un
    error de red, una clave VAPID mal configurada) desactivaba la suscripción
    para siempre: después de eso "Enviar prueba" respondía 400 aunque el
    navegador siguiera suscrito. Ahora solo se desactiva cuando el servicio
    push dice que ya no existe (404/410).
    """
    from apps.notifications.models import PushSubscription

    result = {'active': 0, 'sent': 0, 'failures': []}
    if not vapid_config.is_valid():
        logger.warning("VAPID not configured, skipping push notifications")
        return result

    subscriptions = list(PushSubscription.objects.filter(user=user, is_active=True))
    result['active'] = len(subscriptions)
    gone = []

    for subscription in subscriptions:
        outcome = deliver_push({
            "endpoint": subscription.endpoint,
            "keys": {"p256dh": subscription.p256dh, "auth": subscription.auth},
        }, notification_data)
        if outcome['ok']:
            result['sent'] += 1
            continue
        result['failures'].append({'status': outcome['status'], 'reason': outcome['reason']})
        if outcome['status'] in GONE_STATUSES:
            gone.append(subscription.id)

    if gone:
        PushSubscription.objects.filter(id__in=gone).update(is_active=False)
        logger.info(f"Deactivated {len(gone)} expired subscriptions")

    logger.info(f"Sent {result['sent']} push notifications to user {user.username}")
    return result


def send_notification_to_user(user: 'User', notification_data: Dict) -> int:
    """Número de notificaciones enviadas (compatibilidad)."""
    return send_notification_to_user_detailed(user, notification_data)['sent']


def send_notification_to_multiple_users(users: List['User'], notification_data: Dict) -> Dict:
    """
    Envía una notificación push a múltiples usuarios.
    
    Args:
        users: Lista de instancias del modelo User
        notification_data: Datos de la notificación
    
    Returns:
        dict: Estadísticas del envío (total_users, total_sent, total_failed)
    """
    total_users = len(users)
    total_sent = 0
    
    for user in users:
        sent_count = send_notification_to_user(user, notification_data)
        if sent_count > 0:
            total_sent += 1
    
    stats = {
        'total_users': total_users,
        'users_notified': total_sent,
        'users_failed': total_users - total_sent
    }
    
    logger.info(f"Bulk notification sent: {stats}")
    return stats
