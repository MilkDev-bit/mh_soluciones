"""
Utilidades para Web Push Notifications con VAPID.
"""
import os
import json
import logging
from typing import Dict, Optional, List
from pywebpush import webpush, WebPushException
from django.conf import settings

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


def send_push_notification(
    subscription_info: Dict,
    data: Dict,
    ttl: int = 3600
) -> bool:
    """
    Envía una notificación push usando pywebpush.
    
    Args:
        subscription_info: Diccionario con endpoint, keys.p256dh y keys.auth
        data: Datos a enviar en la notificación (será convertido a JSON)
        ttl: Tiempo de vida de la notificación en segundos (default: 1 hora)
    
    Returns:
        bool: True si se envió exitosamente, False si hubo error
    """
    if not vapid_config.is_valid():
        logger.error("Cannot send push notification: VAPID configuration is invalid")
        return False
    
    try:
        # Preparar los datos de la notificación
        notification_data = json.dumps(data)
        
        # Enviar la notificación
        response = webpush(
            subscription_info=subscription_info,
            data=notification_data,
            vapid_private_key=vapid_config.private_key,
            vapid_claims={
                "sub": vapid_config.subject
            },
            ttl=ttl
        )
        
        logger.info(f"Push notification sent successfully. Status: {response.status_code}")
        return True
        
    except WebPushException as e:
        logger.error(f"WebPush error: {e}")
        # Si es un error 410 (Gone), la suscripción ya no es válida
        if e.response and e.response.status_code == 410:
            logger.warning("Subscription is no longer valid (410 Gone)")
        return False
        
    except Exception as e:
        logger.error(f"Error sending push notification: {e}")
        return False


def send_notification_to_user(user, notification_data: Dict) -> int:
    """
    Envía una notificación push a todas las suscripciones activas de un usuario.
    
    Args:
        user: Instancia del modelo User
        notification_data: Datos de la notificación (title, body, icon, etc.)
    
    Returns:
        int: Número de notificaciones enviadas exitosamente
    """
    from apps.notifications.models import PushSubscription
    
    if not vapid_config.is_valid():
        logger.warning("VAPID not configured, skipping push notifications")
        return 0
    
    # Obtener todas las suscripciones activas del usuario
    subscriptions = PushSubscription.objects.filter(
        user=user,
        is_active=True
    )
    
    sent_count = 0
    invalid_subscriptions = []
    
    for subscription in subscriptions:
        # Preparar la información de suscripción en el formato esperado por pywebpush
        subscription_info = {
            "endpoint": subscription.endpoint,
            "keys": {
                "p256dh": subscription.p256dh,
                "auth": subscription.auth
            }
        }
        
        # Intentar enviar la notificación
        success = send_push_notification(subscription_info, notification_data)
        
        if success:
            sent_count += 1
        else:
            # Marcar suscripciones inválidas para desactivarlas
            invalid_subscriptions.append(subscription.id)
    
    # Desactivar suscripciones inválidas
    if invalid_subscriptions:
        PushSubscription.objects.filter(
            id__in=invalid_subscriptions
        ).update(is_active=False)
        logger.info(f"Deactivated {len(invalid_subscriptions)} invalid subscriptions")
    
    logger.info(f"Sent {sent_count} push notifications to user {user.username}")
    return sent_count


def send_notification_to_multiple_users(users: List, notification_data: Dict) -> Dict:
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
