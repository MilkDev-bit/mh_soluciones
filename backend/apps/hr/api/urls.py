from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import EmployeeDocumentViewSet, PerformanceReviewViewSet, AttendanceViewSet

router = DefaultRouter()
router.register(r'employee-documents', EmployeeDocumentViewSet, basename='employeedocument')
router.register(r'performance-reviews', PerformanceReviewViewSet, basename='performancereview')
router.register(r'attendances', AttendanceViewSet, basename='attendance')

urlpatterns = [
    path('', include(router.urls)),
]