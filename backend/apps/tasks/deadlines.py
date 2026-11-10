"""
Fuente única de verdad para fechas límite y ventana de entrega.

Problemas que corrige:
- Antes había tres fechas compitiendo (due_date, close_date y la del frontend)
  y cada lugar calculaba "vencida" distinto: unos con close_date, otros con
  due_date a las 00:00, otros con la fecha UTC del servidor. Por eso una tarea
  vencía un día antes o un día después según la zona y la hora.
- days_after_close existía en el modelo pero nunca se aplicaba.
- Las prórrogas por alumno (TaskReopenLog.specific_students) se ignoraban.
- Las actividades permanentes (GRAFICAS) se marcaban como vencidas por su
  fecha original.

Reglas:
1. Fecha límite efectiva = close_date si existe; si no, due_date a las
   23:59:59 en la zona horaria del sistema (America/Mexico_City). Una fecha
   "15/11" vence al final del día 15, en cualquier zona.
2. Una prórroga (reapertura) para el alumno, o general, sustituye la fecha
   límite si es posterior.
3. Entregas tardías: si allow_late_submissions (o accept_after_close) está
   activo, se aceptan hasta days_after_close días después (0 = sin límite).
4. Actividad continua (is_continuous): nunca vence.
5. Entrega devuelta con cambios: el alumno puede corregir durante
   TASK_CORRECTION_DAYS días desde la devolución, aunque la tarea ya haya
   vencido. Las correcciones no se marcan como tardías.
"""
from dataclasses import dataclass, asdict
from datetime import datetime, time, timedelta

from django.conf import settings
from django.utils import timezone

# Estados de la ventana de entrega (el frontend los usa para colores e íconos)
STATE_NO_DEADLINE = 'NO_DEADLINE'       # actividad continua o sin fecha
STATE_OPEN = 'OPEN'                     # dentro del plazo
STATE_DUE_SOON = 'DUE_SOON'             # vence en menos de 24 h
STATE_LATE_WINDOW = 'LATE_WINDOW'       # vencida, pero se aceptan entregas tardías
STATE_CORRECTION = 'CORRECTION'         # devuelta con cambios; puede reenviar
STATE_OVERDUE = 'OVERDUE'               # vencida y ya no acepta entregas
STATE_NOT_OPEN = 'NOT_OPEN'             # aún no abre
STATE_IN_REVIEW = 'IN_REVIEW'           # su entrega está en revisión
STATE_APPROVED = 'APPROVED'             # ya aprobada
STATE_CLOSED = 'CLOSED'                 # tarea cerrada por el revisor


def correction_days() -> int:
    return int(getattr(settings, 'TASK_CORRECTION_DAYS', 3))


def end_of_local_day(d) -> datetime:
    """23:59:59 del día `d` en la zona horaria del sistema, como datetime aware."""
    tz = timezone.get_default_timezone()
    return timezone.make_aware(datetime.combine(d, time(23, 59, 59)), tz)


def fmt(dt) -> str:
    """Fecha y hora legibles en la hora local del sistema: '15/11/2026 23:59'."""
    if dt is None:
        return ''
    return timezone.localtime(dt).strftime('%d/%m/%Y %H:%M')


def task_deadline(task):
    """Fecha límite general de la tarea (sin prórrogas por alumno)."""
    if task.is_continuous:
        return None
    if task.close_date:
        return task.close_date
    if task.due_date:
        return end_of_local_day(task.due_date)
    return None


def late_allowed(task) -> bool:
    return bool(task.allow_late_submissions or task.accept_after_close)


def late_deadline_for(task, deadline):
    """Fin del periodo de entregas tardías. None = sin límite (si están permitidas)."""
    if deadline is None or not late_allowed(task):
        return None
    days = task.days_after_close or 0
    if days <= 0:
        return None
    return deadline + timedelta(days=days)


def student_extension(task, user):
    """Prórroga más reciente aplicable al alumno (general o específica).

    Usa task.reopen_logs.all() para aprovechar el prefetch_related en listas.
    """
    if user is None:
        return None
    best = None
    for log in task.reopen_logs.all():
        students = list(log.specific_students.all())
        applies = not students or any(s.pk == user.pk for s in students)
        if applies and (best is None or log.new_deadline > best):
            best = log.new_deadline
    return best


def deadline_for(task, user=None):
    """Fecha límite efectiva para un alumno: la mayor entre la general y su prórroga."""
    base = task_deadline(task)
    if base is None:
        return None
    ext = student_extension(task, user)
    if ext and ext > base:
        return ext
    return base


@dataclass
class SubmissionWindow:
    state: str
    can_submit: bool
    is_late: bool
    message: str
    deadline: datetime | None = None
    late_deadline: datetime | None = None
    correction_deadline: datetime | None = None

    def as_dict(self):
        data = asdict(self)
        for key in ('deadline', 'late_deadline', 'correction_deadline'):
            data[key] = data[key].isoformat() if data[key] else None
        return data


def submission_window(task, user, latest_submission=None, now=None) -> SubmissionWindow:
    """Decide si `user` puede entregar ahora y con qué mensaje.

    Se usa en el endpoint de entrega (para rechazar con un motivo claro) y en
    los serializers (para que el frontend muestre el mismo mensaje ANTES de
    que el alumno suba archivos).
    """
    now = now or timezone.now()
    deadline = deadline_for(task, user)
    late_dl = late_deadline_for(task, deadline)
    common = {'deadline': deadline, 'late_deadline': late_dl}

    if task.status == 'DRAFT':
        return SubmissionWindow(STATE_CLOSED, False, False,
                                'Esta tarea todavía es un borrador y no recibe entregas.', **common)

    if task.status in ('CLOSED', 'COMPLETED') and not task.accept_after_close:
        return SubmissionWindow(STATE_CLOSED, False, False,
                                'El revisor cerró esta tarea y ya no recibe entregas.', **common)

    if task.open_date and now < task.open_date:
        return SubmissionWindow(STATE_NOT_OPEN, False, False,
                                f'Esta tarea abre el {fmt(task.open_date)}.', **common)

    # --- El estado de la última entrega del alumno tiene prioridad ---
    if latest_submission is not None:
        status = latest_submission.status
        if status in ('APPROVED', 'GRADED'):
            return SubmissionWindow(STATE_APPROVED, False, False,
                                    'Tu entrega ya fue aprobada. No necesitas volver a entregar.', **common)
        if status == 'IN_REVIEW':
            who = latest_submission.reviewer
            name = (who.get_full_name() or who.username) if who else 'un revisor'
            return SubmissionWindow(STATE_IN_REVIEW, False, False,
                                    f'Tu entrega está siendo revisada por {name}. '
                                    'Podrás reenviar si te la devuelven con cambios.', **common)
        if status == 'CHANGES_REQUESTED':
            base = latest_submission.graded_at or latest_submission.updated_at or now
            correction_dl = base + timedelta(days=correction_days())
            # Si el plazo normal es más amplio, se respeta el mayor.
            if deadline and deadline > correction_dl:
                correction_dl = deadline
            if now <= correction_dl:
                return SubmissionWindow(
                    STATE_CORRECTION, True, False,
                    f'Tu entrega fue devuelta con cambios. Puedes reenviar la corrección '
                    f'hasta el {fmt(correction_dl)}.',
                    correction_deadline=correction_dl, **common)
            return SubmissionWindow(
                STATE_OVERDUE, False, False,
                f'El plazo para reenviar la corrección terminó el {fmt(correction_dl)}. '
                'Pide a tu revisor una prórroga.',
                correction_deadline=correction_dl, **common)
        # SUBMITTED / LATE / PENDING: puede reemplazar su entrega con una versión nueva

    if deadline is None:
        return SubmissionWindow(STATE_NO_DEADLINE, True, False,
                                'Actividad continua: puedes entregar en cualquier momento.'
                                if task.is_continuous else 'Esta tarea no tiene fecha límite.',
                                **common)

    if now <= deadline:
        if deadline - now <= timedelta(hours=24):
            return SubmissionWindow(STATE_DUE_SOON, True, False,
                                    f'Vence pronto: {fmt(deadline)}.', **common)
        return SubmissionWindow(STATE_OPEN, True, False, f'Vence el {fmt(deadline)}.', **common)

    # --- Pasó la fecha límite ---
    if late_allowed(task) and (late_dl is None or now <= late_dl):
        until = f' hasta el {fmt(late_dl)}' if late_dl else ''
        return SubmissionWindow(
            STATE_LATE_WINDOW, True, True,
            f'La fecha límite fue el {fmt(deadline)}. Aún puedes entregar{until}, '
            'pero quedará marcada como tardía.', **common)

    if late_allowed(task) and late_dl:
        msg = (f'La fecha límite fue el {fmt(deadline)} y el periodo de entregas tardías '
               f'terminó el {fmt(late_dl)}. Pide a tu revisor una prórroga.')
    else:
        msg = (f'La fecha límite fue el {fmt(deadline)} y esta tarea no acepta entregas tardías. '
               'Pide a tu revisor una prórroga.')
    return SubmissionWindow(STATE_OVERDUE, False, False, msg, **common)


def latest_submission_for(task, user):
    """Última versión del alumno, usando el prefetch `my_submissions` si existe."""
    cached = getattr(task, 'my_submissions', None)
    if cached is not None:
        return cached[0] if cached else None
    return (task.submissions.filter(submitted_by=user)
            .select_related('reviewer').order_by('-version').first())


# ---------------------------------------------------------------------------
# Clasificación de las tareas de un usuario (Mis Tareas y Panel de Control)
# ---------------------------------------------------------------------------

BUCKETS = ('to_submit', 'late', 'changes_requested', 'submitted', 'graded', 'overdue')

_STATE_TO_BUCKET = {
    STATE_NO_DEADLINE: 'to_submit',
    STATE_OPEN: 'to_submit',
    STATE_DUE_SOON: 'to_submit',
    STATE_NOT_OPEN: 'to_submit',
    STATE_LATE_WINDOW: 'late',
    STATE_CORRECTION: 'changes_requested',
    STATE_IN_REVIEW: 'submitted',
    STATE_APPROVED: 'graded',
    STATE_OVERDUE: 'overdue',
    STATE_CLOSED: 'overdue',
}

# Orden de urgencia para listas de pendientes
_URGENCY = {STATE_CORRECTION: 0, STATE_LATE_WINDOW: 1, STATE_DUE_SOON: 2, STATE_OPEN: 3,
            STATE_NOT_OPEN: 4, STATE_NO_DEADLINE: 5}


def user_task_queryset(user):
    """Tareas asignadas al usuario, con prefetch para clasificarlas sin N+1."""
    from django.db.models import Prefetch, Q
    from .models import Task, TaskSubmission

    return (Task.objects.filter(Q(assigned_students=user) | Q(assigned_to=user))
            .exclude(status='DRAFT').distinct()
            .select_related('project', 'assigned_to')
            .prefetch_related(
                'assigned_students',
                'reopen_logs__specific_students',
                Prefetch('submissions',
                         queryset=TaskSubmission.objects.filter(submitted_by=user)
                         .select_related('reviewer').order_by('-version'),
                         to_attr='my_submissions'),
            ))


def classify_user_tasks(user, tasks=None, now=None):
    """Agrupa las tareas del usuario según SU situación (entrega + plazo).

    Devuelve {bucket: [(task, window), ...]}. Es la única regla que usan
    /tasks/my-tasks/ y el Panel de Control; antes el panel contaba como
    "pendiente" toda tarea con estado abierto, aunque el alumno ya la hubiera
    entregado, y como "vencida" cualquier due_date pasada.
    """
    from .models import TaskSubmission

    tasks = user_task_queryset(user) if tasks is None else tasks
    now = now or timezone.now()
    buckets = {key: [] for key in BUCKETS}
    for task in tasks:
        latest = latest_submission_for(task, user)
        window = submission_window(task, user, latest_submission=latest, now=now)
        bucket = _STATE_TO_BUCKET.get(window.state, 'to_submit')
        if latest and latest.status in TaskSubmission.PENDING_REVIEW_STATUSES:
            bucket = 'submitted'  # entregada, esperando revisión
        elif latest and window.state == STATE_CLOSED:
            bucket = 'graded' if latest.status in TaskSubmission.FINAL_STATUSES else 'submitted'
        buckets[bucket].append((task, window))

    def urgency(item):
        task, window = item
        dl = window.correction_deadline or window.deadline
        return (_URGENCY.get(window.state, 9), dl.timestamp() if dl else float('inf'))

    for key in ('to_submit', 'late', 'changes_requested'):
        buckets[key].sort(key=urgency)
    return buckets
