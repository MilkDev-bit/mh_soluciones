"""
Flujo de revisión por alumno y mensajes por tipo de evento.

Antes, "Completar tarea" y "Pedir cambios" cambiaban el estado GLOBAL de la
tarea: si un revisor aprobaba a un alumno y otro pedía cambios a otro, se
pisaban entre sí. Además, el formulario siempre mandaba status=GRADED, así que
el alumno recibía "Tarea calificada" y "Tarea devuelta" a la vez.

Ahora cada entrega tiene su propio estado:

    SUBMITTED ──tomar──▶ IN_REVIEW ──aprobar──▶ APPROVED
        ▲                   │  └──devolver──▶ CHANGES_REQUESTED ──reenvía──▶ SUBMITTED (v+1)
        └────soltar─────────┘

- Solo el revisor que tomó la entrega puede decidir; un administrador puede
  reasignarla (force=True).
- Solo se revisa la última versión del alumno; las anteriores quedan como
  SUPERSEDED.
"""
import logging

from django.db import transaction
from django.utils import timezone

from apps.core.permissions import ADMIN_ROLES, TEACHER_ROLES

from . import deadlines
from .models import TaskSubmission

logger = logging.getLogger(__name__)

S = TaskSubmission.SubmissionStatus


class ReviewError(Exception):
    """Error de negocio con mensaje para el usuario y código HTTP."""

    def __init__(self, message, code='REVIEW_ERROR', http_status=409):
        super().__init__(message)
        self.message = message
        self.code = code
        self.http_status = http_status


def _name(user):
    return (user.get_full_name() or user.username) if user else 'otro revisor'


def _lock(submission_id):
    return (TaskSubmission.objects.select_for_update()
            .select_related('task', 'submitted_by', 'reviewer')
            .get(pk=submission_id))


def _assert_latest(sub):
    latest = (TaskSubmission.objects.filter(task=sub.task, submitted_by=sub.submitted_by)
              .order_by('-version').values_list('pk', flat=True).first())
    if latest != sub.pk:
        raise ReviewError('Esta versión fue reemplazada por una entrega más reciente del alumno. '
                          'Revisa la última versión.', code='SUPERSEDED')


def _assert_reviewer_role(user):
    if user.role not in TEACHER_ROLES:
        raise ReviewError('No tienes permisos para revisar entregas.', code='FORBIDDEN', http_status=403)


@transaction.atomic
def claim(submission_id, user, force=False):
    _assert_reviewer_role(user)
    sub = _lock(submission_id)
    _assert_latest(sub)
    if sub.status in TaskSubmission.FINAL_STATUSES:
        raise ReviewError('Esta entrega ya fue aprobada.', code='ALREADY_FINAL')
    if sub.status == S.CHANGES_REQUESTED:
        raise ReviewError('Esta entrega fue devuelta con cambios; espera la corrección del alumno.',
                          code='WAITING_STUDENT')
    if sub.status == S.IN_REVIEW and sub.reviewer_id and sub.reviewer_id != user.pk:
        if not (force and user.role in ADMIN_ROLES):
            raise ReviewError(f'{_name(sub.reviewer)} ya está revisando esta entrega.',
                              code='TAKEN_BY_OTHER')
    sub.status = S.IN_REVIEW
    sub.reviewer = user
    sub.review_started_at = timezone.now()
    sub.save(update_fields=['status', 'reviewer', 'review_started_at', 'updated_at'])
    return sub


@transaction.atomic
def release(submission_id, user):
    sub = _lock(submission_id)
    if sub.status != S.IN_REVIEW:
        raise ReviewError('Esta entrega no está en revisión.', code='NOT_IN_REVIEW')
    if sub.reviewer_id != user.pk and user.role not in ADMIN_ROLES:
        raise ReviewError(f'Solo {_name(sub.reviewer)} o un administrador puede liberarla.',
                          code='TAKEN_BY_OTHER')
    sub.status = S.SUBMITTED
    sub.reviewer = None
    sub.review_started_at = None
    sub.save(update_fields=['status', 'reviewer', 'review_started_at', 'updated_at'])
    return sub


@transaction.atomic
def decide(submission_id, user, decision, feedback='', score=None, criteria_scores=None):
    """decision: 'approve' | 'request_changes'."""
    _assert_reviewer_role(user)
    if decision not in ('approve', 'request_changes'):
        raise ReviewError("Decisión inválida. Usa 'approve' o 'request_changes'.",
                          code='INVALID', http_status=400)
    sub = _lock(submission_id)
    _assert_latest(sub)
    if sub.status in TaskSubmission.FINAL_STATUSES:
        raise ReviewError('Esta entrega ya fue aprobada.', code='ALREADY_FINAL')
    if sub.status == S.IN_REVIEW and sub.reviewer_id and sub.reviewer_id != user.pk \
            and user.role not in ADMIN_ROLES:
        raise ReviewError(f'{_name(sub.reviewer)} está revisando esta entrega. '
                          'Pídele que la libere o pide a un administrador reasignarla.',
                          code='TAKEN_BY_OTHER')
    if decision == 'request_changes' and not (feedback or '').strip():
        raise ReviewError('Indica qué debe corregir el alumno.', code='FEEDBACK_REQUIRED',
                          http_status=400)
    if score is not None:
        max_score = sub.task.max_score
        if score < 0 or score > max_score:
            raise ReviewError(f'La puntuación debe estar entre 0 y {max_score}.',
                              code='INVALID_SCORE', http_status=400)

    sub.status = S.APPROVED if decision == 'approve' else S.CHANGES_REQUESTED
    sub.is_approved = decision == 'approve'
    sub.teacher_feedback = feedback or ''
    if score is not None:
        sub.score = score
    if criteria_scores is not None:
        sub.criteria_scores = criteria_scores
    sub.graded_by = user
    sub.graded_at = timezone.now()
    sub.reviewer = user
    sub.save()

    transaction.on_commit(lambda: notify_decision(sub.pk))
    return sub


# ---------------------------------------------------------------------------
# Mensajes por tipo de evento
# ---------------------------------------------------------------------------

def _push(user, title, message, ntype, obj):
    try:
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer
        from apps.notifications.api.serializers import NotificationSerializer
        from apps.notifications.models import Notification

        n = Notification.objects.create(user=user, title=title, message=message,
                                        notification_type=ntype, content_object=obj)
        layer = get_channel_layer()
        if layer:
            async_to_sync(layer.group_send)(
                f'user_{user.pk}_notifications',
                {'type': 'send_notification', 'message': NotificationSerializer(n).data},
            )
    except Exception:
        logger.exception('No se pudo enviar la notificación a user=%s', getattr(user, 'pk', None))


def submission_received_message(sub):
    """Título y mensaje para revisores según el tipo de entrega."""
    student = sub.submitted_by.get_full_name() or sub.submitted_by.username
    title_task = sub.task.title
    is_correction = sub.version > 1 and TaskSubmission.objects.filter(
        task=sub.task, submitted_by=sub.submitted_by, version=sub.version - 1,
        status=S.CHANGES_REQUESTED,
    ).exists()
    if is_correction:
        return ('Corrección recibida',
                f"{student} reenvió la corrección de '{title_task}' (versión {sub.version}).")
    if sub.is_late:
        return ('Entrega tardía recibida',
                f"{student} entregó '{title_task}' fuera de la fecha límite (versión {sub.version}).")
    if sub.version > 1:
        return ('Entrega actualizada',
                f"{student} reemplazó su entrega de '{title_task}' (versión {sub.version}).")
    return ('Nueva entrega', f"{student} entregó '{title_task}'.")


def notify_decision(submission_id):
    from apps.notifications.models import Notification
    sub = TaskSubmission.objects.select_related('task', 'submitted_by').get(pk=submission_id)
    task = sub.task
    score = f' Calificación: {sub.score}/{task.max_score}.' if sub.score is not None else ''
    if sub.status == S.APPROVED:
        title = 'Entrega aprobada'
        message = f"Tu entrega de '{task.title}' fue aprobada.{score}"
        ntype = Notification.NotificationType.TASK_COMPLETED
    else:
        window = deadlines.submission_window(task, sub.submitted_by, latest_submission=sub)
        until = f' Puedes reenviarla hasta el {deadlines.fmt(window.correction_deadline)}.' \
            if window.correction_deadline else ''
        title = 'Entrega devuelta con cambios'
        message = f"Tu entrega de '{task.title}' requiere cambios: {sub.teacher_feedback}{until}"
        ntype = Notification.NotificationType.TASK_DUE
    _push(sub.submitted_by, title, message, ntype, task)

    try:
        if sub.status == S.CHANGES_REQUESTED:
            from utils.email_notifications import send_task_returned_notification
            send_task_returned_notification(task, sub)
        else:
            from django.conf import settings
            from utils.email_notifications import send_email_notification
            if sub.submitted_by.email:
                send_email_notification(
                    subject=f'Entrega aprobada: {task.title}',
                    recipient_list=[sub.submitted_by.email],
                    template_name='emails/task_graded.txt',
                    html_template_name='emails/task_graded.html',
                    context={'task': task, 'submission': sub, 'score': sub.score,
                             'max_score': task.max_score, 'feedback': sub.teacher_feedback,
                             'project': task.project, 'frontend_url': settings.FRONTEND_URL},
                )
    except Exception:
        logger.exception('Error enviando correo de revisión para submission=%s', sub.pk)


def notify_extension(task, students, new_deadline):
    from apps.notifications.models import Notification
    for student in students:
        _push(student, 'Plazo ampliado',
              f"Tienes hasta el {deadlines.fmt(new_deadline)} para entregar '{task.title}'.",
              Notification.NotificationType.TASK_DUE, task)
