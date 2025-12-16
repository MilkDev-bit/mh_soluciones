# Quick Start: Web Push Notifications

## Generate VAPID Keys

Run this command to generate VAPID keys:

```bash
python -c "from py_vapid import Vapid; vapid = Vapid(); vapid.generate_keys(); print(f'VAPID_PRIVATE_KEY={vapid.private_key.decode()}'); print(f'VAPID_PUBLIC_KEY={vapid.public_key.decode()}')"
```

Or install and use the vapid CLI:

```bash
pip install py-vapid
vapid --gen
```

## Configure Railway Environment Variables

Add these to your Railway project:

```
VAPID_SUBJECT=mailto:your-email@mhsolucionesempresariales.com
VAPID_PRIVATE_KEY=[your-generated-private-key]
VAPID_PUBLIC_KEY=[your-generated-public-key]
```

## Run Migrations

```bash
python manage.py migrate notifications
```

## Test the Implementation

1. Login to the application
2. Go to Profile → Security tab
3. Toggle "Push Notifications" on
4. Grant browser permission when prompted
5. Click "Send Test Notification"
6. Verify you receive the notification

## API Endpoints

- `GET /api/v1/notifications/push/vapid-public-key/` - Get public key
- `POST /api/v1/notifications/push/subscriptions/` - Subscribe
- `POST /api/v1/notifications/push/send/` - Send notification
- `POST /api/v1/notifications/push/subscriptions/send_test/` - Test
- `POST /api/v1/notifications/push/subscriptions/unsubscribe/` - Unsubscribe

## Send Notifications from Code

```python
from apps.notifications.push_utils import send_notification_to_user

notification_data = {
    'title': 'Task Assigned',
    'body': 'You have a new task',
    'icon': '/icons/task.png',
    'url': '/tasks/123'
}

send_notification_to_user(user, notification_data)
```

## Troubleshooting

- **Notifications not working**: Check VAPID env vars are set
- **Service worker errors**: Clear cache and reload
- **Permission denied**: Check browser notification settings
- **500 errors**: Verify migrations have been run

For detailed documentation, see [WEB_PUSH_SETUP.md](./WEB_PUSH_SETUP.md)
