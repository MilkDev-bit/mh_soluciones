from rest_framework import serializers
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
    progress = serializers.IntegerField(read_only=True)
    status_display = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            'id', 
            'name', 
            'status', 
            'status_display',
            'start_date', 
            'end_date', 
            'created_at',
            'member_count',
            'progress',
        ]

    def get_member_count(self, obj):
        """Devuelve la cantidad de miembros en el proyecto."""
        return obj.members.count()
    def get_status_display(self, obj):
        return obj.get_status_display()


class ProjectCommentSerializer(serializers.ModelSerializer):
    """ Serializador para los comentarios de proyectos. """
    user = UserSerializer(read_only=True)

    class Meta:
        model = ProjectComment
        fields = ['id', 'user', 'comment', 'created_at']
        read_only_fields = ('id', 'created_at')

class ProjectSubmissionSerializer(serializers.ModelSerializer):
    """ Serializador para las entregas de proyectos. """
    submitted_by = UserSerializer(read_only=True)

    class Meta:
        model = ProjectSubmission
        fields = ['id', 'project', 'submitted_by', 'notes', 'link', 'file', 'created_at']
        read_only_fields = ('id', 'created_at', 'project', 'submitted_by')

class ProjectDetailSerializer(ProjectSerializer):
    """
    Serializador para la vista de detalle de un proyecto.
    """
    client = UserSerializer(read_only=True)
    created_by = UserSerializer(read_only=True)
    members = serializers.SerializerMethodField()
    comments = ProjectCommentSerializer(many=True, read_only=True)
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


class ProjectCreateUpdateSerializer(serializers.ModelSerializer):
    """
    Serializador usado específicamente para crear y actualizar proyectos.
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


class AddMembersSerializer(serializers.Serializer):
    """
    Serializador para validar la lista de IDs de usuario a añadir.
    """
    user_ids = serializers.ListField(
        child=serializers.IntegerField(),
        allow_empty=False
    )