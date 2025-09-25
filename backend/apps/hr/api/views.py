from http.client import HTTPResponse
from rest_framework import viewsets
from ..models import EmployeeDocument, PerformanceReview
from .serializers import EmployeeDocumentSerializer, PerformanceReviewSerializer
from .permissions import IsHrOrSuperAdmin
from rest_framework.decorators import action
from rest_framework.response import Response
from django.http import HttpResponse, FileResponse
from django.shortcuts import get_object_or_404
import os

class EmployeeDocumentViewSet(viewsets.ModelViewSet):
    queryset = EmployeeDocument.objects.all()
    serializer_class = EmployeeDocumentSerializer
    permission_classes = [IsHrOrSuperAdmin]

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        try:
            document = get_object_or_404(EmployeeDocument, pk=pk)
            
            if document.file and os.path.exists(document.file.path):
                response = FileResponse(
                    document.file.open('rb'),
                    as_attachment=True,
                    filename=os.path.basename(document.file.name)
                )
                return response
            else:
                return Response(
                    {'error': 'El archivo no existe o no se encuentra'},
                    status=404
                )
                
        except Exception as e:
            return Response(
                {'error': f'Error al descargar el documento: {str(e)}'},
                status=500
            )

class PerformanceReviewViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar las evaluaciones de desempeño.
    """
    queryset = PerformanceReview.objects.select_related('employee', 'reviewer').all()
    serializer_class = PerformanceReviewSerializer
    permission_classes = [IsHrOrSuperAdmin]

    def perform_create(self, serializer):
        serializer.save(reviewer=self.request.user)