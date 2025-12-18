# Generated manually for task submission support

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('tasks', '0003_tasksubmission_google_drive_file_id_and_more'),
        ('documents', '0003_document_file_type_alter_document_folder_type_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='document',
            name='task_submission',
            field=models.ForeignKey(
                blank=True,
                help_text='Entrega de tarea asociada',
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='documents',
                to='tasks.tasksubmission',
                verbose_name='Entrega de Tarea'
            ),
        ),
        migrations.AlterField(
            model_name='document',
            name='folder_type',
            field=models.CharField(
                choices=[
                    ('OPERATIVO', 'Operativo'),
                    ('ADMINISTRATIVO', 'Administrativo'),
                    ('DOCUMENTOS', 'Documentos'),
                    ('IMAGENES', 'Imágenes'),
                    ('VIDEOS', 'Videos'),
                    ('ARCHIVOS', 'Archivos'),
                    ('TASK_SUBMISSION', 'Entrega de Tarea'),
                    ('OTROS', 'Otros')
                ],
                default='OPERATIVO',
                max_length=20,
                verbose_name='Tipo de Carpeta'
            ),
        ),
    ]
