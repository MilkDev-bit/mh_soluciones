from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('documents', '0008_add_link_fields_and_nullable_file'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='document',
            index=models.Index(
                fields=['folder_type'],
                name='doc_folder_type_idx',
            ),
        ),
        migrations.AddIndex(
            model_name='document',
            index=models.Index(
                fields=['drive_parent_folder_id'],
                name='doc_drive_parent_folder_idx',
            ),
        ),
        migrations.AddIndex(
            model_name='document',
            index=models.Index(
                fields=['upload_status'],
                name='doc_upload_status_idx',
            ),
        ),
        migrations.AddIndex(
            model_name='document',
            index=models.Index(
                fields=['project', 'folder_type'],
                name='doc_project_folder_type_idx',
            ),
        ),
    ]
