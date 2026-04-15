from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # Permitir NULL en usuario para preservar registros si se elimina un usuario
        migrations.AlterField(
            model_name='registroactividad',
            name='usuario',
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='actividades',
                to=settings.AUTH_USER_MODEL,
                verbose_name='Usuario',
            ),
        ),
        # Campo para guardar el username aunque el usuario sea eliminado
        migrations.AddField(
            model_name='registroactividad',
            name='actor_username',
            field=models.CharField(
                blank=True,
                default='',
                max_length=150,
                verbose_name='Username del Actor',
                help_text='Guardado para preservar el registro aunque se elimine el usuario',
            ),
            preserve_default=False,
        ),
        # Índice adicional para filtrado eficiente por usuario + fecha
        migrations.AddIndex(
            model_name='registroactividad',
            index=models.Index(fields=['usuario', '-created_at'], name='core_regact_usuario_fecha_idx'),
        ),
    ]
