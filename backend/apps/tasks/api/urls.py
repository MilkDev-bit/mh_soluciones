from rest_framework_nested import routers
from .views import TaskViewSet, TaskCommentViewSet, TaskSubmissionViewSet

router = routers.SimpleRouter()
router.register(r'', TaskViewSet, basename='task')

comments_router = routers.NestedSimpleRouter(router, r'', lookup='task')
comments_router.register(r'comments', TaskCommentViewSet, basename='task-comments')

submissions_router = routers.NestedSimpleRouter(router, r'', lookup='task')
submissions_router.register(r'submissions', TaskSubmissionViewSet, basename='task-submissions')

urlpatterns = router.urls + comments_router.urls + submissions_router.urls