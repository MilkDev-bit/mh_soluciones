# Generated migration for security enhancements

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('authentication', '0002_customuser_last_activity_customuser_last_login_ip'),
    ]

    operations = [
        migrations.AddField(
            model_name='customuser',
            name='password_changed_at',
            field=models.DateTimeField(blank=True, null=True, verbose_name='Contraseña Cambiada En'),
        ),
        migrations.AddField(
            model_name='customuser',
            name='failed_login_attempts',
            field=models.IntegerField(default=0, verbose_name='Intentos Fallidos de Login'),
        ),
        migrations.AddField(
            model_name='customuser',
            name='account_locked_until',
            field=models.DateTimeField(blank=True, null=True, verbose_name='Cuenta Bloqueada Hasta'),
        ),
        migrations.AddField(
            model_name='customuser',
            name='force_password_change',
            field=models.BooleanField(default=False, verbose_name='Forzar Cambio de Contraseña'),
        ),
        # Note: GoogleApiCredentials fields are already TextField in the database
        # The encryption/decryption is handled at the application level
    ]
