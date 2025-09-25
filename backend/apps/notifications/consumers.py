import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import Notification

class NotificationConsumer(AsyncWebsocketConsumer):
    """
    Este consumidor maneja la conexión WebSocket para las notificaciones de un usuario,
    incluyendo la interacción con la base de datos.
    """
    async def connect(self):
        self.user = self.scope['user']
        if not self.user.is_authenticated:
            await self.close()
            return

        self.group_name = f'user_{self.user.id}_notifications'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        """
        Se ejecuta cuando se recibe un mensaje desde el frontend.
        Aquí manejamos la lógica para marcar una notificación como leída.
        """
        try:
            data = json.loads(text_data)
            message_type = data.get('type')

            if message_type == 'mark_as_read':
                notification_id = data.get('notification_id')
                if notification_id:
                    await self.mark_notification_as_read(notification_id)
        except json.JSONDecodeError:
            print("Error: Mensaje WebSocket no es un JSON válido.")
        except Exception as e:
            print(f"Error al procesar mensaje WebSocket: {e}")

    async def send_notification(self, event):
        """
        Este método es llamado por el backend para enviar una notificación al frontend.
        """
        message_data = event['message']
        await self.send(text_data=json.dumps({
            'type': 'new_notification',
            'payload': message_data
        }))

    @database_sync_to_async
    def mark_notification_as_read(self, notification_id):
        """
        Busca una notificación por su ID en la base de datos y la marca como leída.
        
        Se usa el decorador @database_sync_to_async porque las operaciones de base de datos
        de Django son síncronas, y necesitamos llamarlas desde un contexto asíncrono.
        """
        try:
            notification = Notification.objects.get(id=notification_id, user=self.user)
            if not notification.is_read:
                notification.is_read = True
                notification.save(update_fields=['is_read'])
                print(f"Notificación {notification_id} marcada como leída para el usuario {self.user.id}.")
        except Notification.DoesNotExist:
            print(f"Intento de marcar como leída una notificación no válida ({notification_id}) por el usuario {self.user.id}.")
            pass