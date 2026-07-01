import os
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.tasks.models import Task
from apps.projects.models import Project

class Command(BaseCommand):
    help = 'Elimina tareas duplicadas de tipo GRAFICAS creadas en la última semana por proyecto, conservando la original o la que tenga datos.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.MIGRATE_HEADING("--- INICIANDO LIMPIEZA DE TAREAS 'GRAFICAS' DUPLICADAS DE ESTA SEMANA ---"))
        one_week_ago = timezone.now() - timedelta(days=7)
        projects = Project.objects.all()
        total_deleted = 0
        projects_affected = 0
        
        for project in projects:
            graficas_tasks = list(Task.objects.filter(
                project=project,
                title__icontains='GRAFICAS',
                created_at__gte=one_week_ago
            ).order_by('created_at'))
            
            if len(graficas_tasks) > 1:
                projects_affected += 1
                self.stdout.write(f"\n📂 Analizando proyecto '{project.name}' (ID: {project.id}) - Tareas encontradas: {len(graficas_tasks)}")
                
                best_task = None
                for t in graficas_tasks:
                    has_data = '<!-- GRAFICAS_DATA:' in (t.description or '')
                    if has_data:
                        best_task = t
                        break
                
                if not best_task:
                    graficas_tasks.sort(key=lambda x: (x.submissions.count(), -x.id), reverse=True)
                    best_task = graficas_tasks[0]
                
                self.stdout.write(self.style.SUCCESS(f"  ✅ [CONSERVADA] Tarea ID {best_task.id}: '{best_task.title}' (Creada: {best_task.created_at.strftime('%Y-%m-%d %H:%M')}, Entregas: {best_task.submissions.count()})"))
                
                for t in graficas_tasks:
                    if t.id != best_task.id:
                        self.stdout.write(self.style.WARNING(f"  ❌ [ELIMINANDO] Duplicado ID {t.id}: '{t.title}' (Creada: {t.created_at.strftime('%Y-%m-%d %H:%M')})"))
                        t.delete()
                        total_deleted += 1

        self.stdout.write(self.style.MIGRATE_HEADING("\n🎉 ¡Limpieza finalizada con éxito!"))
        self.stdout.write(f"   - Proyectos analizados con duplicados: {projects_affected}")
        self.stdout.write(f"   - Tareas duplicadas eliminadas: {total_deleted}")
