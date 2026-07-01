#!/usr/bin/env python
import os
import sys
import django
from datetime import timedelta

if __name__ == "__main__":
    # Configurar entorno Django
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    try:
        django.setup()
    except Exception as e:
        print(f"Error inicializando Django: {e}")
        sys.exit(1)
        
    from django.utils import timezone
    from apps.tasks.models import Task
    from apps.projects.models import Project

    print("=========================================================================")
    print("--- INICIANDO LIMPIEZA DE TAREAS 'GRAFICAS' DUPLICADAS DE ESTA SEMANA ---")
    print("=========================================================================")
    
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
            print(f"\n📂 Analizando proyecto '{project.name}' (ID: {project.id}) - Tareas encontradas: {len(graficas_tasks)}")
            
            # Criterio para elegir cuál conservar:
            # 1. Priorizar la tarea que tenga datos guardados de la tabla en su descripción (<!-- GRAFICAS_DATA:)
            # 2. Si hay varias con datos o ninguna, priorizar la que tenga más entregas o comentarios
            # 3. Si empatan, conservar la primera (más antigua) creada esta semana
            best_task = None
            for t in graficas_tasks:
                has_data = '<!-- GRAFICAS_DATA:' in (t.description or '')
                if has_data:
                    best_task = t
                    break
            
            if not best_task:
                # Ordenar por cantidad de entregas (submissions) descendente y luego por id ascendente
                graficas_tasks.sort(key=lambda x: (x.submissions.count(), -x.id), reverse=True)
                best_task = graficas_tasks[0]
            
            print(f"  ✅ [CONSERVADA] Tarea ID {best_task.id}: '{best_task.title}' (Creada: {best_task.created_at.strftime('%Y-%m-%d %H:%M')}, Entregas: {best_task.submissions.count()})")
            
            # Eliminar todos los demás duplicados
            for t in graficas_tasks:
                if t.id != best_task.id:
                    print(f"  ❌ [ELIMINANDO] Duplicado ID {t.id}: '{t.title}' (Creada: {t.created_at.strftime('%Y-%m-%d %H:%M')})")
                    t.delete()
                    total_deleted += 1

    print("\n=========================================================================")
    print(f"🎉 ¡Limpieza finalizada con éxito!")
    print(f"   - Proyectos analizados con duplicados: {projects_affected}")
    print(f"   - Tareas duplicadas eliminadas: {total_deleted}")
    print("=========================================================================")
