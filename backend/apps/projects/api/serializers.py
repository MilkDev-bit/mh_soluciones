from rest_framework import serializers
from datetime import date
from ..models import Project, ProjectMember, ProjectComment, ProjectSubmission
from apps.authentication.models import CustomUser
from apps.authentication.api.serializers import UserSerializer

class ProjectMemberSerializer(serializers.ModelSerializer):
    """
    Serializador para los miembros de un proyecto.
    """
    user = UserSerializer(read_only=True)

    class Meta:
        model = ProjectMember
        fields = ['id', 'user', 'role', 'joined_at']


class ProjectSerializer(serializers.ModelSerializer):
    """
    Serializador para la lista de proyectos (vista general).
    """
    member_count = serializers.SerializerMethodField()
    progress = serializers.SerializerMethodField()
    tasks_count = serializers.IntegerField(read_only=True)
    status_display = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            'id', 
            'name', 
            'description',
            'status', 
            'status_display',
            'start_date', 
            'end_date', 
            'created_at',
            'member_count',
            'progress',
            'tasks_count',
        ]

    def get_member_count(self, obj):
        # Usar len(obj.members.all()) en lugar de obj.members.count() 
        # para aprovechar el prefetch_related('members') de la vista 
        # y evitar el problema de N+1 queries.
        return len(obj.members.all())

    def get_status_display(self, obj):
        return obj.get_status_display()

    def get_progress(self, obj):
        """
        Calcula el progreso basado en el tiempo transcurrido 
        entre la fecha de inicio y la fecha de fin.
        """
        if not obj.start_date or not obj.end_date:
            return 0 
            
        today = date.today()
        
        if today < obj.start_date:
            return 0
            
        if today > obj.end_date:
            return 100
            
        total_days = (obj.end_date - obj.start_date).days
        passed_days = (today - obj.start_date).days
        
        if total_days <= 0:
            return 100
            
        return int((passed_days / total_days) * 100)


class ProjectCommentSerializer(serializers.ModelSerializer):
    """ Serializador para los comentarios de proyectos. """
    user = UserSerializer(read_only=True)
    mentioned_users = UserSerializer(many=True, read_only=True)
    mentioned_user_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
        default=list
    )
    parent_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    replies = serializers.SerializerMethodField()

    class Meta:
        model = ProjectComment
        fields = ['id', 'user', 'comment', 'created_at', 'mentioned_users', 'mentioned_user_ids', 'parent_id', 'replies']
        read_only_fields = ('id', 'created_at')

    def get_replies(self, obj):
        # Only top-level comments expose replies (prevents infinite nesting)
        if obj.parent_id is not None:
            return []
        return ProjectCommentSerializer(
            obj.replies.all().select_related('user').prefetch_related('mentioned_users'),
            many=True
        ).data

class ProjectSubmissionSerializer(serializers.ModelSerializer):
    """ Serializador para las entregas de proyectos. """
    submitted_by = UserSerializer(read_only=True)
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = ProjectSubmission
        fields = ['id', 'project', 'submitted_by', 'notes', 'link', 'file', 'file_url', 'created_at']
        read_only_fields = ('id', 'created_at', 'project', 'submitted_by')
    
    def get_file_url(self, obj):
        """Devuelve la URL absoluta del archivo si existe."""
        if obj.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None

class ProjectDetailSerializer(ProjectSerializer):
    """
    Serializador para la vista de detalle de un proyecto.
    """
    client = UserSerializer(read_only=True)
    created_by = UserSerializer(read_only=True)
    members = serializers.SerializerMethodField()
    comments = serializers.SerializerMethodField()
    submissions = ProjectSubmissionSerializer(many=True, read_only=True)


    class Meta(ProjectSerializer.Meta):
        fields = ProjectSerializer.Meta.fields + [
            'description', 
            'client', 
            'created_by', 
            'members',
            'comments',
            'submissions' 
        ]

    def get_members(self, obj):
        """
        Obtiene la lista de miembros del proyecto, excluyendo aquellos sin usuario.
        """
        project_members = ProjectMember.objects.filter(project=obj).select_related('user')
        valid_members = [pm for pm in project_members if pm.user is not None]
        return ProjectMemberSerializer(
            valid_members,
            many=True,
            context=self.context
        ).data

    def get_comments(self, obj):
        """
        Returns only top-level comments (parent=None). Replies are nested inside each comment.
        """
        top_level = obj.comments.filter(parent=None).select_related('user').prefetch_related(
            'mentioned_users',
            'replies',
            'replies__user',
            'replies__mentioned_users',
        )
        return ProjectCommentSerializer(top_level, many=True).data


class ProjectCreateUpdateSerializer(serializers.ModelSerializer):
    """
    Serializador usado específicamente para crear y actualizar proyectos.
    Incluye validaciones mejoradas para fechas y campos requeridos.
    """
    client = serializers.PrimaryKeyRelatedField(
        queryset=CustomUser.objects.filter(role=CustomUser.Role.CLIENT),
        allow_null=True,
        required=False
    )

    class Meta:
        model = Project
        fields = [
            'name', 
            'description', 
            'status', 
            'client', 
            'start_date', 
            'end_date', 
        ]

    def validate_name(self, value):
        """
        Valida que el nombre no esté vacío y tenga una longitud adecuada.
        """
        if not value or not value.strip():
            raise serializers.ValidationError("El nombre del proyecto no puede estar vacío.")
        
        if len(value) > 255:
            raise serializers.ValidationError("El nombre del proyecto no puede exceder los 255 caracteres.")
        
        return value.strip()

    def validate(self, data):
        """
        Validaciones a nivel de objeto:
        1. La fecha de fin debe ser posterior a la de inicio
        2. El proyecto no puede durar más de 10 años
        """
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        
        if start_date and end_date:
            if end_date <= start_date:
                raise serializers.ValidationError({
                    'end_date': "La fecha de finalización debe ser posterior a la fecha de inicio."
                })
            
            # Validar que el proyecto no dure más de 10 años
            from datetime import timedelta
            duration = end_date - start_date
            if duration > timedelta(days=365*10):
                raise serializers.ValidationError({
                    'end_date': "El proyecto no puede durar más de 10 años."
                })
        
        return data


class AddMembersSerializer(serializers.Serializer):
    """
    Serializador para validar la lista de IDs de usuario a añadir.
    """
    user_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        allow_empty=False,
        max_length=100  # Limitar a 100 usuarios por operación
    )
    
    def validate_user_ids(self, value):
        """
        Valida que la lista no tenga duplicados y no exceda el límite.
        """
        if len(value) != len(set(value)):
            raise serializers.ValidationError("La lista contiene IDs duplicados.")
        
        if len(value) > 100:
            raise serializers.ValidationError("No se pueden añadir más de 100 miembros a la vez.")
        
        return value