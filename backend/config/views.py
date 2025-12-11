from django.http import JsonResponse, HttpResponse
from django.views.decorators.http import require_http_methods


@require_http_methods(["GET"])
def api_root(request):
    """
    API root view.
    Provides basic API information and links to main endpoints.
    """
    return JsonResponse({
        "message": "MH Soluciones Empresariales API",
        "status": "running",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health/",
            "admin": "/admin/",
            "api": "/api/v1/",
            "docs": "/api/v1/docs/",
        }
    })


@require_http_methods(["GET"])
def favicon(request):
    """
    Favicon view - prevents 502 errors on browser requests.
    Returns 204 No Content.
    """
    return HttpResponse(status=204)
