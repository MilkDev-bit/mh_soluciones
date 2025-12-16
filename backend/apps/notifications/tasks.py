"""
Tareas programadas de Celery para notificaciones y recordatorios
"""
from celery import shared_task
from django.utils import timezone
from datetime import timedelta
from django.db.models import Q
from apps.tasks.models import Task
from apps.calendar.models import CalendarEvent
from apps.core.models import PreferenciasNotificacion, RegistroEmail
from apps.notifications.models import Notification
from utils.email_notifications import (
    send_task_due_reminder,
    send_calendar_event_notification
)
import logging

logger = logging.getLogger(__name__)


@shared_task(name='verificar_recordatorios_vencimiento_tareas')
def verificar_recordatorios_vencimiento_tareas():
    """
    Verifica tareas próximas a vencer y envía recordatorios por email
    Se ejecuta diariamente a las 9:00 AM
    """
    logger.info("Iniciando verificación de recordatorios de vencimiento de tareas")
    
    ahora = timezone.now()
    fecha_hoy = ahora.date()
    
    # Recordatorios 7 días antes
    fecha_7_dias = fecha_hoy + timedelta(days=7)
    tareas_7_dias = Task.objects.filter(
        due_date=fecha_7_dias,
        status__in=['OPEN', 'IN_PROGRESS', 'DRAFT']
    ).select_related('assigned_to', 'project').prefetch_related('assigned_students')
    
    for tarea in tareas_7_dias:
        destinatarios = []
        if tarea.assigned_to:
            prefs = getattr(tarea.assigned_to, 'preferencias_notificacion', None)
            if not prefs or prefs.email_recordatorio_vencimiento:
                destinatarios.append(tarea.assigned_to)
        
        for estudiante in tarea.assigned_students.all():
            prefs = getattr(estudiante, 'preferencias_notificacion', None)
            if not prefs or prefs.email_recordatorio_vencimiento:
                destinatarios.append(estudiante)
        
        if destinatarios:
            try:
                send_task_due_reminder(tarea)
                logger.info(f"Recordatorio 7 días enviado para tarea: {tarea.title}")
            except Exception as e:
                logger.error(f"Error enviando recordatorio 7 días para tarea {tarea.id}: {str(e)}")
    
    # Recordatorios 24 horas antes
    fecha_manana = fecha_hoy + timedelta(days=1)
    tareas_24h = Task.objects.filter(
        due_date=fecha_manana,
        status__in=['OPEN', 'IN_PROGRESS', 'DRAFT']
    ).select_related('assigned_to', 'project').prefetch_related('assigned_students')
    
    for tarea in tareas_24h:
        try:
            send_task_due_reminder(tarea)
            logger.info(f"Recordatorio 24h enviado para tarea: {tarea.title}")
        except Exception as e:
            logger.error(f"Error enviando recordatorio 24h para tarea {tarea.id}: {str(e)}")
    
    # Recordatorios día de vencimiento
    tareas_hoy = Task.objects.filter(
        due_date=fecha_hoy,
        status__in=['OPEN', 'IN_PROGRESS', 'DRAFT']
    ).select_related('assigned_to', 'project').prefetch_related('assigned_students')
    
    for tarea in tareas_hoy:
        try:
            send_task_due_reminder(tarea)
            logger.info(f"Recordatorio día de vencimiento enviado para tarea: {tarea.title}")
        except Exception as e:
            logger.error(f"Error enviando recordatorio vencimiento para tarea {tarea.id}: {str(e)}")
    
    logger.info("Finalizada verificación de recordatorios de vencimiento")
    return {
        '7_dias': tareas_7_dias.count(),
        '24_horas': tareas_24h.count(),
        'hoy': tareas_hoy.count()
    }


@shared_task(name='verificar_tareas_vencidas')
def verificar_tareas_vencidas():
    """
    Verifica tareas vencidas y envía notificaciones diarias
    Se ejecuta diariamente a las 10:00 AM
    """
    logger.info("Iniciando verificación de tareas vencidas")
    
    ahora = timezone.now()
    fecha_hoy = ahora.date()
    
    # Tareas vencidas (no completadas y fecha de vencimiento pasada)
    tareas_vencidas = Task.objects.filter(
        due_date__lt=fecha_hoy,
        status__in=['OPEN', 'IN_PROGRESS', 'DRAFT', 'IN_REVIEW']
    ).select_related('assigned_to', 'project').prefetch_related('assigned_students')
    
    for tarea in tareas_vencidas:
        destinatarios = []
        if tarea.assigned_to:
            prefs = getattr(tarea.assigned_to, 'preferencias_notificacion', None)
            if not prefs or prefs.email_tarea_vencida:
                destinatarios.append(tarea.assigned_to)
        
        for estudiante in tarea.assigned_students.all():
            prefs = getattr(estudiante, 'preferencias_notificacion', None)
            if not prefs or prefs.email_tarea_vencida:
                destinatarios.append(estudiante)
        
        if destinatarios:
            # Crear notificación en la app
            for destinatario in destinatarios:
                Notification.objects.create(
                    user=destinatario,
                    title=f"Tarea Vencida: {tarea.title}",
                    message=f"La tarea '{tarea.title}' venció el {tarea.due_date.strftime('%d/%m/%Y')}. Por favor, complétala lo antes posible.",
                    notification_type=Notification.NotificationType.TASK_OVERDUE,
                    content_object=tarea
                )
    
    logger.info(f"Finalizada verificación de tareas vencidas: {tareas_vencidas.count()} tareas")
    return {'tareas_vencidas': tareas_vencidas.count()}


@shared_task(name='verificar_recordatorios_eventos_calendario')
def verificar_recordatorios_eventos_calendario():
    """
    Verifica eventos de calendario próximos y envía recordatorios
    Se ejecuta cada hora
    """
    logger.info("Iniciando verificación de recordatorios de eventos de calendario")
    
    ahora = timezone.now()
    
    # Buscar eventos en las próximas 24 horas
    proximas_24h = ahora + timedelta(hours=24)
    eventos_proximos = CalendarEvent.objects.filter(
        start_time__gte=ahora,
        start_time__lte=proximas_24h
    ).select_related('project', 'created_by').prefetch_related('participantes')
    
    recordatorios_enviados = 0
    
    for evento in eventos_proximos:
        # Verificar configuración de recordatorios
        recordatorios = evento.recordatorios if evento.recordatorios else []
        
        for recordatorio_config in recordatorios:
            tipo = recordatorio_config.get('tipo', 'email')
            minutos_antes = recordatorio_config.get('minutos_antes', 60)
            
            tiempo_recordatorio = evento.start_time - timedelta(minutes=minutos_antes)
            
            # Si el recordatorio debe enviarse ahora (con margen de 5 minutos)
            margen = timedelta(minutes=5)
            if tiempo_recordatorio <= ahora <= tiempo_recordatorio + margen:
                if tipo == 'email':
                    participantes_emails = [p.email for p in evento.participantes.all() if p.email]
                    if participantes_emails:
                        try:
                            send_calendar_event_notification(evento, action='reminder')
                            recordatorios_enviados += 1
                            logger.info(f"Recordatorio enviado para evento: {evento.title}")
                        except Exception as e:
                            logger.error(f"Error enviando recordatorio para evento {evento.id}: {str(e)}")
    
    logger.info(f"Finalizada verificación de recordatorios: {recordatorios_enviados} enviados")
    return {'recordatorios_enviados': recordatorios_enviados}


@shared_task(name='generar_resumen_actividad_diario')
def generar_resumen_actividad_diario():
    """
    Genera y envía resumen diario de actividad para usuarios que lo tienen activado
    Se ejecuta diariamente a las 18:00
    """
    logger.info("Iniciando generación de resúmenes diarios de actividad")
    
    from apps.authentication.models import CustomUser
    from apps.core.models import RegistroActividad
    
    # Obtener usuarios con resumen diario activado
    usuarios_con_resumen = CustomUser.objects.filter(
        preferencias_notificacion__email_resumen_diario=True,
        is_active=True
    ).prefetch_related('preferencias_notificacion')
    
    ahora = timezone.now()
    ayer = ahora - timedelta(days=1)
    
    resúmenes_enviados = 0
    
    for usuario in usuarios_con_resumen:
        # Obtener actividades del usuario en las últimas 24 horas
        actividades = RegistroActividad.objects.filter(
            Q(usuario=usuario) | Q(proyecto_id__in=usuario.projects.values_list('id', flat=True)),
            created_at__gte=ayer
        ).order_by('-created_at')[:20]
        
        if actividades.exists():
            # TODO: Crear y enviar email con resumen de actividades
            # Esta funcionalidad se puede implementar más adelante con plantillas HTML
            logger.info(f"Resumen diario preparado para usuario: {usuario.username}")
            resúmenes_enviados += 1
    
    logger.info(f"Finalizada generación de resúmenes diarios: {resúmenes_enviados} enviados")
    return {'resumenes_enviados': resúmenes_enviados}


@shared_task(name='generar_resumen_actividad_semanal')
def generar_resumen_actividad_semanal():
    """
    Genera y envía resumen semanal de actividad
    Se ejecuta los lunes a las 9:00 AM
    """
    logger.info("Iniciando generación de resúmenes semanales de actividad")
    
    from apps.authentication.models import CustomUser
    from apps.core.models import RegistroActividad
    
    # Obtener usuarios con resumen semanal activado
    usuarios_con_resumen = CustomUser.objects.filter(
        preferencias_notificacion__email_resumen_semanal=True,
        is_active=True
    ).prefetch_related('preferencias_notificacion')
    
    ahora = timezone.now()
    hace_una_semana = ahora - timedelta(days=7)
    
    resumenes_enviados = 0
    
    for usuario in usuarios_con_resumen:
        # Obtener actividades del usuario en la última semana
        actividades = RegistroActividad.objects.filter(
            Q(usuario=usuario) | Q(proyecto_id__in=usuario.projects.values_list('id', flat=True)),
            created_at__gte=hace_una_semana
        ).order_by('-created_at')[:50]
        
        if actividades.exists():
            # TODO: Crear y enviar email con resumen de actividades semanal
            logger.info(f"Resumen semanal preparado para usuario: {usuario.username}")
            resumenes_enviados += 1
    
    logger.info(f"Finalizada generación de resúmenes semanales: {resumenes_enviados} enviados")
    return {'resumenes_enviados': resumenes_enviados}


@shared_task(name='limpiar_notificaciones_antiguas')
def limpiar_notificaciones_antiguas():
    """
    Limpia notificaciones leídas con más de 30 días de antigüedad
    Se ejecuta semanalmente
    """
    logger.info("Iniciando limpieza de notificaciones antiguas")
    
    hace_30_dias = timezone.now() - timedelta(days=30)
    
    notificaciones_eliminadas = Notification.objects.filter(
        is_read=True,
        created_at__lt=hace_30_dias
    ).delete()
    
    logger.info(f"Limpieza completada: {notificaciones_eliminadas[0]} notificaciones eliminadas")
    return {'eliminadas': notificaciones_eliminadas[0]}
