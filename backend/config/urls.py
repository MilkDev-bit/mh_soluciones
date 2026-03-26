from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_yasg.views import get_schema_view
from drf_yasg import openapi
from rest_framework import permissions
from django.views.static import serve
from django.views.generic import RedirectView
from django.http import JsonResponse
from config.views import api_root

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

def recover_submissions_view(request):
    """Temporary secret endpoint to trigger file recovery in production."""
    secret = request.GET.get('key')
    if secret != 'mh-fix-2026-drive-recover':
        return JsonResponse({'error': 'unauthorized'}, status=403)
    
    from django.core.management import call_command
    import io
    from django.http import HttpResponse
    
    out = io.StringIO()
    # Run the command for today and retry drive uploads
    call_command('recover_submission_files', date='2026-03-26', retry_drive=True, stdout=out)
    
    return HttpResponse(out.getvalue(), content_type='text/plain')

urlpatterns = [
    # API root view
    path('', api_root, name='root'),
    
    # Favicon (para admin y otras rutas del backend)
    path('favicon.ico', RedirectView.as_view(
        url=settings.STATIC_URL + 'favicon.ico',
        permanent=True
    ), name='favicon'),
    
    # Existing routes
    path('health/', health_check, name='health_check'),
    path('portal-mh-secreto-admin/', admin.site.urls),
    path('api/v1/', include('config.api_urls')),
    path('api/v1/recover-submissions-secreto-99/', recover_submissions_view),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
else:
    urlpatterns += [
        path('media/<path:path>', serve, {'document_root': settings.MEDIA_ROOT}),
        path('static/<path:path>', serve, {'document_root': settings.STATIC_ROOT}),
    ]