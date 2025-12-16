# Generated manually for constraint update

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('notifications', '0002_alter_notification_notification_type_and_more'),
    ]

    operations = [
        migrations.AlterUniqueTogether(
            name='pushsubscription',
            unique_together=set(),
        ),
        migrations.AddConstraint(
            model_name='pushsubscription',
            constraint=models.UniqueConstraint(fields=['user', 'endpoint'], name='unique_user_endpoint'),
        ),
    ]
