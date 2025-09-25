from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import EmployeeDocumentViewSet, PerformanceReviewViewSet

router = DefaultRouter()
router.register(r'employee-documents', EmployeeDocumentViewSet, basename='employeedocument')
router.register(r'performance-reviews', PerformanceReviewViewSet, basename='performancereview')

urlpatterns = [
    path('', include(router.urls)),
]