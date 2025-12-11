from django.http import JsonResponse, HttpResponse
from django.views.decorators.http import require_http_methods


@require_http_methods(["GET"])
def api_root(request):
    """
    Vista raíz de la API.
    Proporciona información básica sobre la API y enlaces a endpoints principales.
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
    Vista para favicon.ico - evita 502 en requests del navegador.
    Devuelve 204 No Content.
    """
    return HttpResponse(status=204)
