# Generated migration

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('documents', '0004_add_task_submission_field'),
    ]

    operations = [
        migrations.AddField(
            model_name='document',
            name='drive_parent_folder_id',
            field=models.CharField(blank=True, max_length=255, null=True, verbose_name='ID de la Carpeta Padre en Google Drive'),
        ),
        migrations.AddField(
            model_name='document',
            name='drive_parent_folder_name',
            field=models.CharField(blank=True, max_length=255, null=True, verbose_name='Nombre de la Carpeta Padre en Google Drive'),
        ),
    ]
