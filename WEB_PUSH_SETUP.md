# Web Push Notifications Setup Guide

## Overview
This application implements Web Push Notifications using VAPID (Voluntary Application Server Identification) for secure push notification delivery to users.

## Prerequisites
- Python backend with Django
- React frontend
- HTTPS connection (required for service workers and push notifications)
- Modern browser with Push API support

## Backend Setup

### 1. Generate VAPID Keys

You need to generate a pair of VAPID keys (public and private). You can use the `py-vapid` library:

```bash
# Install py-vapid if not already installed
pip install py-vapid

# Generate VAPID keys
vapid --gen

# Or using Python
python -c "from py_vapid import Vapid; vapid = Vapid(); vapid.generate_keys(); print(f'VAPID_PRIVATE_KEY={vapid.private_key.decode()}'); print(f'VAPID_PUBLIC_KEY={vapid.public_key.decode()}')"
```

This will output two keys:
- **Private Key**: Keep this SECRET and never expose it in frontend code or commits
- **Public Key**: This can be safely shared with the frontend

### 2. Configure Environment Variables

Set the following environment variables in your Railway or deployment environment:

```bash
# VAPID Configuration
VAPID_SUBJECT=mailto:your-email@example.com  # Or your website URL
VAPID_PRIVATE_KEY=your-generated-private-key
VAPID_PUBLIC_KEY=your-generated-public-key
```

**Important Notes:**
- `VAPID_SUBJECT` should be either a `mailto:` URI (e.g., `mailto:admin@example.com`) or your website URL (e.g., `https://yoursite.com`)
- Never commit these keys to version control
- The private key must remain secret on the server side only

### 3. Install Dependencies

The required Python package is already included in `requirements/base.txt`:

```
pywebpush==1.14.0
```

Run:
```bash
pip install -r requirements/base.txt
```

### 4. Run Migrations

Apply the database migrations to create the `PushSubscription` table:

```bash
python manage.py migrate notifications
```

### 5. Verify Setup

When the Django application starts, it will validate the VAPID configuration and log any missing variables.

## Frontend Setup

### 1. Service Worker Registration

The service worker is automatically registered in `main.jsx` when the application loads. No additional configuration needed.

### 2. Request Notification Permission

Users can enable push notifications from their profile page (Security tab). The component will:
1. Check browser compatibility
2. Request notification permission
3. Subscribe to push notifications
4. Send the subscription to the backend

### 3. Browser Compatibility

The application checks for:
- `serviceWorker` support in Navigator
- `PushManager` support in Window

Supported browsers:
- Chrome/Edge 42+
- Firefox 44+
- Safari 16+ (with some limitations)
- Opera 29+

## API Endpoints

### 1. Get VAPID Public Key
```
GET /api/v1/notifications/push/vapid-public-key/
```
Returns the VAPID public key needed for client-side subscription.

**Response:**
```json
{
  "public_key": "BMn8..."
}
```

### 2. Subscribe to Push Notifications
```
POST /api/v1/notifications/push/subscriptions/
```

**Request Body:**
```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/...",
  "p256dh": "BKgb...",
  "auth": "8nC..."
}
```

**Response:**
```json
{
  "id": 1,
  "endpoint": "https://fcm.googleapis.com/fcm/send/...",
  "is_active": true,
  "created_at": "2025-12-16T10:00:00Z"
}
```

### 3. Send Push Notification
```
POST /api/v1/notifications/push/send/
```

**Request Body:**
```json
{
  "title": "Notification Title",
  "body": "Notification message",
  "icon": "/icons/icon-192x192.png",
  "url": "/dashboard",
  "tag": "notification-tag",
  "user_ids": [1, 2, 3]  // Optional: staff only
}
```

**Response:**
```json
{
  "status": "sent",
  "statistics": {
    "total_users": 3,
    "users_notified": 2,
    "users_failed": 1
  }
}
```

### 4. Send Test Notification
```
POST /api/v1/notifications/push/subscriptions/send_test/
```

Sends a test notification to the authenticated user.

### 5. Unsubscribe
```
POST /api/v1/notifications/push/subscriptions/unsubscribe/
```

**Request Body (optional):**
```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/..."
}
```

If no endpoint is provided, all user subscriptions are deactivated.

## Usage Examples

### Sending Notifications from Python Code

```python
from apps.notifications.push_utils import send_notification_to_user

# Send to a single user
notification_data = {
    'title': 'New Task Assigned',
    'body': 'You have been assigned a new task',
    'icon': '/icons/task.png',
    'url': '/tasks/123',
    'tag': 'task-notification'
}

send_notification_to_user(user, notification_data)
```

### Sending to Multiple Users

```python
from apps.notifications.push_utils import send_notification_to_multiple_users
from django.contrib.auth import get_user_model

User = get_user_model()
users = User.objects.filter(role='ADMIN')

notification_data = {
    'title': 'System Alert',
    'body': 'Important system maintenance scheduled',
    'icon': '/icons/alert.png'
}

stats = send_notification_to_multiple_users(list(users), notification_data)
print(f"Notified {stats['users_notified']} users")
```

## Security Considerations

1. **HTTPS Required**: Service workers and push notifications only work over HTTPS
2. **Private Key Protection**: Never expose the VAPID private key in:
   - Frontend code
   - Git commits
   - Client-side API responses
   - Browser console logs

3. **Permission-based Access**: Only staff users can send notifications to other users

4. **Subscription Validation**: Invalid subscriptions are automatically deactivated

5. **Origin Validation**: Service worker scope ensures notifications only work from your domain

## Testing

### Manual Testing

1. Navigate to Profile → Security tab
2. Toggle "Push Notifications" on
3. Grant permission in browser prompt
4. Click "Send Test Notification"
5. Verify notification appears

### Common Issues

**Notifications not appearing:**
- Check browser permission settings
- Verify VAPID keys are correctly configured
- Check browser console for errors
- Ensure HTTPS is enabled

**Service Worker not registering:**
- Clear browser cache
- Check `/custom-sw.js` is accessible
- Verify no service worker conflicts

**Subscription failing:**
- Check backend logs for VAPID errors
- Verify VAPID_SUBJECT format
- Ensure database migrations are applied

## Production Deployment

### Railway Configuration

Add environment variables in Railway dashboard:

1. Go to your project settings
2. Navigate to Variables
3. Add:
   - `VAPID_SUBJECT`
   - `VAPID_PRIVATE_KEY`
   - `VAPID_PUBLIC_KEY`

### Monitoring

- Monitor push subscription counts in Django Admin
- Check logs for failed notification deliveries
- Set up alerts for VAPID configuration errors

## Browser Support Matrix

| Browser | Version | Support Level |
|---------|---------|---------------|
| Chrome  | 42+     | Full          |
| Firefox | 44+     | Full          |
| Safari  | 16+     | Partial*      |
| Edge    | 17+     | Full          |
| Opera   | 29+     | Full          |

*Safari has some limitations with notification interactions

## References

- [Web Push Protocol](https://datatracker.ietf.org/doc/html/rfc8030)
- [VAPID Specification](https://datatracker.ietf.org/doc/html/rfc8292)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
