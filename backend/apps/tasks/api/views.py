from rest_framework import viewsets, permissions
from rest_framework.exceptions import PermissionDenied
from django.db.models import Q
from rest_framework.parsers import MultiPartParser, FormParser
from ..models import Task, TaskSubmission, TaskComment
from .serializers import (
    TaskSerializer,
    TaskDetailSerializer,
    TaskCreateUpdateSerializer,
    TaskSubmissionSerializer,
    TaskCommentSerializer
)
from .permissions import IsOwnerOrAdmin, CanInteractWithTask

class TaskViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar Tareas.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        base_queryset = Task.objects.none()

        if user.role in ['SUPERADMIN', 'ADMIN', 'CEO', 'RH']:
            base_queryset = Task.objects.all().select_related('project', 'assigned_to')
        else:
            base_queryset = Task.objects.filter(
                Q(project__members=user) |
                Q(assigned_to=user) |
                Q(created_by=user)
            ).distinct().select_related('project', 'assigned_to')

        project_id = self.request.query_params.get('project', None)
        if project_id:
            return base_queryset.filter(project_id=project_id)

        return base_queryset

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return TaskCreateUpdateSerializer
        if self.action == 'retrieve':
            return TaskDetailSerializer
        return TaskSerializer

    def perform_create(self, serializer):
        if self.request.user.role not in ['SUPERADMIN', 'ADMIN', 'CEO', 'RH']:
            raise PermissionDenied("No tienes permisos para crear tareas.")
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        if self.request.user.role not in ['SUPERADMIN', 'ADMIN', 'CEO', 'RH', 'PROFESSOR', 'DIRECTOR']:
            raise PermissionDenied("No tienes permisos para editar tareas.")
        serializer.save()

    def perform_destroy(self, instance):
        if self.request.user.role not in ['SUPERADMIN', 'ADMIN', 'CEO', 'RH']:
            raise PermissionDenied("No tienes permisos para eliminar tareas.")
        instance.delete()

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

class TaskCommentViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar los comentarios anidados de las tareas.
    """
    serializer_class = TaskCommentSerializer
    
    def get_permissions(self):
        if self.action in ['update', 'partial_update', 'destroy']:
            self.permission_classes = [IsOwnerOrAdmin]
        else:
            self.permission_classes = [CanInteractWithTask]
        return super().get_permissions()

    def get_queryset(self):
        return TaskComment.objects.filter(task_id=self.kwargs['task_pk']).select_related('user')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user, task_id=self.kwargs['task_pk'])

class TaskSubmissionViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar las entregas anidadas de las tareas.
    """
    serializer_class = TaskSubmissionSerializer
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [CanInteractWithTask]

    def get_queryset(self):
        return TaskSubmission.objects.filter(task_id=self.kwargs['task_pk']).select_related('submitted_by')

    def perform_create(self, serializer):
        serializer.save(submitted_by=self.request.user, task_id=self.kwargs['task_pk'])