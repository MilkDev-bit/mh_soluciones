from rest_framework import serializers
from ..models import Document
from apps.authentication.api.serializers import UserSerializer

class DocumentSerializer(serializers.ModelSerializer):
    """
    Serializador para el modelo Document.
    Define cómo se muestran y se reciben los datos del documento.
    """
    uploaded_by = UserSerializer(read_only=True)
    file_url = serializers.SerializerMethodField()
    project_info = serializers.SerializerMethodField()
    target_folder_id = serializers.CharField(write_only=True, required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = Document
        fields = [
            'id',
            'name',
            'file',
            'file_url',
            'file_size',
            'file_type',
            'folder_type',
            'project',
            'project_info',
            'task',
            'uploaded_by',
            'created_at',
            'upload_status',
            'drive_file_url',
            'drive_parent_folder_id',
            'drive_parent_folder_name',
            'notes',
            'target_folder_id',
            'is_link',
            'link',
        ]
        read_only_fields = [
            'id', 'file_size', 'file_type', 'uploaded_by', 'created_at', 
            'upload_status', 'drive_file_url', 'file_url', 
            'drive_parent_folder_id', 'drive_parent_folder_name', 'project_info',
            'is_link', 'link',
        ]

    def get_file_url(self, obj):
        if obj.file:
            return obj.file.url
        return None

    def get_project_info(self, obj):
        """Return minimal project information"""
        if obj.project:
            return {
                'id': obj.project.id,
                'name': obj.project.name
            }
        return None

    def create(self, validated_data):
        # Remove target_folder_id from validated_data as it's not a model field
        # It's used in the view to determine upload destination
        validated_data.pop('target_folder_id', None)
        return super().create(validated_data)

    def validate_file(self, value):
        """Validar el archivo"""
        if value.size > 40 * 1024 * 1024:
            raise serializers.ValidationError("El archivo no puede ser mayor a 40MB")
        
        allowed_extensions = ['.pdf', '.doc', '.docx', '.zip', '.rar', 
                             '.jpg', '.jpeg', '.png', '.txt']
        if not any(value.name.lower().endswith(ext) for ext in allowed_extensions):
            raise serializers.ValidationError("Tipo de archivo no permitido")
        
        return value