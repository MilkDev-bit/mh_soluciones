from django.urls import path, include
from drf_yasg.views import get_schema_view
from django.conf import settings
from django.conf.urls.static import static
from drf_yasg import openapi
from rest_framework import permissions

schema_view = get_schema_view(
   openapi.Info(
      title="MH Soluciones API",
      default_version='v1',
   ),
   public=True,
   permission_classes=(permissions.AllowAny,),
)

urlpatterns = [
    path('docs/', schema_view.with_ui('swagger', cache_timeout=0), name='schema-swagger-ui'),
    path('auth/', include('apps.authentication.api.urls')),
    path('projects/', include('apps.projects.api.urls')),
    path('tasks/', include('apps.tasks.api.urls')),
    path('hr/', include('apps.hr.api.urls')),
    path('reports/', include('apps.reports.api.urls')),
    path('calendar/', include('apps.calendar.api.urls')),
    path('notifications/', include('apps.notifications.api.urls')),
    path('documents/', include('apps.documents.api.urls')),
]