from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_yasg.views import get_schema_view
from drf_yasg import openapi
from rest_framework import permissions
from django.views.static import serve
from django.http import JsonResponse

admin.site.site_title = 'Portal de Administración MH'
admin.site.site_header = "" 
admin.site.index_title = 'Bienvenido al Portal de Administración'

schema_view = get_schema_view(
   openapi.Info(
      title="MH Soluciones API",
      default_version='v1',
   ),
   public=True,
   permission_classes=(permissions.AllowAny,),
)

def health_check(request):
    """Lightweight health check endpoint for Railway and load balancers."""
    return JsonResponse({'status': 'healthy'}, status=200)

urlpatterns = [
    path('health/', health_check, name='health_check'),
    path('admin/', admin.site.urls),
    path('api/v1/', include('config.api_urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
else:
    urlpatterns += [
        path('media/<path:path>', serve, {'document_root': settings.MEDIA_ROOT}),
        path('static/<path:path>', serve, {'document_root': settings.STATIC_ROOT}),
    ]