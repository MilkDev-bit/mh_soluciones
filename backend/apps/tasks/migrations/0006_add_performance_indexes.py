from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tasks', '0005_alter_task_attachment_alter_tasksubmission_file'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='task',
            index=models.Index(
                fields=['status'],
                name='task_status_idx',
            ),
        ),
        migrations.AddIndex(
            model_name='task',
            index=models.Index(
                fields=['project', 'status'],
                name='task_project_status_idx',
            ),
        ),
    ]
