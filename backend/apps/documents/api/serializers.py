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
    project = serializers.SerializerMethodField()

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
            'task',
            'uploaded_by',
            'created_at',
            'upload_status',
            'drive_file_url',
            'notes'
        ]
        read_only_fields = [
            'id', 'file_size', 'file_type', 'uploaded_by', 'created_at', 
            'upload_status', 'drive_file_url', 'file_url'
        ]

    def get_file_url(self, obj):
        if obj.file:
            return obj.file.url
        return None

    def get_project(self, obj):
        """Return minimal project information"""
        if obj.project:
            return {
                'id': obj.project.id,
                'name': obj.project.name
            }
        return None

    def create(self, validated_data):
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