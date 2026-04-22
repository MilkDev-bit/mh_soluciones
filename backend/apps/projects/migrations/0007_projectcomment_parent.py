from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('projects', '0006_projectcomment_mentioned_users'),
    ]

    operations = [
        migrations.AddField(
            model_name='projectcomment',
            name='parent',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='replies',
                to='projects.projectcomment',
                verbose_name='Comentario padre',
            ),
        ),
    ]
