import logging
from datetime import datetime, date

from django.db import IntegrityError
from django.db.models import Q, Count, Case, When, IntegerField
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied

from apps.authentication.models import CustomUser
from apps.tasks.models import TaskSubmission
from apps.documents.models import Document
from ..models import (
    Project, ProjectMember, ProjectComment, ProjectSubmission,
    Channel, ChannelMessage, ChannelFile
)
from .serializers import (
    ProjectSerializer,
    ProjectDetailSerializer,
    ProjectCreateUpdateSerializer,
    AddMembersSerializer,
    ProjectCommentSerializer,
    ProjectSubmissionSerializer,
    ChannelSerializer,
    ChannelMessageSerializer,
    ChannelFileSerializer
)
from .permissions import IsOwnerOrAdmin, IsProjectMemberOrAdmin, CanInteractInProject, IsAdminRole

logger = logging.getLogger(__name__)

# Admin roles constant to avoid repetition
ADMIN_ROLES = ('SUPERADMIN', 'ADMIN', 'CEO', 'RH')


class ProjectViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, IsProjectMemberOrAdmin]

    def _validate_client_access(self, user, project):
        """
        Validates that a CLIENT user has access to the project.
        Raises PermissionDenied if user is CLIENT but not assigned to this project.
        """
        if user.role == 'CLIENT' and user.is_authenticated:
            if not project.client or project.client.id != user.id:
                raise PermissionDenied("No tienes acceso a este proyecto.")

    def get_queryset(self):
        user = self.request.user

        if user.role in ADMIN_ROLES:
            return Project.objects.all().prefetch_related('members')

        if user.role == 'STUDENT':
            project_ids = ProjectMember.objects.filter(user=user).values_list('project_id', flat=True)
            return Project.objects.filter(id__in=project_ids).prefetch_related('members')

        project_ids = ProjectMember.objects.filter(user=user).values_list('project_id', flat=True)
        return Project.objects.filter(
            Q(id__in=project_ids) |
            Q(created_by=user) |
            Q(client=user)
        ).distinct().prefetch_related('members')

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
        Returns student performance metrics based on task submissions.
        Shows on-time vs late submissions for students (STUDENT role) in the project.
        Accessible by admins and CLIENT role (if they are the project client).
        """
        try:
            project = self.get_object()
            user = request.user
            
            # Validate CLIENT access
            self._validate_client_access(user, project)
            
            # Get all students assigned to tasks in this project
            student_ids = project.tasks.filter(
                assigned_students__role='STUDENT'
            ).values_list('assigned_students__id', flat=True).distinct()
            
            # Also get students assigned to individual tasks
            individual_student_ids = project.tasks.filter(
                assigned_to__role='STUDENT'
            ).values_list('assigned_to__id', flat=True).distinct()
            
            # Get students who are members of the project
            try:
                # project.members returns CustomUser objects (not ProjectMember)
                # Filter directly on CustomUser.role field
                project_member_student_ids = project.members.filter(
                    role='STUDENT'
                ).values_list('id', flat=True).distinct()
            except Exception as e:
                logger.warning(f"Error al obtener miembros estudiantes del proyecto {pk}: {str(e)}")
                project_member_student_ids = []
            
            # Combine all sets of student IDs efficiently
            all_student_ids = set(student_ids) | set(individual_student_ids) | set(project_member_student_ids)
            
            if not all_student_ids:
                return Response({
                    'students': [],
                    'message': 'No hay estudiantes asignados a este proyecto'
                }, status=status.HTTP_200_OK)
            
            students_data = []
            
            for student_id in all_student_ids:
                try:
                    student = CustomUser.objects.get(id=student_id, role='STUDENT')
                except CustomUser.DoesNotExist:
                    logger.warning(f"Estudiante con ID {student_id} no encontrado o no tiene rol STUDENT")
                    continue
                
                # Get all submissions for this student in this project
                submissions = TaskSubmission.objects.filter(
                    task__project=project,
                    submitted_by=student
                ).select_related('task')
                
                total_submissions = submissions.count()
                on_time_count = 0
                late_count = 0
                
                for submission in submissions:
                    task = submission.task
                    # Check if submission was on time
                    if task.due_date and submission.created_at:
                        # Convert datetime to date for comparison if needed
                        if isinstance(submission.created_at, datetime):
                            submission_date = submission.created_at.date()
                        elif isinstance(submission.created_at, date):
                            submission_date = submission.created_at
                        else:
                            continue
                        
                        # Compare dates (task.due_date is a DateField)
                        if submission_date <= task.due_date:
                            on_time_count += 1
                        else:
                            late_count += 1
                    else:
                        # If no due date, count as on time
                        on_time_count += 1
                
                # Calculate on-time percentage
                on_time_percentage = 0
                if total_submissions > 0:
                    on_time_percentage = round((on_time_count / total_submissions) * 100)
                
                students_data.append({
                    'id': student.id,
                    'name': f"{student.first_name} {student.last_name}",
                    'email': student.email,
                    'total_submissions': total_submissions,
                    'on_time_submissions': on_time_count,
                    'late_submissions': late_count,
                    'on_time_percentage': on_time_percentage
                })
            
            # Sort by on_time_percentage descending
            students_data.sort(key=lambda x: x['on_time_percentage'], reverse=True)
            
            return Response({
                'students': students_data,
                'total_students': len(students_data)
            }, status=status.HTTP_200_OK)
            
        except PermissionDenied:
            # Re-raise permission errors
            raise
        except Exception as e:
            # Safely get project ID for logging (pk is a method parameter, always available)
            try:
                project_id = project.id
            except (NameError, AttributeError):
                # Fallback to pk parameter if project.id is not accessible
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
        """
        project = self.get_object()
        user = request.user
        
        # Validate CLIENT access
        self._validate_client_access(user, project)
        
        # Get all documents for this project
        
        documents = Document.objects.filter(
            project=project,
            upload_status='COMPLETE'
        ).order_by('-created_at')
        
        folder_info = {
            'project_name': project.name,
            'total_documents': documents.count(),
            'documents': []
        }
        
        for doc in documents:
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
        return ProjectComment.objects.filter(project_id=self.kwargs['project_pk'])

    def perform_create(self, serializer):
        serializer.save(
            user=self.request.user, 
            project_id=self.kwargs['project_pk']
        )

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


class ChannelViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar los canales de un proyecto.
    """
    serializer_class = ChannelSerializer
    permission_classes = [permissions.IsAuthenticated, IsProjectMemberOrAdmin]
    
    def get_queryset(self):
        """Filtra canales por proyecto."""
        project_pk = self.kwargs.get('project_pk')
        queryset = Channel.objects.filter(project_id=project_pk)
        
        # Filtrar canales privados
        user = self.request.user
        if user.role not in ADMIN_ROLES:
            queryset = queryset.filter(
                Q(is_private=False) | Q(members=user)
            ).distinct()
        
        return queryset.select_related('created_by', 'project')
    
    def perform_create(self, serializer):
        """Crea un canal en el proyecto especificado."""
        project_pk = self.kwargs.get('project_pk')
        project = Project.objects.get(pk=project_pk)
        
        # Validar permisos
        if self.request.user.role not in ADMIN_ROLES:
            if not ProjectMember.objects.filter(project=project, user=self.request.user).exists():
                raise PermissionDenied("No tienes permisos para crear canales en este proyecto.")
        
        serializer.save(
            project=project,
            created_by=self.request.user
        )
    
    @action(detail=True, methods=['post'], url_path='add-members')
    def add_members(self, request, project_pk=None, pk=None):
        """Añade miembros a un canal privado."""
        channel = self.get_object()
        
        if not channel.is_private:
            return Response(
                {'error': 'Solo se pueden añadir miembros a canales privados.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user_ids = request.data.get('user_ids', [])
        if not user_ids:
            return Response(
                {'error': 'Debe proporcionar al menos un usuario.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        users = CustomUser.objects.filter(id__in=user_ids)
        channel.members.add(*users)
        
        return Response(
            {'message': f'{len(users)} miembro(s) añadido(s) al canal.'},
            status=status.HTTP_200_OK
        )


class ChannelMessageViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar los mensajes de un canal.
    """
    serializer_class = ChannelMessageSerializer
    permission_classes = [permissions.IsAuthenticated, IsProjectMemberOrAdmin]
    
    def get_queryset(self):
        """Filtra mensajes por canal."""
        channel_pk = self.kwargs.get('channel_pk')
        return ChannelMessage.objects.filter(
            channel_id=channel_pk
        ).select_related('author', 'channel').prefetch_related('mentions', 'replies')
    
    def perform_create(self, serializer):
        """Crea un mensaje en el canal especificado."""
        channel_pk = self.kwargs.get('channel_pk')
        channel = Channel.objects.get(pk=channel_pk)
        
        # Validar acceso al canal
        user = self.request.user
        if channel.is_private:
            if user.role not in ADMIN_ROLES and not channel.members.filter(id=user.id).exists():
                raise PermissionDenied("No tienes acceso a este canal privado.")
        
        # Extraer menciones del contenido
        content = serializer.validated_data.get('content', '')
        mention_ids = self._extract_mentions(content)
        
        message = serializer.save(
            channel=channel,
            author=self.request.user
        )
        
        # Añadir menciones
        if mention_ids:
            mentioned_users = CustomUser.objects.filter(id__in=mention_ids)
            message.mentions.add(*mentioned_users)
        
        return message
    
    def _extract_mentions(self, content):
        """Extrae IDs de usuarios mencionados del contenido."""
        import re
        # Buscar patrones como @[Usuario](id:123)
        pattern = r'@\[.*?\]\(id:(\d+)\)'
        matches = re.findall(pattern, content)
        return [int(match) for match in matches]
    
    @action(detail=True, methods=['post'], url_path='react')
    def react(self, request, project_pk=None, channel_pk=None, pk=None):
        """Añade o quita una reacción a un mensaje."""
        message = self.get_object()
        emoji = request.data.get('emoji')
        
        if not emoji:
            return Response(
                {'error': 'Debe proporcionar un emoji.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        reactions = message.reactions or {}
        user_id = str(request.user.id)
        
        if emoji not in reactions:
            reactions[emoji] = []
        
        if user_id in reactions[emoji]:
            # Quitar reacción
            reactions[emoji].remove(user_id)
            if not reactions[emoji]:
                del reactions[emoji]
        else:
            # Añadir reacción
            reactions[emoji].append(user_id)
        
        message.reactions = reactions
        message.save()
        
        return Response(
            ChannelMessageSerializer(message, context={'request': request}).data,
            status=status.HTTP_200_OK
        )


class ChannelFileViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar los archivos de un canal.
    """
    serializer_class = ChannelFileSerializer
    permission_classes = [permissions.IsAuthenticated, IsProjectMemberOrAdmin]
    
    def get_queryset(self):
        """Filtra archivos por canal."""
        channel_pk = self.kwargs.get('channel_pk')
        return ChannelFile.objects.filter(
            channel_id=channel_pk
        ).select_related('uploaded_by', 'channel')
    
    def perform_create(self, serializer):
        """Sube un archivo al canal especificado."""
        channel_pk = self.kwargs.get('channel_pk')
        channel = Channel.objects.get(pk=channel_pk)
        
        # Validar acceso al canal
        user = self.request.user
        if channel.is_private:
            if user.role not in ADMIN_ROLES and not channel.members.filter(id=user.id).exists():
                raise PermissionDenied("No tienes acceso a este canal privado.")
        
        # Obtener información del archivo
        file = self.request.FILES.get('file')
        if file:
            file_name = file.name
            file_size = file.size
            mime_type = file.content_type
        else:
            file_name = serializer.validated_data.get('file_name', '')
            file_size = 0
            mime_type = ''
        
        serializer.save(
            channel=channel,
            uploaded_by=self.request.user,
            file_name=file_name,
            file_size=file_size,
            mime_type=mime_type
        )