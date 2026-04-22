from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('projects', '0005_alter_projectsubmission_file'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='projectcomment',
            name='mentioned_users',
            field=models.ManyToManyField(
                blank=True,
                related_name='comment_mentions',
                to=settings.AUTH_USER_MODEL,
                verbose_name='Usuarios mencionados',
            ),
        ),
    ]
