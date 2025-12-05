import logging

from django.db import IntegrityError
from django.db.models import Q
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied

from apps.authentication.models import CustomUser
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

# Admin roles constant to avoid repetition
ADMIN_ROLES = ('SUPERADMIN', 'ADMIN', 'CEO', 'RH')


class ProjectViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, IsProjectMemberOrAdmin]

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

    @action(detail=True, methods=['get'], url_path='progress-stats')
    def progress_stats(self, request, pk=None):
        """
        Returns progress statistics for the project based on tasks.
        Provides data for pie and bar charts showing project progress.
        Also includes submission count for informational purposes.
        """
        project = self.get_object()
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