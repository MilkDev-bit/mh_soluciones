from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('authentication', '0005_blockedip'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='loginactivity',
            index=models.Index(
                fields=['user', 'timestamp'],
                name='loginact_user_ts_idx',
            ),
        ),
        migrations.AddIndex(
            model_name='loginactivity',
            index=models.Index(
                fields=['successful', 'timestamp'],
                name='loginact_success_ts_idx',
            ),
        ),
    ]
