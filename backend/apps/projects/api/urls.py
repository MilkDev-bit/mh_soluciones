from rest_framework_nested import routers
from .views import (
    ProjectViewSet, ProjectCommentViewSet, ProjectSubmissionViewSet,
    ChannelViewSet, ChannelMessageViewSet, ChannelFileViewSet
)

router = routers.SimpleRouter()
router.register(r'', ProjectViewSet, basename='project')

comments_router = routers.NestedSimpleRouter(router, r'', lookup='project')
comments_router.register(r'comments', ProjectCommentViewSet, basename='project-comments')

submissions_router = routers.NestedSimpleRouter(router, r'', lookup='project')
submissions_router.register(r'submissions', ProjectSubmissionViewSet, basename='project-submissions')

# Channels router
channels_router = routers.NestedSimpleRouter(router, r'', lookup='project')
channels_router.register(r'channels', ChannelViewSet, basename='project-channels')

# Channel messages router
messages_router = routers.NestedSimpleRouter(channels_router, r'channels', lookup='channel')
messages_router.register(r'messages', ChannelMessageViewSet, basename='channel-messages')

# Channel files router
files_router = routers.NestedSimpleRouter(channels_router, r'channels', lookup='channel')
files_router.register(r'files', ChannelFileViewSet, basename='channel-files')

urlpatterns = (
    router.urls + 
    comments_router.urls + 
    submissions_router.urls +
    channels_router.urls +
    messages_router.urls +
    files_router.urls
)