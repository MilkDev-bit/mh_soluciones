from rest_framework_nested import routers
from django.urls import path
from .views import ProjectViewSet, ProjectCommentViewSet, ProjectSubmissionViewSet, get_project_drive_folder

router = routers.SimpleRouter()
router.register(r'', ProjectViewSet, basename='project')

comments_router = routers.NestedSimpleRouter(router, r'', lookup='project')
comments_router.register(r'comments', ProjectCommentViewSet, basename='project-comments')

submissions_router = routers.NestedSimpleRouter(router, r'', lookup='project')
submissions_router.register(r'submissions', ProjectSubmissionViewSet, basename='project-submissions')

urlpatterns = [
    path('<int:project_id>/drive-folder/', get_project_drive_folder, name='project-drive-folder'),
] + router.urls + comments_router.urls + submissions_router.urls