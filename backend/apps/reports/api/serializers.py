from rest_framework import serializers
from apps.projects.models import Project
from apps.tasks.models import Task
from apps.authentication.models import CustomUser

class SearchResultSerializer(serializers.Serializer):
    """
    Un serializador genérico para representar cualquier tipo de resultado de búsqueda.
    """
    id = serializers.IntegerField()
    name = serializers.CharField()
    type = serializers.CharField()
    url = serializers.CharField()
    details = serializers.CharField()