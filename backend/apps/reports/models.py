from django.conf import settings
from django.db import models


class ProjectCRIOverride(models.Model):
    """
    Valores del CRI capturados a mano para un proyecto completado.

    El reporte calcula asignadas/terminadas/vencidas/CRI desde las tareas;
    si un administrador los corrige, se guardan aquí (compartidos para todos,
    antes vivían en el localStorage de cada navegador).
    """
    project = models.OneToOneField(
        'projects.Project', on_delete=models.CASCADE, related_name='cri_override',
    )
    asignadas = models.PositiveIntegerField()
    terminadas = models.PositiveIntegerField()
    vencidas = models.PositiveIntegerField()
    cri = models.PositiveSmallIntegerField()
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+',
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Ajuste manual de CRI'
        verbose_name_plural = 'Ajustes manuales de CRI'

    def __str__(self):
        return f'CRI {self.project_id}: {self.cri}%'
