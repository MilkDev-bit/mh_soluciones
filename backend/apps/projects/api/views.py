import logging
from datetime import datetime, date

from django.db import IntegrityError
from django.db.models import Q, Count, Case, When, IntegerField, F
from rest_framework import viewsets, permissions, status, filters
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied

from apps.core.permissions import ADMIN_ROLES, ROLE_ADMIN, ROLE_STUDENT, CanManageProjects
from apps.core.utils import (
    success_response, error_response, created_response,
    updated_response, validation_error_response
)
from apps.authentication.models import CustomUser
from apps.tasks.models import TaskSubmission
from apps.documents.models import Document
from ..models import Project, ProjectMember, ProjectComment, ProjectSubmission
from .serializers import (
    ProjectSerializer,
    ProjectDetailSerializer,
    ProjectCreateUpdateSerializer,
    AddMembersSerializer,
    ProjectCommentSerializer,
    ProjectSubmissionSerializer
)
from .permissions import IsOwnerOrAdmin, IsProjectMemberOrAdmin, CanInteractInProject, IsAdminRole

logger = logging.getLogger(__name__)


class ProjectViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar Proyectos.
    
    Permissions:
    - DIRECTOR: Can create projects and assign members
    - ADMIN_ROLES: Full access
    - Others: Based on project membership
    """
    permission_classes = [permissions.IsAuthenticated, IsProjectMemberOrAdmin]
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'description']

    def _validate_client_access(self, user, project):
        """
        Validates that a CLIENT user has access to the project.
        Raises PermissionDenied if user is CLIENT but not assigned to this project.
        """
        if user.role == 'CLIENT' and user.is_authenticated:
            is_client_fk = project.client and project.client.id == user.id
            is_member = ProjectMember.objects.filter(project=project, user=user).exists()
            if not is_client_fk and not is_member:
                raise PermissionDenied("No tienes acceso a este proyecto.")

    def get_queryset(self):
        user = self.request.user
        base_qs = Project.objects.annotate(
            tasks_count=Count('tasks', distinct=True)
        ).prefetch_related('members')

        if user.role in ADMIN_ROLES and user.role != ROLE_ADMIN:
            qs = base_qs.all()
        elif user.role == ROLE_ADMIN:
            project_ids = ProjectMember.objects.filter(user=user).values_list('project_id', flat=True)
            qs = base_qs.filter(
                Q(id__in=project_ids) |
                Q(created_by=user)
            ).distinct()
        elif user.role == ROLE_STUDENT:
            project_ids = ProjectMember.objects.filter(user=user).values_list('project_id', flat=True)
            qs = base_qs.filter(id__in=project_ids).exclude(status='COMPLETED')
        else:
            project_ids = ProjectMember.objects.filter(user=user).values_list('project_id', flat=True)
            qs = base_qs.filter(
                Q(id__in=project_ids) |
                Q(created_by=user) |
                Q(client=user)
            ).distinct()

        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)

        return qs

    def paginate_queryset(self, queryset):
        """Disable pagination if '?all=true' is in the request (useful for select dropdowns)"""
        if self.request.query_params.get('all') == 'true':
            return None
        return super().paginate_queryset(queryset)

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return ProjectCreateUpdateSerializer
        if self.action == 'retrieve':
            return ProjectDetailSerializer
        if self.action == 'add_members':
            return AddMembersSerializer
        return ProjectSerializer

    def perform_create(self, serializer):
        if self.request.user.role not in ADMIN_ROLES:
            raise PermissionDenied("No tienes permisos para crear proyectos.")
        
        project = serializer.save(created_by=self.request.user)
        ProjectMember.objects.create(
            project=project,
            user=self.request.user,
            role=ProjectMember.ProjectRole.LEAD
        )

    @action(detail=True, methods=['post'], url_path='add-members')
    def add_members(self, request, pk=None):
        if self.request.user.role not in ADMIN_ROLES:
            raise PermissionDenied("No tienes permisos para añadir miembros.")
        
        project = self.get_object()
        serializer = self.get_serializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            user_ids = serializer.validated_data['user_ids']
            
            existing_users = CustomUser.objects.filter(id__in=user_ids)
            existing_user_ids = set(existing_users.values_list('id', flat=True))
            
            usuarios_inexistentes = set(user_ids) - existing_user_ids
            if usuarios_inexistentes:
                return Response(
                    {'error': f'Los siguientes usuarios no existen: {list(usuarios_inexistentes)}'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            miembros_existentes_ids = set(ProjectMember.objects.filter(
                project=project
            ).values_list('user_id', flat=True))
            
            nuevos_user_ids = set(user_ids) - miembros_existentes_ids
            nuevos_miembros = []

            for user_id in nuevos_user_ids:
                nuevos_miembros.append(
                    ProjectMember(project=project, user_id=user_id)
                )

            if nuevos_miembros:
                ProjectMember.objects.bulk_create(nuevos_miembros)

            return Response({
                'status': 'miembros añadidos correctamente',
                'miembros_agregados': len(nuevos_miembros),
                'ya_eran_miembros': len(user_ids) - len(nuevos_miembros)
            }, status=status.HTTP_200_OK)
            
        except IntegrityError as e:
            logger.error(f"Error de integridad añadiendo miembros al proyecto {project.id}: {str(e)}")
            return Response(
                {'error': 'Error de integridad de datos al añadir miembros'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"Error inesperado añadiendo miembros al proyecto {project.id}: {str(e)}")
            return Response(
                {'error': 'Error interno del servidor al procesar la solicitud'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['get'], url_path='get-members')
    def get_members(self, request, pk=None):
        project = self.get_object()
        miembros = ProjectMember.objects.filter(project=project).select_related('user')
        data = [
            {
                'id': miembro.user.id,
                'first_name': miembro.user.first_name,
                'last_name': miembro.user.last_name,
                'email': miembro.user.email
            }
            for miembro in miembros
        ]
        return Response({'members': data}, status=status.HTTP_200_OK)
        

    @action(detail=True, methods=['delete'], url_path='remove-member/(?P<user_id>[^/.]+)')
    def remove_member(self, request, pk=None, user_id=None):
        if self.request.user.role not in ADMIN_ROLES:
            raise PermissionDenied("No tienes permisos para eliminar miembros.")
        
        project = self.get_object()
        try:
            member = ProjectMember.objects.get(project=project, user_id=user_id)
            if member.user_id == project.created_by_id:
                return Response({'error': 'No puedes eliminar al creador del proyecto.'}, status=status.HTTP_400_BAD_REQUEST)
            member.delete()
            return Response({'status': 'miembro eliminado'}, status=status.HTTP_200_OK)
        except ProjectMember.DoesNotExist:
            return Response({'error': 'Miembro no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'], url_path='progress-stats', permission_classes=[permissions.IsAuthenticated])
    def progress_stats(self, request, pk=None):
        """
        Returns progress statistics for the project based on tasks.
        Accessible to all authenticated users who are project members.
        Provides data for pie and bar charts showing project progress.
        Also includes submission count for informational purposes.
        """
        project = self.get_object()
        user = request.user
        
        # Verify user is a project member (admins can access all projects)
        if user.role not in ADMIN_ROLES:
            is_member = ProjectMember.objects.filter(
                project=project,
                user=user
            ).exists()
            if not is_member:
                raise PermissionDenied("No eres miembro de este proyecto.")
        tasks = project.tasks.all()
        submissions = project.submissions.all()

        # Task status distribution
        task_stats = {
            'pending': tasks.filter(status='PENDING').count(),
            'in_progress': tasks.filter(status='IN_PROGRESS').count(),
            'for_review': tasks.filter(status='FOR_REVIEW').count(),
            'completed': tasks.filter(status='COMPLETED').count(),
        }
        total_tasks = sum(task_stats.values())

        # Task priority distribution
        priority_stats = {
            'low': tasks.filter(priority='LOW').count(),
            'medium': tasks.filter(priority='MEDIUM').count(),
            'high': tasks.filter(priority='HIGH').count(),
        }

        # Submission stats
        total_submissions = submissions.count()

        # Calculate overall progress percentage
        progress_percentage = 0
        if total_tasks > 0:
            progress_percentage = round((task_stats['completed'] / total_tasks) * 100)

        return Response({
            'task_stats': task_stats,
            'priority_stats': priority_stats,
            'total_tasks': total_tasks,
            'total_submissions': total_submissions,
            'progress_percentage': progress_percentage,
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='student-performance')
    def student_performance(self, request, pk=None):
        """
        Desempeño de los estudiantes EN ESTE PROYECTO (ver project_student_performance).
        Accessible by admins and CLIENT role (if they are the project client).
        """
        try:
            project = self.get_object()
            user = request.user
            self._validate_client_access(user, project)
            
            return Response(project_student_performance(project), status=status.HTTP_200_OK)

        except PermissionDenied:
            raise
        except Exception as e:
            try:
                project_id = project.id
            except (NameError, AttributeError):
                project_id = pk if pk else 'unknown'
            
            logger.error(f"Error inesperado en student_performance para proyecto {project_id}: {str(e)}", exc_info=True)
            return Response({
                'error': f'Error al obtener desempeño de estudiantes: {str(e)}',
                'students': [],
                'total_students': 0
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'], url_path='drive-folder')
    def drive_folder(self, request, pk=None):
        """
        Returns Google Drive folder information for the project.
        Accessible by admins and CLIENT role (if they are the project client).
        Returns folder URL and list of files in the project's Drive folder.
        Supports pagination, search by name, and folder type filtering.
        
        Query parameters:
        - page: Page number for pagination (default: 1)
        - page_size: Number of items per page (default: 20, max: 100)
        - search: Search term to filter documents by name
        - folder_type: Filter by folder type (OPERATIVO, ADMINISTRATIVO, etc.)
        """
        project = self.get_object()
        user = request.user
        
        # Validate CLIENT access
        self._validate_client_access(user, project)
        
        # Get query parameters with validation
        search = request.query_params.get('search', '').strip()
        folder_type = request.query_params.get('folder_type', '').strip()
        
        try:
            page = max(int(request.query_params.get('page', 1)), 1)
        except (ValueError, TypeError):
            page = 1
            
        try:
            page_size = max(1, min(int(request.query_params.get('page_size', 20)), 100))
        except (ValueError, TypeError):
            page_size = 20
        
        # Get all documents for this project
        documents = Document.objects.filter(
            project=project,
            upload_status='COMPLETE'
        )
        
        # Apply search filter
        if search:
            documents = documents.filter(name__icontains=search)
        
        # Apply folder type filter
        if folder_type:
            documents = documents.filter(folder_type=folder_type)
        
        # Order by creation date
        documents = documents.order_by('-created_at')
        
        # Calculate total and pagination
        total_documents = documents.count()
        start = (page - 1) * page_size
        end = start + page_size
        paginated_documents = documents[start:end]
        
        folder_info = {
            'project_name': project.name,
            'total_documents': total_documents,
            'page': page,
            'page_size': page_size,
            'total_pages': (total_documents + page_size - 1) // page_size if page_size > 0 else 0,
            'has_next': end < total_documents,
            'has_previous': page > 1,
            'documents': []
        }
        
        for doc in paginated_documents:
            folder_info['documents'].append({
                'id': doc.id,
                'name': doc.name,
                'drive_file_id': doc.drive_file_id,
                'drive_file_url': doc.drive_file_url,
                'file_size': doc.file_size,
                'file_type': doc.file_type,
                'folder_type': doc.folder_type,
                'uploaded_by': {
                    'id': doc.uploaded_by.id if doc.uploaded_by else None,
                    'name': f"{doc.uploaded_by.first_name} {doc.uploaded_by.last_name}" if doc.uploaded_by else "Unknown"
                },
                'created_at': doc.created_at
            })
        
        return Response(folder_info, status=status.HTTP_200_OK)
        

class ProjectCommentViewSet(viewsets.ModelViewSet):
    queryset = ProjectComment.objects.all()
    serializer_class = ProjectCommentSerializer
    permission_classes = [permissions.IsAuthenticated, IsProjectMemberOrAdmin]

    def get_permissions(self):
        if self.action in ['update', 'partial_update', 'destroy']:
            self.permission_classes = [IsOwnerOrAdmin]
        else:
            self.permission_classes = [CanInteractInProject]
        return super().get_permissions()
    
    def get_queryset(self):
        qs = ProjectComment.objects.filter(project_id=self.kwargs['project_pk'])
        # For listing, only return top-level comments (replies are nested in the serializer)
        if self.action == 'list':
            qs = qs.filter(parent=None)
        return qs

    def perform_create(self, serializer):
        from apps.authentication.models import CustomUser
        from utils.email_notifications import send_mention_notification, send_reply_notification
        from ..models import ProjectMember

        mentioned_user_ids = serializer.validated_data.pop('mentioned_user_ids', [])
        parent_id = serializer.validated_data.pop('parent_id', None)

        # Validate parent belongs to this project and is a top-level comment
        parent = None
        if parent_id:
            try:
                parent = ProjectComment.objects.get(
                    id=parent_id,
                    project_id=self.kwargs['project_pk'],
                    parent=None  # Only allow replying to top-level comments
                )
            except ProjectComment.DoesNotExist:
                pass

        comment = serializer.save(
            user=self.request.user,
            project_id=self.kwargs['project_pk'],
            parent=parent
        )

        # Validate mentioned users are project members
        project_member_user_ids = set(
            ProjectMember.objects.filter(project=comment.project).values_list('user_id', flat=True)
        )
        valid_mention_ids = [uid for uid in mentioned_user_ids if uid in project_member_user_ids]

        if valid_mention_ids:
            valid_users = CustomUser.objects.filter(id__in=valid_mention_ids)
            comment.mentioned_users.set(valid_users)

            for user in valid_users:
                if user.id != self.request.user.id and user.email:
                    try:
                        send_mention_notification(comment, user)
                    except Exception:
                        pass

        # Send reply notification to parent comment author
        if parent and parent.user_id != self.request.user.id and parent.user.email:
            # Avoid double-email if author was also mentioned
            already_notified_ids = set(valid_mention_ids)
            if parent.user_id not in already_notified_ids:
                try:
                    send_reply_notification(comment, parent.user)
                except Exception:
                    pass

class ProjectSubmissionViewSet(viewsets.ModelViewSet):
    """ ViewSet para gestionar las entregas de los proyectos. """
    queryset = ProjectSubmission.objects.all()
    serializer_class = ProjectSubmissionSerializer
    permission_classes = [permissions.IsAuthenticated, IsProjectMemberOrAdmin]

    def get_permissions(self):
        """
        Asigna permisos basados en la acción.
        - Miembros del proyecto pueden crear y ver.
        - Solo el autor o un admin puede editar o eliminar.
        """
        if self.action in ['update', 'partial_update', 'destroy']:
            self.permission_classes = [IsOwnerOrAdmin]
        else:
            self.permission_classes = [CanInteractInProject]
        return super().get_permissions()
    
    def get_queryset(self):
        return ProjectSubmission.objects.filter(project_id=self.kwargs['project_pk'])

    def perform_create(self, serializer):
        serializer.save(
            submitted_by=self.request.user, 
            project_id=self.kwargs['project_pk']
        )


# Standalone view for getting project Drive files
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_project_drive_folder(request, project_id):
    """
    Obtiene los archivos de Google Drive de un proyecto específico.
    Los clientes solo pueden ver archivos de proyectos donde son miembros.
    """
    try:
        project = Project.objects.get(id=project_id)
        user = request.user
        
        # Verificar permisos
        if user.role == 'CLIENT':
            # Cliente solo puede ver proyectos donde es miembro o es el cliente asignado
            is_client = project.client and project.client.id == user.id
            is_member = ProjectMember.objects.filter(project=project, user=user).exists()
            
            if not is_client and not is_member:
                return Response(
                    {'error': 'No tienes acceso a este proyecto'},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        # Obtener documentos del proyecto que están en Drive
        documents = Document.objects.filter(
            project=project,
            upload_status=Document.UploadStatus.COMPLETE
        ).select_related('uploaded_by')
        
        documents_data = []
        for doc in documents:
            documents_data.append({
                'id': doc.id,
                'name': doc.name,
                'file_type': doc.file_type,
                'file_size': doc.file_size,
                'folder_type': doc.folder_type,
                'drive_file_url': doc.drive_file_url,
                'drive_file_id': doc.drive_file_id,
                'uploaded_by': {
                    'name': doc.uploaded_by.get_full_name() if doc.uploaded_by else 'Desconocido',
                    'username': doc.uploaded_by.username if doc.uploaded_by else ''
                },
                'created_at': doc.created_at
            })
        
        return Response({
            'project_name': project.name,
            'total_documents': documents.count(),
            'documents': documents_data
        })
        
    except Project.DoesNotExist:
        return Response({'error': 'Proyecto no encontrado'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error al obtener archivos de Drive del proyecto: {e}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def project_student_performance(project, now=None):
    """
    Desempeño de cada estudiante calculado SOLO con las tareas de `project`.

    [FIX] Antes se contaba cada versión entregada (una tarea reenviada 3 veces
    sumaba 3 "a tiempo"), se comparaba contra due_date a medianoche, y las
    tareas que el alumno nunca entregó no contaban: con 1 entrega a tiempo y 20
    tareas sin entregar salía "100% Excelente", lo que hacía parecer que el
    dato venía de otros proyectos. Ahora, por cada tarea del proyecto asignada
    al alumno (sin actividades continuas ni borradores):
      - a tiempo:  su primera entrega llegó dentro de su fecha límite
                   (incluye prórrogas; misma regla que apps/tasks/deadlines.py)
      - tardía:    la primera entrega llegó después
      - sin entregar: ya venció y no entregó nada
      - pendiente: aún no vence y no ha entregado (no afecta el porcentaje)
    Efectividad = a tiempo / (a tiempo + tardías + sin entregar).
    """
    from django.db.models import Min
    from django.utils import timezone
    from apps.tasks import deadlines
    from apps.tasks.models import Task

    now = now or timezone.now()
    tasks = list(
        Task.objects.filter(project=project, is_continuous=False)
        .exclude(status='DRAFT')
        .select_related('assigned_to')
        .prefetch_related('assigned_students', 'reopen_logs__specific_students')
    )

    # Estudiantes: miembros con rol STUDENT + asignados a tareas del proyecto
    students = {u.pk: u for u in project.members.filter(role='STUDENT')}
    assignees = {}
    for task in tasks:
        ids = {s.pk for s in task.assigned_students.all()}
        if task.assigned_to_id:
            ids.add(task.assigned_to_id)
            if task.assigned_to.role == 'STUDENT':
                students.setdefault(task.assigned_to_id, task.assigned_to)
        for s in task.assigned_students.all():
            if s.role == 'STUDENT':
                students.setdefault(s.pk, s)
        assignees[task.pk] = ids

    if not students:
        return {'students': [], 'total_students': 0, 'scope': 'project',
                'message': 'No hay estudiantes asignados a este proyecto'}

    first_submission = {
        (row['task_id'], row['submitted_by_id']): row['first_at']
        for row in TaskSubmission.objects.filter(task__project=project, submitted_by_id__in=students.keys())
        .values('task_id', 'submitted_by_id').annotate(first_at=Min('created_at'))
    }

    students_data = []
    for student in students.values():
        on_time = late = missed = pending = assigned = 0
        for task in tasks:
            if student.pk not in assignees.get(task.pk, ()):
                continue
            assigned += 1
            deadline = deadlines.deadline_for(task, student)
            submitted_at = first_submission.get((task.pk, student.pk))
            if submitted_at:
                if deadline is None or submitted_at <= deadline:
                    on_time += 1
                else:
                    late += 1
            elif deadline is not None and now > deadline:
                missed += 1
            else:
                pending += 1
        evaluated = on_time + late + missed
        students_data.append({
            'id': student.pk,
            'name': f"{student.first_name} {student.last_name}".strip() or student.username,
            'email': student.email,
            'assigned_tasks': assigned,
            'on_time_submissions': on_time,
            'late_submissions': late,
            'missed_tasks': missed,
            'pending_tasks': pending,
            # compatibilidad: antes era el total de versiones entregadas
            'total_submissions': on_time + late,
            'evaluated_tasks': evaluated,
            'on_time_percentage': round(on_time * 100 / evaluated) if evaluated else 0,
        })

    students_data.sort(key=lambda x: (-x['on_time_percentage'], -x['evaluated_tasks'], x['name'].lower()))
    return {'students': students_data, 'total_students': len(students_data), 'scope': 'project'}
